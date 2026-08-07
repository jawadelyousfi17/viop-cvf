/**
 * Finding a connector a way through.
 *
 * A straight line between two shapes is the right answer most of the time and
 * the wrong one exactly when something is standing between them — and because
 * connectors are drawn behind the shapes, a blocked line does not look wrong,
 * it looks *interrupted*: it vanishes under the obstacle and comes out the
 * other side, as though the board had two arrows instead of one.
 *
 * So: straight when the way is clear, and around when it is not. The search is
 * A* over a coarse grid with a turn penalty, which is the cheapest thing that
 * reliably produces the route a person would draw — a few long straight runs
 * and as few corners as possible, rather than a diagonal that clips a corner
 * and technically misses.
 *
 * Pure geometry, no DOM. The renderer measures; this decides.
 */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

/** Coarse enough to search fast, fine enough to find a gap between shapes. */
const CELL = 14

/** How far a route keeps off a shape it is passing. */
const CLEARANCE = 10

/** A corner costs this many cells' worth of travel, so routes stay simple. */
const TURN_COST = 6

/** Give up rather than hang: a board this size never needs more. */
const MAX_VISITED = 20000

const inflate = (box: Box, by: number): Box => ({
  x: box.x - by,
  y: box.y - by,
  w: box.w + by * 2,
  h: box.h + by * 2,
})

const inside = (p: Point, box: Box) =>
  p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h

/**
 * Whether a segment misses every obstacle.
 *
 * The slab test rather than sampling: a sampled line steps over a thin shape
 * whenever the step is wider than the shape, and "thin" describes every rule,
 * divider and one-line label on the board.
 */
export function clear(a: Point, b: Point, obstacles: Box[]): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y

  for (const box of obstacles) {
    let t0 = 0
    let t1 = 1
    let hit = true

    for (const [p, q] of [
      [-dx, a.x - box.x],
      [dx, box.x + box.w - a.x],
      [-dy, a.y - box.y],
      [dy, box.y + box.h - a.y],
    ]) {
      if (p === 0) {
        // Parallel to this pair of edges: outside them means it can never enter.
        if (q < 0) {
          hit = false
          break
        }
        continue
      }
      const r = q / p
      if (p < 0) {
        if (r > t1) {
          hit = false
          break
        }
        if (r > t0) t0 = r
      } else {
        if (r < t0) {
          hit = false
          break
        }
        if (r < t1) t1 = r
      }
    }
    if (hit && t0 <= t1) return false
  }
  return true
}

/**
 * A route from `a` to `b` that touches nothing on the way.
 *
 * Returns the waypoints to draw through, `a` and `b` included. Falls back to
 * the straight line when there is no way round — a line through a shape is
 * still better than no line at all, and the linter has better things to say
 * about a board that crowded.
 */
export function route(a: Point, b: Point, obstacles: Box[]): Point[] {
  const blockers = obstacles.map((box) => inflate(box, CLEARANCE))

  // The common case, and the one that looks best. Checked first so an
  // unobstructed board pays nothing for the search.
  if (clear(a, b, blockers)) return [a, b]

  // The search area: the two ends plus room to go around whatever is between
  // them, clamped to the obstacles' own extent so it cannot wander off.
  const pad = CELL * 8
  const minX = Math.min(a.x, b.x, ...blockers.map((o) => o.x)) - pad
  const minY = Math.min(a.y, b.y, ...blockers.map((o) => o.y)) - pad
  const maxX = Math.max(a.x, b.x, ...blockers.map((o) => o.x + o.w)) + pad
  const maxY = Math.max(a.y, b.y, ...blockers.map((o) => o.y + o.h)) + pad

  const cols = Math.max(2, Math.ceil((maxX - minX) / CELL))
  const rows = Math.max(2, Math.ceil((maxY - minY) / CELL))
  const centre = (cx: number, cy: number): Point => ({
    x: minX + cx * CELL + CELL / 2,
    y: minY + cy * CELL + CELL / 2,
  })

  const start = {
    x: Math.min(cols - 1, Math.max(0, Math.round((a.x - minX) / CELL))),
    y: Math.min(rows - 1, Math.max(0, Math.round((a.y - minY) / CELL))),
  }
  const goal = {
    x: Math.min(cols - 1, Math.max(0, Math.round((b.x - minX) / CELL))),
    y: Math.min(rows - 1, Math.max(0, Math.round((b.y - minY) / CELL))),
  }

  const blocked = new Uint8Array(cols * rows)
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const p = centre(cx, cy)
      for (const box of blockers) {
        if (inside(p, box)) {
          blocked[cy * cols + cx] = 1
          break
        }
      }
    }
  }
  // The two ends are standing in their own doorways. A route that cannot start
  // is worse than one that starts a pixel inside a shape nobody minds.
  blocked[start.y * cols + start.x] = 0
  blocked[goal.y * cols + goal.x] = 0

  const STEPS: Point[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]
  const total = cols * rows
  const cost = new Float64Array(total).fill(Infinity)
  const cameFrom = new Int32Array(total).fill(-1)
  const facing = new Int8Array(total).fill(-1)
  const startIndex = start.y * cols + start.x
  const goalIndex = goal.y * cols + goal.x
  cost[startIndex] = 0

  // A binary heap would be faster and is not worth the lines: the frontier on
  // a board-sized grid stays in the low hundreds.
  const open: number[] = [startIndex]
  const guess = (i: number) =>
    Math.abs((i % cols) - goal.x) + Math.abs(Math.floor(i / cols) - goal.y)
  let visited = 0

  while (open.length && visited++ < MAX_VISITED) {
    let bestAt = 0
    for (let i = 1; i < open.length; i++) {
      if (cost[open[i]] + guess(open[i]) < cost[open[bestAt]] + guess(open[bestAt])) bestAt = i
    }
    const current = open.splice(bestAt, 1)[0]
    if (current === goalIndex) break

    const cx = current % cols
    const cy = Math.floor(current / cols)
    for (const [dir, step] of STEPS.entries()) {
      const nx = cx + step.x
      const ny = cy + step.y
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
      const next = ny * cols + nx
      if (blocked[next]) continue

      const turned = facing[current] >= 0 && facing[current] !== dir ? TURN_COST : 0
      const candidate = cost[current] + 1 + turned
      if (candidate >= cost[next]) continue

      cost[next] = candidate
      cameFrom[next] = current
      facing[next] = dir
      open.push(next)
    }
  }

  if (cameFrom[goalIndex] < 0 && startIndex !== goalIndex) return [a, b]

  const cells: number[] = []
  for (let at = goalIndex; at >= 0; at = cameFrom[at]) {
    cells.unshift(at)
    if (at === startIndex) break
  }

  // Keep only the corners: a waypoint every 14px is a polyline nobody can draw
  // by hand, and the stroke generator wants segments it can bow.
  const corners: Point[] = []
  for (let i = 0; i < cells.length; i++) {
    const before = cells[i - 1]
    const after = cells[i + 1]
    if (before == null || after == null) {
      corners.push(centre(cells[i] % cols, Math.floor(cells[i] / cols)))
      continue
    }
    const straight =
      (before % cols) + (after % cols) === (cells[i] % cols) * 2 &&
      Math.floor(before / cols) + Math.floor(after / cols) === Math.floor(cells[i] / cols) * 2
    if (!straight) corners.push(centre(cells[i] % cols, Math.floor(cells[i] / cols)))
  }

  return [a, ...corners.slice(1, -1), b]
}
