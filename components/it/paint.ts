'use client'

import {
  Box,
  createShapeId,
  EASINGS,
  toRichText,
  type Editor,
  type TLDefaultColorStyle,
  type TLGeoShape,
  type TLShapeId,
} from 'tldraw'
import {
  BOARD_H,
  BOARD_W,
  IT_CODE_FONT,
  IT_FONT,
  sceneOffsetY,
  type ITColor,
  type ITElement,
} from '@/lib/it-lesson'

/**
 * Draws an "IT explain" lesson onto a tldraw canvas.
 *
 * Deliberately unlike the whiteboard painter. That one imitates a hand: it
 * traces a pen along each outline, tilts every shape a fraction of a degree,
 * and drifts positions so nothing lines up. This one does the opposite —
 * everything is placed exactly where the layout put it, drawn with solid
 * strokes, and revealed by fading up in place. The style is precision, and
 * precision is the one thing a wobble cannot survive.
 */

/**
 * The board's colours, mapped onto tldraw's palette.
 *
 * `white` maps to `black` on purpose: the canvas runs in tldraw's dark theme,
 * where the colour named black is rendered near-white. It is the neutral
 * stroke — structure, headings, the machine itself — and nothing here is ever
 * drawn in actual black, which on a black board would be invisible.
 */
const COLOR: Record<ITColor, TLDefaultColorStyle> = {
  white: 'black',
  grey: 'grey',
  red: 'red',
  green: 'green',
  blue: 'blue',
  yellow: 'yellow',
  violet: 'violet',
  orange: 'orange',
}

/** Screen pixels the player's chrome covers, for camera framing. */
const CHROME_TOP = 96
const CHROME_BOTTOM = 230

/** How long an element takes to fade up. */
const FADE_MS = 340

/**
 * Advance width of one character in tldraw's mono face, per size preset.
 *
 * Monospace is what makes the code element work: every glyph is the same
 * width, so a character offset converts to a pixel offset exactly, and a
 * coloured underline can be put under precisely the token it belongs to.
 */
const MONO_ADVANCE: Record<string, number> = { s: 11, m: 15, l: 20, xl: 26 }

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export class ITPainter {
  private readonly editor: Editor
  /** Scene-scoped element id -> the tldraw shapes it became. */
  private readonly painted = new Map<string, TLShapeId[]>()
  /** Page-space rect of each painted element, for routing links. */
  private readonly rects = new Map<string, Rect>()
  private readonly fades = new Set<number>()
  private readonly cameraFrames = new Set<number>()

  constructor(editor: Editor) {
    this.editor = editor
  }

  private key(sceneIndex: number, id: string) {
    return `${sceneIndex}:${id}`
  }

  has(sceneIndex: number, id: string) {
    return this.painted.has(this.key(sceneIndex, id))
  }

  reset() {
    for (const frame of this.fades) cancelAnimationFrame(frame)
    this.fades.clear()
    for (const frame of this.cameraFrames) cancelAnimationFrame(frame)
    this.cameraFrames.clear()

    const ids = this.editor.getCurrentPageShapeIds()
    if (ids.size) this.editor.deleteShapes([...ids])
    this.painted.clear()
    this.rects.clear()
  }

  /**
   * Frames a scene. Unlike the whiteboard, the box is fixed and always the
   * full board — the composition is designed to fill it, so framing content
   * bounds instead would zoom in on a half-built scene and then jump.
   */
  focus(sceneIndex: number, duration = 700, attempt = 0) {
    if (attempt === 0) {
      for (const frame of this.cameraFrames) cancelAnimationFrame(frame)
      this.cameraFrames.clear()
    }

    const screen = this.editor.getViewportScreenBounds()
    // On the first scene the editor may not have measured its container yet,
    // and framing against a zero-height viewport aims the camera at nothing.
    if (screen.h < CHROME_TOP + CHROME_BOTTOM + 80 && attempt < 30) {
      const retry = requestAnimationFrame(() =>
        this.focus(sceneIndex, attempt === 0 ? duration : 0, attempt + 1)
      )
      this.cameraFrames.add(retry)
      return
    }

    const usable = Math.max(200, screen.h - CHROME_TOP - CHROME_BOTTOM)
    const padTop = (BOARD_H * CHROME_TOP) / usable
    const padBottom = (BOARD_H * CHROME_BOTTOM) / usable

    this.editor.zoomToBounds(
      new Box(
        0,
        sceneOffsetY(sceneIndex) - padTop,
        BOARD_W,
        BOARD_H + padTop + padBottom
      ),
      {
        inset: 0,
        animation: duration > 0 ? { duration, easing: EASINGS.easeInOutCubic } : undefined,
      }
    )
  }

  /**
   * Draws one element if it hasn't been drawn. Links draw their endpoints
   * first, so a connector can never reach for a box that isn't there.
   */
  paint(sceneIndex: number, element: ITElement, scene: ITElement[], animate = true) {
    const key = this.key(sceneIndex, element.id)
    if (this.painted.has(key)) return

    for (const ref of [element.from, element.to]) {
      if (!ref || this.has(sceneIndex, ref)) continue
      const target = scene.find((other) => other.id === ref)
      if (target) this.paint(sceneIndex, target, scene, animate)
    }

    const dy = sceneOffsetY(sceneIndex)
    const ids: TLShapeId[] = []

    switch (element.kind) {
      case 'card':
        this.card(element, dy, ids)
        break
      case 'bar':
        this.bar(element, dy, ids)
        break
      case 'cells':
        this.cells(element, dy, ids)
        break
      case 'column':
        this.column(element, dy, ids)
        break
      case 'code':
        this.code(element, dy, ids)
        break
      case 'device':
        this.device(element, dy, ids)
        break
      case 'label':
        this.heading(element, dy, ids)
        break
      case 'note':
        this.note(element, dy, ids)
        break
      case 'bubble':
        this.bubble(sceneIndex, element, dy, ids)
        break
      case 'bracket':
        this.bracket(element, dy, ids)
        break
      case 'link':
        this.link(sceneIndex, element, ids)
        break
      case 'cross':
        this.cross(element, dy, ids)
        break
    }

    if (!ids.length) return

    this.painted.set(key, ids)
    this.rects.set(key, { x: element.x, y: element.y + dy, w: element.w, h: element.h })
    if (animate) this.fadeIn(ids)
    else this.setOpacity(ids, 1)
  }

  // --- the elements -------------------------------------------------------

  /** An actor: thick coloured outline, an emoji, and a name underneath. */
  private card(element: ITElement, dy: number, ids: TLShapeId[]) {
    const labelH = element.text ? 56 : 0
    const boxH = element.h - labelH

    ids.push(
      this.geo({
        x: element.x,
        y: element.y + dy,
        w: element.w,
        h: boxH,
        geo: 'rectangle',
        color: element.color,
        // The border does the work; the board's black shows through.
        fill: 'none',
        size: 'l',
      })
    )

    if (element.icon) {
      ids.push(
        this.text({
          text: element.icon,
          x: element.x,
          y: element.y + dy + boxH / 2 - 60,
          w: element.w,
          size: 'xl',
          color: 'white',
          align: 'middle',
        })
      )
    }

    if (element.text) {
      ids.push(
        this.text({
          text: element.text,
          x: element.x,
          y: element.y + dy + boxH + 8,
          w: element.w,
          size: 'm',
          color: 'white',
          align: 'middle',
        })
      )
    }
  }

  /** The layer everything sits on. One wide outlined bar with a centred name. */
  private bar(element: ITElement, dy: number, ids: TLShapeId[]) {
    ids.push(
      this.geo({
        x: element.x,
        y: element.y + dy,
        w: element.w,
        h: element.h,
        geo: 'rectangle',
        color: element.color,
        fill: 'none',
        size: 'l',
        label: element.text,
      })
    )
  }

  /**
   * A run of equal cells, some of them owned.
   *
   * Each cell is its own shape so a span can fill an exact range — this is the
   * element that makes an allocation legible, and it only works if cell
   * boundaries are real rather than painted on.
   */
  private cells(element: ITElement, dy: number, ids: TLShapeId[]) {
    const count = Math.max(2, element.cells)
    const cellW = element.w / count
    const cellH = Math.min(element.h, 84)

    // Which colour, if any, owns each cell.
    const owner = new Array<ITColor | null>(count).fill(null)
    for (const span of element.spans) {
      for (let i = Math.max(0, span.from); i < Math.min(count, span.to); i++) {
        owner[i] = span.color
      }
    }

    for (let i = 0; i < count; i++) {
      ids.push(
        this.geo({
          x: element.x + i * cellW,
          y: element.y + dy,
          w: cellW,
          h: cellH,
          geo: 'rectangle',
          color: owner[i] ?? 'white',
          fill: owner[i] ? 'solid' : 'none',
          size: 's',
        })
      )
    }

    // A span's label goes under the middle of its run.
    for (const span of element.spans) {
      if (!span.label) continue
      const from = Math.max(0, span.from)
      const to = Math.min(count, span.to)
      if (to <= from) continue
      ids.push(
        this.text({
          text: span.label,
          x: element.x + from * cellW,
          y: element.y + dy + cellH + 8,
          w: (to - from) * cellW,
          size: 's',
          color: span.color,
          align: 'middle',
        })
      )
    }
  }

  /** A tall bar where height means quantity. */
  private column(element: ITElement, dy: number, ids: TLShapeId[]) {
    const headingH = element.text ? 52 : 0
    if (element.text) {
      ids.push(
        this.text({
          text: element.text,
          x: element.x,
          y: element.y + dy,
          w: element.w,
          size: 'm',
          color: 'white',
          align: 'middle',
        })
      )
    }

    const top = element.y + dy + headingH
    const height = element.h - headingH
    const total = element.spans.reduce((sum, span) => sum + Math.max(0, span.weight), 0)

    if (!element.spans.length || total <= 0) {
      ids.push(
        this.geo({
          x: element.x,
          y: top,
          w: element.w,
          h: height,
          geo: 'rectangle',
          color: element.color,
          fill: 'none',
          size: 'm',
        })
      )
      return
    }

    let y = top
    for (const span of element.spans) {
      const segment = (Math.max(0, span.weight) / total) * height
      ids.push(
        this.geo({
          x: element.x,
          y,
          w: element.w,
          h: segment,
          geo: 'rectangle',
          color: span.color,
          fill: 'solid',
          size: 's',
          label: span.label,
        })
      )
      y += segment
    }
  }

  /**
   * Source, in a monospace face, with one line boxed.
   *
   * A `span` on a code element means something different from one on a cells
   * strip: `weight` is the line it applies to, and from/to are character
   * offsets within that line. It draws a coloured rule under those characters,
   * which is how a type in the source is tied to the bytes it claims further
   * down the board.
   */
  private code(element: ITElement, dy: number, ids: TLShapeId[]) {
    const size = element.lines.length > 8 ? 's' : 'm'
    const lineH = element.lines.length > 8 ? 44 : 58
    const advance = MONO_ADVANCE[size]
    const left = element.x + 24
    const top = element.y + dy + 20

    for (const [index, line] of element.lines.entries()) {
      if (index === element.highlight) {
        ids.push(
          this.geo({
            x: element.x + 8,
            y: top + index * lineH - 8,
            w: element.w - 16,
            h: lineH,
            geo: 'rectangle',
            color: 'white',
            fill: 'none',
            size: 's',
          })
        )
      }

      ids.push(
        this.text({
          text: line || ' ',
          x: left,
          y: top + index * lineH,
          w: element.w - 48,
          size,
          color: 'white',
          align: 'start',
          font: IT_CODE_FONT,
        })
      )
    }

    for (const span of element.spans) {
      const line = Math.round(span.weight)
      if (line < 0 || line >= element.lines.length) continue
      const from = Math.max(0, span.from)
      const to = Math.max(from + 1, span.to)
      ids.push(
        this.geo({
          x: left + from * advance,
          y: top + line * lineH + lineH * 0.62,
          w: (to - from) * advance,
          h: 6,
          geo: 'rectangle',
          color: span.color,
          fill: 'solid',
          size: 's',
        })
      )
    }
  }

  /** A piece of hardware: a big glyph with its name under it. */
  private device(element: ITElement, dy: number, ids: TLShapeId[]) {
    ids.push(
      this.text({
        text: element.icon || '💽',
        x: element.x,
        y: element.y + dy,
        w: element.w,
        size: 'xl',
        color: element.color,
        align: 'middle',
      })
    )
    if (element.text) {
      ids.push(
        this.text({
          text: element.text,
          x: element.x,
          y: element.y + dy + element.h - 56,
          w: element.w,
          size: 'm',
          color: 'white',
          align: 'middle',
        })
      )
    }
  }

  private heading(element: ITElement, dy: number, ids: TLShapeId[]) {
    ids.push(
      this.text({
        text: element.text,
        x: element.x,
        y: element.y + dy,
        w: element.w,
        size: 'l',
        color: element.color,
        align: 'middle',
      })
    )
  }

  private note(element: ITElement, dy: number, ids: TLShapeId[]) {
    ids.push(
      this.text({
        text: element.text,
        x: element.x,
        y: element.y + dy,
        w: element.w,
        size: 's',
        color: element.color === 'white' ? 'grey' : element.color,
        align: 'middle',
      })
    )
  }

  /** What an actor says, in an ellipse with a tail back to it. */
  private bubble(sceneIndex: number, element: ITElement, dy: number, ids: TLShapeId[]) {
    ids.push(
      this.geo({
        x: element.x,
        y: element.y + dy,
        w: element.w,
        h: element.h,
        geo: 'ellipse',
        color: 'white',
        fill: 'none',
        size: 'm',
        label: element.text,
      })
    )

    const speaker = element.from ? this.rects.get(this.key(sceneIndex, element.from)) : null
    if (!speaker) return

    // The tail: a plain line from the bubble back to whoever is talking.
    const id = createShapeId()
    const start = {
      x: element.x + element.w / 2,
      y: element.y + dy + element.h / 2,
    }
    const end = {
      x: speaker.x + speaker.w / 2,
      y: speaker.y + speaker.h / 2,
    }
    this.editor.createShape({
      id,
      type: 'arrow',
      x: start.x,
      y: start.y,
      opacity: 0,
      props: {
        start: { x: 0, y: 0 },
        end: { x: end.x - start.x, y: end.y - start.y },
        color: 'black',
        size: 's',
        dash: 'solid',
        arrowheadStart: 'none',
        arrowheadEnd: 'none',
        bend: 0,
        scale: 1,
      },
    })
    ids.push(id)
  }

  /** A squared bracket under a range, with a label below it. */
  private bracket(element: ITElement, dy: number, ids: TLShapeId[]) {
    const y = element.y + dy
    const arm = 16

    for (const rect of [
      { x: element.x, y, w: element.w, h: 4 },
      { x: element.x, y, w: 4, h: arm },
      { x: element.x + element.w - 4, y, w: 4, h: arm },
      // The stem down to the label.
      { x: element.x + element.w / 2 - 2, y: y + 4, w: 4, h: arm },
    ]) {
      ids.push(
        this.geo({
          ...rect,
          geo: 'rectangle',
          color: element.color,
          fill: 'solid',
          size: 's',
        })
      )
    }

    if (element.text) {
      ids.push(
        this.text({
          text: element.text,
          x: element.x,
          y: y + arm + 12,
          w: element.w,
          size: 's',
          color: element.color,
          align: 'middle',
        })
      )
    }
  }

  /**
   * An orthogonal connector, drawn in the source's colour.
   *
   * Routed as two segments with a right-angled turn rather than as a curve:
   * every connector in this style meets at ninety degrees, and a bowed arrow
   * would read as a different diagram entirely. Dashed means a request that
   * has not been granted.
   */
  private link(sceneIndex: number, element: ITElement, ids: TLShapeId[]) {
    const from = element.from ? this.rects.get(this.key(sceneIndex, element.from)) : null
    const to = element.to ? this.rects.get(this.key(sceneIndex, element.to)) : null
    if (!from || !to) return

    // Leave from the side facing the target, so a link never sets off in the
    // wrong direction and doubles back across its own source.
    const forward = to.x + to.w / 2 >= from.x + from.w / 2
    const start = { x: forward ? from.x + from.w : from.x, y: from.y + from.h / 2 }
    const end = { x: forward ? to.x : to.x + to.w, y: to.y + to.h / 2 }

    const id = createShapeId()
    this.editor.createShape({
      id,
      type: 'arrow',
      x: start.x,
      y: start.y,
      opacity: 0,
      props: {
        start: { x: 0, y: 0 },
        end: { x: end.x - start.x, y: end.y - start.y },
        color: COLOR[element.color],
        size: 'm',
        dash: element.dashed ? 'dashed' : 'solid',
        arrowheadStart: 'none',
        arrowheadEnd: 'none',
        bend: 0,
        elbowMidPoint: 0.5,
        kind: 'elbow',
        scale: 1,
      },
    })
    ids.push(id)
  }

  /** A red cross over something that fails. */
  private cross(element: ITElement, dy: number, ids: TLShapeId[]) {
    ids.push(
      this.geo({
        x: element.x,
        y: element.y + dy,
        w: element.w,
        h: element.h,
        geo: 'x-box',
        color: 'red',
        fill: 'none',
        size: 'l',
      })
    )
  }

  // --- primitives ---------------------------------------------------------

  /** Sets opacity on a group without caring what kind of shape each one is. */
  private setOpacity(ids: TLShapeId[], opacity: number) {
    for (const id of ids) {
      const shape = this.editor.getShape(id)
      if (shape) this.editor.updateShape({ id, type: shape.type, opacity })
    }
  }

  private geo(spec: {
    x: number
    y: number
    w: number
    h: number
    geo: TLGeoShape['props']['geo']
    color: ITColor
    fill: 'none' | 'solid'
    size: 's' | 'm' | 'l' | 'xl'
    label?: string
  }): TLShapeId {
    const id = createShapeId()
    this.editor.createShape({
      id,
      type: 'geo',
      x: spec.x,
      y: spec.y,
      opacity: 0,
      props: {
        geo: spec.geo,
        w: Math.max(4, spec.w),
        h: Math.max(4, spec.h),
        richText: toRichText(spec.label ?? ''),
        color: COLOR[spec.color],
        labelColor: 'black',
        fill: spec.fill,
        dash: 'solid',
        size: spec.size,
        font: IT_FONT,
        align: 'middle',
        verticalAlign: 'middle',
        scale: 1,
      },
    })
    return id
  }

  private text(spec: {
    text: string
    x: number
    y: number
    w: number
    size: 's' | 'm' | 'l' | 'xl'
    color: ITColor
    align: 'start' | 'middle'
    font?: typeof IT_FONT | typeof IT_CODE_FONT
  }): TLShapeId {
    const id = createShapeId()
    this.editor.createShape({
      id,
      type: 'text',
      x: spec.x,
      y: spec.y,
      opacity: 0,
      props: {
        richText: toRichText(spec.text || ' '),
        color: COLOR[spec.color],
        size: spec.size,
        font: spec.font ?? IT_FONT,
        textAlign: spec.align,
        autoSize: false,
        w: Math.max(40, spec.w),
        scale: 1,
      },
    })
    return id
  }

  /**
   * Fades a group up together.
   *
   * Everything belonging to one element — a card's outline, its icon and its
   * name — arrives as one thing. Revealing them separately would read as three
   * events, when the narration only described one.
   */
  private fadeIn(ids: TLShapeId[]) {
    const start = performance.now()

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / FADE_MS)
      this.setOpacity(ids, t * t * (3 - 2 * t))
      if (t < 1) {
        const frame = requestAnimationFrame(step)
        this.fades.add(frame)
      }
    }

    const frame = requestAnimationFrame(step)
    this.fades.add(frame)
  }
}
