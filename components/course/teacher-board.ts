'use client'

import {
  Box,
  createShapeId,
  toRichText,
  type Editor,
  type TLDefaultColorStyle,
  type TLShapeId,
} from 'tldraw'
import { BOARD_H, BOARD_W, type BoardItem, type BoardTone } from '@/lib/course-board'

/**
 * Painting the teacher's diagram into the learner's whiteboard.
 *
 * The two share one canvas on purpose. A board where the teacher draws on one
 * surface and you draw on another is two boards, and the whole point of putting
 * a whiteboard beside the lesson is that you can annotate what was just drawn —
 * circle the box you did not follow, write your own note next to it.
 *
 * Sharing a canvas creates exactly one problem, and it is the important one:
 * clearing the board between sections must never touch the learner's work. So
 * every shape this file creates is stamped `meta.teacher`, and clearing removes
 * only those. Nothing you draw is ever deleted by the lesson.
 */

const TEACHER = { teacher: true } as const

/** Tone is meaning; this is the one place it becomes a colour. */
const COLOUR: Record<BoardTone, TLDefaultColorStyle> = {
  plain: 'black',
  accent: 'blue',
  good: 'green',
  warn: 'red',
  muted: 'grey',
}

/** Everything the teacher has drawn, so it can be taken away again. */
export function teacherShapes(editor: Editor): TLShapeId[] {
  return editor
    .getCurrentPageShapes()
    .filter((shape) => (shape.meta as { teacher?: boolean })?.teacher)
    .map((shape) => shape.id)
}

/**
 * Wipes the teacher's diagram and frames the empty board.
 *
 * Called when a section begins, not when it ends — so the last thing drawn
 * stays up for as long as anyone is looking at it.
 */
export function clearBoard(editor: Editor, reframe = true) {
  const mine = teacherShapes(editor)
  if (mine.length) editor.deleteShapes(mine)
  if (!reframe) return
  try {
    editor.zoomToBounds(new Box(0, 0, BOARD_W, BOARD_H), {
      inset: 24,
      animation: { duration: 260 },
    })
  } catch {
    // Camera work is a courtesy. A tldraw that has moved this API on should
    // cost the framing, never the diagram.
  }
}

/**
 * Draws one part of the diagram.
 *
 * Positions come from `lib/course-board.ts`, already resolved for the whole
 * block — so a box arriving now lands where it was always going to land, and
 * nothing already on the board moves to make room for it.
 */
export function drawItem(editor: Editor, item: BoardItem, named: Map<string, TLShapeId>) {
  const colour = COLOUR[item.tone]
  const fresh: { id: TLShapeId; type: string }[] = []

  /**
   * Everything is created invisible and then faded up.
   *
   * A shape that simply exists on the frame its beat arrives reads as a slide
   * changing. The demo in `components/demos/` makes the opposite bet — ink is
   * *drawn*, never placed — and it is the single thing that makes that lesson
   * feel like someone is explaining rather than advancing. tldraw will not move
   * a pen along a path, but a short fade still says "this is arriving now",
   * which is the part that matters when a voice is talking over it.
   */
  const add = (type: 'geo' | 'text' | 'arrow', partial: Record<string, unknown>) => {
    const id = createShapeId()
    editor.createShape({ id, type, meta: TEACHER, opacity: 0, ...partial } as never)
    fresh.push({ id, type })
    return id
  }

  const reveal = () => {
    if (!fresh.length) return
    try {
      editor.animateShapes(
        fresh.map((s) => ({ id: s.id, type: s.type, opacity: 1 }) as never),
        { animation: { duration: 340 } }
      )
    } catch {
      // No fade is a cosmetic loss. Never let it cost the diagram.
      for (const s of fresh) editor.updateShape({ id: s.id, type: s.type, opacity: 1 } as never)
    }
  }

  /** A geo box, the shape most of this vocabulary is built out of. */
  const boxAt = (
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    tint: TLDefaultColorStyle,
    size: 's' | 'm' = 'm'
  ) =>
    add('geo', {
      x,
      y,
      props: {
        geo: 'rectangle',
        w,
        h,
        richText: toRichText(text),
        color: tint,
        labelColor: tint,
        fill: 'none',
        dash: 'draw',
        size,
        font: 'draw',
        align: 'middle',
        verticalAlign: 'middle',
        scale: 1,
      },
    })

  /** A bare arrow between two points, for the shapes that draw their own. */
  const arrowFrom = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    label: string,
    tint: TLDefaultColorStyle
  ) =>
    add('arrow', {
      x: x1,
      y: y1,
      props: {
        start: { x: 0, y: 0 },
        end: { x: x2 - x1, y: y2 - y1 },
        color: tint,
        labelColor: tint,
        fill: 'none',
        dash: 'draw',
        size: 's',
        font: 'draw',
        arrowheadStart: 'none',
        arrowheadEnd: 'arrow',
        richText: toRichText(label),
        labelPosition: 0.5,
        scale: 1,
      },
    })

  // A sequence, with its connectors drawn for it.
  if (item.kind === 'flow') {
    const steps = item.steps!
    const step = (item.w! - (steps.length - 1) * 66) / steps.length
    steps.forEach((text, i) => {
      const x = item.x! + i * (step + 66)
      boxAt(x, item.y!, step, item.h!, text, colour, 's')
      if (i < steps.length - 1) {
        const mid = item.y! + item.h! / 2
        arrowFrom(x + step + 8, mid, x + step + 58, mid, '', colour)
      }
    })
    reveal()
    return
  }

  // A decision. Drawn as a fork because that is what it is — read as two
  // stacked boxes, an if/else looks like a sequence, which is the one thing it
  // is not.
  if (item.kind === 'branch') {
    const centre = item.x! + item.w! / 2
    boxAt(centre - 130, item.y!, 260, 80, item.text, colour)

    const armY = item.y! + 80 + 76
    const leftX = centre - 210 - 55
    const rightX = centre + 55
    boxAt(leftX, armY, 210, 72, item.yes!, 'green', 's')
    boxAt(rightX, armY, 210, 72, item.no!, 'red', 's')

    arrowFrom(centre - 40, item.y! + 84, leftX + 105, armY - 6, 'true', 'green')
    arrowFrom(centre + 40, item.y! + 84, rightX + 105, armY - 6, 'false', 'red')
    reveal()
    return
  }

  // An object: key on the left, value on the right, one pair to a row.
  if (item.kind === 'pairs') {
    item.pairs!.forEach(([key, value], i) => {
      const y = item.y! + i * 56
      boxAt(item.x!, y, 180, 56, key, 'grey', 's')
      boxAt(item.x! + 180, y, item.w! - 180, 56, value, colour, 's')
    })
    reveal()
    return
  }

  if (item.kind === 'title' || item.kind === 'note') {
    const heading = item.kind === 'title'
    add('text', {
      x: item.x!,
      y: item.y!,
      props: {
        richText: toRichText(item.text),
        color: heading ? colour : item.tone === 'plain' ? 'grey' : colour,
        size: heading ? 'l' : 'm',
        font: 'draw',
        textAlign: 'middle',
        w: item.w!,
        autoSize: false,
        scale: 1,
      },
    })
    reveal()
    return
  }

  if (item.kind === 'box') {
    const id = boxAt(item.x!, item.y!, item.w!, item.h!, item.text, colour)
    // Only a named box can be an arrow's endpoint, and `link` may not arrive
    // for several beats — so the id is remembered rather than recomputed.
    if (item.id) named.set(item.id, id)
    reveal()
    return
  }

  if (item.kind === 'cells') {
    // The strip that teaches zero-based indexing: the cells above, and the
    // index written under each one. The numbers are the lesson, so they are
    // drawn as their own shapes rather than crammed into the cell's label.
    const cells = item.cells!
    const size = item.w! / cells.length
    cells.forEach((text, i) => {
      boxAt(item.x! + i * size, item.y!, size, item.h!, text, colour)
      add('text', {
        x: item.x! + i * size,
        y: item.y! + item.h! + 6,
        props: {
          richText: toRichText(String(i)),
          color: 'grey',
          size: 's',
          font: 'draw',
          textAlign: 'middle',
          w: size,
          autoSize: false,
          scale: 1,
        },
      })
    })
    reveal()
    return
  }

  // link
  const from = named.get(item.from!)
  const to = named.get(item.to!)
  if (!from || !to) return

  const a = editor.getShapePageBounds(from)
  const b = editor.getShapePageBounds(to)
  if (!a || !b) return

  const id = arrowFrom(a.center.x, a.center.y, b.center.x, b.center.y, item.text ?? '', colour)

  // Bound, not merely positioned — so if the learner drags a box to look at it
  // from another angle, the arrow follows instead of pointing at where it was.
  for (const [terminal, target] of [
    ['start', from],
    ['end', to],
  ] as const) {
    try {
      editor.createBinding({
        type: 'arrow',
        fromId: id,
        toId: target,
        props: {
          terminal,
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isPrecise: false,
          isExact: false,
          snap: 'none',
        },
      })
    } catch {
      // An unbound arrow still points the right way. Not worth losing.
    }
  }
  reveal()
}
