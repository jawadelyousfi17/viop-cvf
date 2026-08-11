'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BoardShape } from '@/lib/lesson'
import { Shape } from './Shape'
import {
  boundsOf,
  columnZoom,
  fit,
  type Bounds,
  focus,
  sameCamera,
  scrolled,
  tween,
  viewBox,
  zoomAt,
  type Camera,
} from './camera'

/**
 * A camera move the board has been asked to make.
 *
 * Identity is the trigger: a new object means "do this now". Which is what
 * keeps the camera from being recomputed on every layout change — the board
 * re-lays out constantly as limbs fold and grow, and following all of that
 * would mean the view never settles.
 */
export type View = { type: 'fit' } | { type: 'focus'; id: string }

/**
 * The board.
 *
 * A renderer for the board language, drawn as SVG, with no editor underneath
 * it. The map is not an editable document — nobody drags a branch around or
 * types into a leaf — so an editing engine was paying for a scene graph, a tool
 * system, a history stack and a shape-validation layer to draw sixty static
 * paths. What the map actually needs is four things: geometry that looks
 * hand-drawn (ink.ts), a camera (camera.ts), text that wraps (Shape.tsx), and
 * knowing which shape was clicked — which, when the shapes are real DOM nodes,
 * is one `closest()` call rather than a hit test.
 *
 * The whole board is one React render. Shapes are a pure function of props, so
 * folding a limb is a re-render, and there is no imperative painter holding a
 * second copy of the truth.
 */

/** Where the red margin rule falls, in board units — see lib/math.ts. */
const MARGIN_RULE = 470

/** Past this much movement, a press and its release were a pan, not a click. */
const CLICK_SLOP = 6

/** Board units of air above the first shape when a page is scrolled to its top. */
const PAGE_TOP = 40

/**
 * Where a step lands when it has to be scrolled to, as a fraction of the view.
 *
 * Not the top: the line above it is what it follows from, and a step that
 * arrives against the top edge arrives with its reason off-screen.
 */
const READING_LINE = 0.28

export function BoardCanvas({
  shapes,
  symbols,
  view,
  frame,
  column,
  paper = 'grid',
  onShapeClick,
  className,
}: {
  shapes: BoardShape[]
  /** Symbol art by query, as it resolves. Missing means "not drawn yet". */
  symbols?: Map<string, string>
  /** Where to point the camera. Acted on when the object changes, not on every render. */
  view?: View | null
  /**
   * What the work is written on.
   *
   * A grid for a board someone is drawing on, ruled lines for one someone is
   * writing on. It is not decoration: the rules tell you at a glance that this
   * is a page of working to be read down, not a diagram to be scanned around.
   */
  paper?: 'grid' | 'ruled'
  /**
   * Frame this box rather than whatever is currently drawn.
   *
   * For a board being revealed a piece at a time: fitting the shapes that
   * exist so far means the camera lurches on every new one. The caller knows
   * where the finished board ends up, so it can say.
   */
  frame?: Bounds
  /**
   * Read this board as a page of the given width, in board units.
   *
   * The width is then settled: the camera never zooms, `view` only scrolls,
   * and a resize changes the scale rather than how much fits across. Pass a
   * stable object — it is a dependency of the camera, not a render-time value.
   */
  column?: { x: number; w: number }
  onShapeClick?: (id: string) => void
  className?: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 })
  /**
   * The camera again, where a handler can read it without being rebuilt every
   * time it moves — and, more importantly, where the animation loop can read it
   * without living inside a state updater. React may call an updater twice, and
   * an updater that starts an animation would then start two.
   */
  const cameraRef = useRef(camera)

  /**
   * Where the pointer went down, which shape it went down on, and where the
   * camera was — enough to tell a click from a drag on release.
   */
  const pressRef = useRef<{ x: number; y: number; camera: Camera; hit: string | null } | null>(null)
  const draggingRef = useRef(false)
  const animationRef = useRef(0)

  const byId = useMemo(() => new Map(shapes.map((shape) => [shape.id, shape])), [shapes])
  const bounds = useMemo(() => frame ?? boundsOf(shapes), [frame, shapes])

  // Measure the host, since the viewBox is computed from real pixels.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect
      setSize({ width: box.width, height: box.height })
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const applyCamera = useCallback((next: Camera) => {
    cameraRef.current = next
    setCamera(next)
  }, [])

  /** Eases to a camera rather than cutting, so the eye follows the move. */
  const glideTo = useCallback(
    (target: Camera) => {
      cancelAnimationFrame(animationRef.current)
      const from = cameraRef.current
      if (sameCamera(from, target)) return

      const started = performance.now()
      const step = (now: number) => {
        const t = (now - started) / 420
        applyCamera(tween(from, target, t))
        if (t < 1) animationRef.current = requestAnimationFrame(step)
      }
      animationRef.current = requestAnimationFrame(step)
    },
    [applyCamera]
  )

  /** The last camera move actually made, so a re-layout doesn't repeat it. */
  const doneRef = useRef<{ view: View | null; size: typeof size } | null>(null)

  // A page holds its width across a resize. The scroll is kept where it was —
  // the window changing shape is not a reason to lose someone's place — and
  // only the scale follows the new size.
  useEffect(() => {
    if (!column || !size.width || !size.height) return
    const zoom = columnZoom(column.w, size)
    const current = cameraRef.current
    const next = { zoom, x: column.x + column.w / 2 - size.width / zoom / 2, y: current.y }
    if (!sameCamera(current, next)) applyCamera(next)
  }, [column, size, applyCamera])

  // Move the camera when asked to, and when the viewport is first measured —
  // never merely because the board changed. The board re-lays out on every fold
  // and every expansion, and a camera that followed all of that never settles.
  useEffect(() => {
    if (!size.width || !size.height || !view) return

    const done = doneRef.current
    if (done && done.view === view && done.size.width === size.width && done.size.height === size.height) {
      return
    }
    doneRef.current = { view, size }

    // The node that was opened, its symbol and its explanation, and whatever
    // just appeared under it — that is what someone wants to see after
    // clicking, at a size they can read.
    const partOf = (id: string) =>
      shapes.filter(
        (shape) =>
          shape.id === id ||
          shape.id === `${id}s` ||
          shape.id === `${id}d` ||
          shape.id.startsWith(`${id}.`)
      )

    if (column) {
      const page = frame ?? boundsOf(shapes)
      if (!page) return
      const top = page.y - PAGE_TOP

      if (view.type === 'fit') {
        glideTo(scrolled(column, size, top))
        return
      }

      const box = boundsOf(partOf(view.id))
      if (!box) return

      // Only when it is not already there. Most steps follow the one above
      // them onto the same screen, and scrolling to something already in front
      // of someone moves the words they are reading for no reason.
      const camera = cameraRef.current
      const visible = size.height / camera.zoom
      if (box.y >= camera.y && box.y + box.h <= camera.y + visible) return

      glideTo(scrolled(column, size, Math.max(top, box.y - visible * READING_LINE)))
      return
    }

    if (view.type === 'fit') {
      const box = frame ?? boundsOf(shapes)
      if (box) glideTo(fit(box, size))
      return
    }

    const box = boundsOf(partOf(view.id)) ?? boundsOf(shapes)
    if (box) glideTo(focus(box, size))
  }, [view, size, shapes, frame, column, glideTo])

  useEffect(() => () => cancelAnimationFrame(animationRef.current), [])

  // Wheel: scroll to pan, ctrl/⌘ (and pinch, which arrives as ctrl) to zoom.
  // Non-passive, because a page that scrolls under a board is a board you
  // cannot use.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      cancelAnimationFrame(animationRef.current)

      const rect = host.getBoundingClientRect()
      const current = cameraRef.current

      // A page scrolls and does nothing else. Pinching it to a different width
      // is the one thing "fixed width" rules out, and there is nothing either
      // side of the column to pan sideways to.
      if (column) {
        applyCamera({ ...current, y: current.y + event.deltaY / current.zoom })
        return
      }

      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.01)
        const at = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        applyCamera(zoomAt(current, at, factor))
        return
      }

      applyCamera({
        ...current,
        x: current.x + event.deltaX / current.zoom,
        y: current.y + event.deltaY / current.zoom,
      })
    }

    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [applyCamera, column])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    cancelAnimationFrame(animationRef.current)

    // Which shape was pressed is worked out HERE, not on release.
    //
    // Shapes are DOM nodes, so the shape is whichever one the event came out
    // of — but the capture below retargets every later pointer event to this
    // div, so by the time the pointer comes up the event no longer remembers
    // what it was over. Read it while it still does.
    const target = event.target as Element | null
    const hit = target?.closest?.('[data-shape-id]')?.getAttribute('data-shape-id') ?? null

    pressRef.current = { x: event.clientX, y: event.clientY, camera: cameraRef.current, hit }
    draggingRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const press = pressRef.current
    if (!press) return

    const dx = event.clientX - press.x
    const dy = event.clientY - press.y
    if (!draggingRef.current && Math.abs(dx) < CLICK_SLOP && Math.abs(dy) < CLICK_SLOP) return

    draggingRef.current = true
    applyCamera({
      zoom: press.camera.zoom,
      // A page is dragged up and down. Sideways there is only margin.
      x: column ? press.camera.x : press.camera.x - dx / press.camera.zoom,
      y: press.camera.y - dy / press.camera.zoom,
    })
  }, [applyCamera, column])

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const press = pressRef.current
      pressRef.current = null

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      // A press that moved was a pan; a press that stayed put on a shape was a
      // click on that shape.
      if (!press || draggingRef.current || !press.hit) return
      onShapeClick?.(press.hit)
    },
    [onShapeClick]
  )

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ touchAction: 'none', cursor: 'default', overflow: 'hidden' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        pressRef.current = null
      }}
      onDoubleClick={() => {
        if (!bounds || !size.width) return
        // Back to the top of the page, or back to the whole board — whichever
        // "show me all of it" means here.
        glideTo(column ? scrolled(column, size, bounds.y - PAGE_TOP) : fit(bounds, size))
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox(camera, size)}
        style={{ display: 'block', background: '#fdfdfc' }}
      >
        <defs>
          {/* The surface. A board needs something to sit against, or the shapes
              float on white and the hand-drawn styling has nothing to read
              against. In board units, so it scales with the camera. */}
          <pattern id="board-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#00000010" />
          </pattern>

          {/* Feint ruled, at the line spacing the hand font is set on. */}
          <pattern id="board-ruled" width="100" height="38" patternUnits="userSpaceOnUse">
            <line x1="0" y1="37.5" x2="100" y2="37.5" stroke="#3b82f6" strokeOpacity="0.12" strokeWidth="1" />
          </pattern>
        </defs>

        <rect
          x={camera.x}
          y={camera.y}
          width={size.width / camera.zoom}
          height={size.height / camera.zoom}
          fill={paper === 'ruled' ? 'url(#board-ruled)' : 'url(#board-grid)'}
        />

        {/* The margin rule, the way a notebook has one. Fixed in board space,
            so it stays with the work rather than with the window. */}
        {paper === 'ruled' && (
          <line
            x1={MARGIN_RULE}
            y1={camera.y}
            x2={MARGIN_RULE}
            y2={camera.y + size.height / camera.zoom}
            stroke="#ef4444"
            strokeOpacity="0.25"
            strokeWidth="1.5"
          />
        )}

        {shapes.map((shape) => (
          <Shape
            key={shape.id}
            shape={shape}
            shapes={byId}
            symbol={symbols?.get(shape.text.trim().toLowerCase())}
          />
        ))}
      </svg>
    </div>
  )
}
