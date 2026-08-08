'use client'

import { type Editor, type TLShapeId } from 'tldraw'
import { code, icon } from './svg-cards'
import { arrow, geo, phraseAct, station, stroke, txt, type Act, type CueSheet } from './wall'

/**
 * test-1 — the panelled night board.
 *
 * The grammar of the reference sketch: a dark navy board, each idea framed in
 * its own white panel, the subject always in yellow, mint arrows fanning out
 * to labels, and big hand-drawn illustrations doing the arguing — a laptop, a
 * stack of slabs — with as little text as the narration allows.
 *
 * Semantic tones here: red = the subject (mapped to yellow on this board),
 * green = connective tissue (mapped to mint), black = white structure.
 */

/** A framed panel — the unit of grouping on this board. */
const panel = (e: Editor, x: number, y: number, w: number, h: number): TLShapeId[] =>
  geo(e, { x, y, w, h, size: 'l' })

/** A big hand-drawn laptop, ~460 wide. */
function laptop(e: Editor, x: number, y: number): TLShapeId[] {
  return [
    ...stroke(e, [[x + 70, y + 150], [x + 95, y + 10], [x + 330, y + 30], [x + 315, y + 170], [x + 70, y + 150]], { size: 'm' }),
    ...stroke(e, [[x + 70, y + 150], [x + 0, y + 250], [x + 380, y + 275], [x + 315, y + 170]], { size: 'm' }),
    ...stroke(e, [[x + 60, y + 190], [x + 350, y + 210]]),
    ...stroke(e, [[x + 40, y + 225], [x + 365, y + 245]]),
    ...stroke(e, [[x + 120, y + 165], [x + 80, y + 260]]),
    ...stroke(e, [[x + 200, y + 172], [x + 185, y + 265]]),
    ...stroke(e, [[x + 280, y + 178], [x + 290, y + 268]]),
  ]
}

/** A stack of three hand-drawn slabs — the server rack of the sketch. */
function slabStack(e: Editor, x: number, y: number): TLShapeId[] {
  const slab = (sx: number, sy: number, tilt: number): TLShapeId[] =>
    stroke(e, [[sx, sy + 10 + tilt], [sx + 10, sy], [sx + 190, sy + tilt], [sx + 195, sy + 60 + tilt], [sx + 8, sy + 68], [sx, sy + 10 + tilt]], { size: 'm' })
  return [
    ...slab(x + 18, y, -6),
    ...slab(x, y + 85, 5),
    ...slab(x + 10, y + 170, -4),
  ]
}

/** A hand-drawn desktop computer — monitor on a foot. */
function desktop(e: Editor, x: number, y: number, w = 300): TLShapeId[] {
  const h = w * 0.72
  return [
    ...stroke(e, [[x, y], [x + w, y + w * 0.04], [x + w * 0.97, y + h], [x + w * 0.03, y + h * 0.97], [x, y]], { size: 'm' }),
    ...stroke(e, [[x + w * 0.42, y + h], [x + w * 0.38, y + h + 40], [x + w * 0.25, y + h + 46], [x + w * 0.75, y + h + 52], [x + w * 0.62, y + h + 42], [x + w * 0.58, y + h + 2]]),
  ]
}

export function buildTest1(sheet: CueSheet): Act[] {
  const acts: Act[] = []
  let slot = 0
  const beat = (scene: number, n: number, delay = 0) => {
    const s_ = sheet.scenes[scene - 1]
    if (!s_) return NaN
    return (s_.beats[n - 1] ?? s_.start) + delay
  }
  const act = (at: number, make: (e: Editor) => TLShapeId[]) => {
    if (Number.isFinite(at)) acts.push({ at, make })
  }
  const phrase = (scene: number, n: number, text: string, color?: 'red' | 'green') => {
    const s_ = sheet.scenes[scene - 1]
    if (!s_) return
    slot++
    acts.push(
      phraseAct({
        slot, scene, text, color,
        at: s_.beats[n - 1] ?? s_.start,
        until: s_.beats[n] ?? s_.end,
      })
    )
  }

  /* ——— 1 · the command, the crate, the two machines ——— */
  {
    const { x, y } = station(1)
    phrase(1, 1, 'You run one command.')
    act(beat(1, 2), (e) =>
      code(e, x + 760, y + 40, ['$ docker run myapp', 'Unable to find image locally…', 'Status: container started'], { title: 'terminal' })
    )
    act(beat(1, 3), (e) => [
      ...panel(e, x + 40, y + 40, 640, 560),
      ...icon(e, 'container', x + 250, y + 100, 180, 'red'),
      ...txt(e, { x: x + 240, y: y + 300, text: 'your container', color: 'red', size: 'm' }),
    ])
    act(beat(1, 4), (e) => [
      ...arrow(e, { from: [x + 300, y + 370], to: [x + 150, y + 460], color: 'green', size: 's' }),
      ...txt(e, { x: x + 75, y: y + 480, text: 'its own process tree', size: 's' }),
      ...arrow(e, { from: [x + 330, y + 375], to: [x + 350, y + 490], color: 'green', size: 's' }),
      ...txt(e, { x: x + 270, y: y + 515, text: 'its own network interfaces', size: 's' }),
      ...arrow(e, { from: [x + 360, y + 365], to: [x + 520, y + 445], color: 'green', size: 's' }),
      ...txt(e, { x: x + 445, y: y + 465, text: 'its own file system', size: 's' }),
    ])
    act(beat(1, 5), (e) => [
      ...panel(e, x + 760, y + 340, 420, 340),
      ...laptop(e, x + 780, y + 380),
      ...txt(e, { x: x + 850, y: y + 700, text: 'your laptop', color: 'grey', size: 's' }),
      ...txt(e, { x: x + 1220, y: y + 480, text: '=', color: 'red', size: 'xl' }),
      ...panel(e, x + 1330, y + 340, 420, 340),
      ...slabStack(e, x + 1430, y + 380),
      ...txt(e, { x: x + 1385, y: y + 700, text: 'a production server', color: 'grey', size: 's' }),
    ])
    act(beat(1, 6), (e) =>
      txt(e, { x: x + 760, y: y + 760, text: 'it spins up, and nobody looks inside', color: 'grey', size: 's' })
    )
    phrase(1, 7, 'Tonight: inside.', 'red')
  }

  /* ——— 2 · the virtual machine, faked whole ——— */
  {
    const { x, y } = station(2)
    phrase(2, 1, 'First suspect:\nthe virtual machine.')
    act(beat(2, 2), (e) => [
      ...panel(e, x + 40, y + 40, 620, 620),
      ...desktop(e, x + 150, y + 110, 380),
      ...txt(e, { x: x + 130, y: y + 570, text: 'a whole computer, faked', color: 'red', size: 'm' }),
    ])
    act(beat(2, 3), (e) => [
      ...slabStack(e, x + 210, y + 150),
      ...txt(e, { x: x + 470, y: y + 180, text: 'its own kernel', size: 's' }),
      ...txt(e, { x: x + 470, y: y + 260, text: 'a whole OS', size: 's' }),
      ...txt(e, { x: x + 470, y: y + 345, text: 'every driver', size: 's' }),
    ])
    act(beat(2, 4), (e) => [
      ...panel(e, x + 760, y + 40, 620, 400),
      ...desktop(e, x + 800, y + 100, 150),
      ...desktop(e, x + 990, y + 105, 150),
      ...desktop(e, x + 1180, y + 110, 150),
      ...txt(e, { x: x + 800, y: y + 360, text: 'three machines — three kernels held in memory', color: 'red', size: 's' }),
    ])
    act(beat(2, 5), (e) => [
      ...icon(e, 'hourglass', x + 790, y + 500, 110, 'red'),
      ...txt(e, { x: x + 930, y: y + 520, text: 'gigabytes of memory', size: 's' }),
      ...txt(e, { x: x + 930, y: y + 570, text: 'minutes of booting', size: 's' }),
      ...txt(e, { x: x + 930, y: y + 630, text: 'thick walls, though', color: 'green', size: 's' }),
    ])
  }

  /* ——— 3 · the container, carrying nothing ——— */
  {
    const { x, y } = station(3)
    phrase(3, 1, 'A container fakes nothing.', 'red')
    act(beat(3, 2), (e) => [
      ...panel(e, x + 40, y + 40, 520, 460),
      ...icon(e, 'container', x + 170, y + 120, 220, 'red'),
      ...txt(e, { x: x + 130, y: y + 400, text: 'no OS in here — just your app', color: 'red', size: 's' }),
    ])
    act(beat(3, 3), (e) => [
      ...panel(e, x + 680, y + 40, 520, 460),
      ...icon(e, 'person', x + 840, y + 130, 190),
      ...txt(e, { x: x + 740, y: y + 400, text: 'to the machine: one more process', size: 's' }),
    ])
    act(beat(3, 4), (e) => [
      ...geo(e, { x: x + 40, y: y + 600, w: 1160, h: 110, text: 'THE HOST KERNEL — ONE, SHARED', size: 's' }),
      ...arrow(e, { from: [x + 300, y + 505], to: [x + 300, y + 595], color: 'green' }),
      ...arrow(e, { from: [x + 940, y + 505], to: [x + 940, y + 595], color: 'green' }),
    ])
    act(beat(3, 5), (e) => [
      ...icon(e, 'stopwatch', x + 1340, y + 180, 150, 'green'),
      ...txt(e, { x: x + 1310, y: y + 370, text: 'starts in milliseconds,', color: 'green', size: 's' }),
      ...txt(e, { x: x + 1310, y: y + 415, text: 'weighs what your app weighs', color: 'green', size: 's' }),
    ])
  }

  return acts.sort((a, b) => a.at - b.at)
}
