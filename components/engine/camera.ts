import type { BoardShape } from '@/lib/lesson'

/**
 * Where the board is being looked at from.
 *
 * `x`/`y` is the board point at the top-left of the viewport and `zoom` is
 * screen pixels per board unit, which is exactly an SVG viewBox — so moving the
 * camera is one attribute change and the browser does the transform. There is
 * no scene graph here and no per-shape transform to keep in step.
 */
export interface Camera {
  x: number
  y: number
  zoom: number
}

export interface Size {
  width: number
  height: number
}

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4

export function viewBox(camera: Camera, size: Size) {
  const w = Math.max(1, size.width / camera.zoom)
  const h = Math.max(1, size.height / camera.zoom)
  return `${camera.x} ${camera.y} ${w} ${h}`
}

/** The box every shape fits inside, or null when there is nothing to frame. */
export function boundsOf(shapes: BoardShape[]): Bounds | null {
  // An arrow's own box is empty — it is drawn from the shapes it joins, which
  // are in here already.
  const real = shapes.filter((shape) => shape.kind !== 'arrow')
  if (!real.length) return null

  const x = Math.min(...real.map((s) => s.x))
  const y = Math.min(...real.map((s) => s.y))
  const right = Math.max(...real.map((s) => s.x + s.w))
  const bottom = Math.max(...real.map((s) => s.y + s.h))
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) }
}

/** The camera that frames `bounds` inside `size`, with room around it. */
export function fit(bounds: Bounds, size: Size, padding = 60): Camera {
  const zoom = clampZoom(
    Math.min(
      (size.width - padding * 2) / bounds.w,
      (size.height - padding * 2) / bounds.h
    )
  )
  return {
    zoom,
    x: bounds.x + bounds.w / 2 - size.width / zoom / 2,
    y: bounds.y + bounds.h / 2 - size.height / zoom / 2,
  }
}

/**
 * Frames one part of the board without zooming in past readable.
 *
 * `fit` is for a whole map; this is for the piece someone just opened. Fitting
 * the whole map on every change is what makes a growing map useless — each new
 * branch zooms the rest of it a little further towards illegible, and the thing
 * you clicked ends up smaller than it was before you clicked it.
 */
export function focus(bounds: Bounds, size: Size, padding = 110, maxZoom = 1.1): Camera {
  const framed = fit(bounds, size, padding)
  const zoom = Math.min(framed.zoom, maxZoom)
  return {
    zoom,
    x: bounds.x + bounds.w / 2 - size.width / zoom / 2,
    y: bounds.y + bounds.h / 2 - size.height / zoom / 2,
  }
}

/** Zooms about a point on screen, so whatever is under the cursor stays put. */
export function zoomAt(camera: Camera, screen: { x: number; y: number }, factor: number): Camera {
  const zoom = clampZoom(camera.zoom * factor)
  if (zoom === camera.zoom) return camera

  const board = { x: camera.x + screen.x / camera.zoom, y: camera.y + screen.y / camera.zoom }
  return { zoom, x: board.x - screen.x / zoom, y: board.y - screen.y / zoom }
}

export function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function sameCamera(a: Camera, b: Camera) {
  return (
    Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.zoom - b.zoom) < 0.001
  )
}

/**
 * Eased interpolation between two cameras.
 *
 * The camera moves when the map is re-laid-out — folding a limb changes what
 * there is to look at — and cutting straight to the new framing loses the
 * viewer, who then has to work out what moved. An ease-out over a few hundred
 * milliseconds is enough to keep the eye attached to the board.
 */
export function tween(from: Camera, to: Camera, t: number): Camera {
  const eased = 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    // Zoom is interpolated in log space: doubling then doubling again should
    // look like two equal steps, and linearly it does not.
    zoom: Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * eased),
  }
}
