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

  /* ——— 1 · one command, one crate, two identical machines ——— */
  {
    const { x, y } = station(1)
    phrase(1, 1, 'You run one command.')
    act(beat(1, 2), (e) =>
      code(e, x + 40, y + 60, ['$ docker run myapp', 'Unable to find image locally…', 'Status: container started'], { title: 'terminal' })
    )
    // The subject: an anchor icon with its label centred beneath it.
    act(beat(1, 3), (e) => [
      ...icon(e, 'container', x + 240, y + 330, 200, 'red'),
      ...txt(e, { x: x + 255, y: y + 570, text: 'your container', color: 'red', size: 'm' }),
    ])
    // A symmetric fan: three leader arrows, three labels on one baseline.
    act(beat(1, 4), (e) => [
      ...arrow(e, { from: [x + 280, y + 630], to: [x + 110, y + 680], color: 'green', size: 's' }),
      ...arrow(e, { from: [x + 340, y + 640], to: [x + 340, y + 685], color: 'green', size: 's' }),
      ...arrow(e, { from: [x + 400, y + 630], to: [x + 570, y + 680], color: 'green', size: 's' }),
      ...txt(e, { x: x + 10, y: y + 700, text: 'its own process tree', size: 's' }),
      ...txt(e, { x: x + 210, y: y + 750, text: 'its own network interfaces', size: 's' }),
      ...txt(e, { x: x + 490, y: y + 700, text: 'its own file system', size: 's' }),
    ])
    // Two identical frames on one baseline, the = centred between them.
    act(beat(1, 5), (e) => [
      ...geo(e, { x: x + 840, y: y + 330, w: 380, h: 300, size: 'l' }),
      ...laptop(e, x + 850, y + 350),
      ...txt(e, { x: x + 975, y: y + 660, text: 'your laptop', color: 'grey', size: 's' }),
      ...txt(e, { x: x + 1262, y: y + 440, text: '=', color: 'red', size: 'xl' }),
      ...geo(e, { x: x + 1360, y: y + 330, w: 380, h: 300, size: 'l' }),
      ...slabStack(e, x + 1445, y + 355),
      ...txt(e, { x: x + 1450, y: y + 660, text: 'a production server', color: 'grey', size: 's' }),
    ])
    act(beat(1, 6), (e) =>
      txt(e, { x: x + 1100, y: y + 730, text: 'it spins up, and nobody looks inside', color: 'grey', size: 's' })
    )
    phrase(1, 7, 'Tonight: inside.', 'red')
  }

  /* ——— 2 · the VM: an anatomy tower, costs by repetition, verdicts ——— */
  {
    const { x, y } = station(2)
    phrase(2, 1, 'First suspect:\nthe virtual machine.')
    // The anatomy: one tower of identical boxes, colour-coded per layer.
    const row = (e: Editor, i: number, label: string, tone?: 'red' | 'blue') =>
      geo(e, { x: x + 60, y: y + 150 + i * 112, w: 560, h: 88, text: label, color: tone, size: 's' })
    act(beat(2, 2), (e) => [...row(e, 0, 'your application'), ...row(e, 1, 'a complete operating system', 'red')])
    act(beat(2, 3), (e) => [...row(e, 2, 'hardware drivers', 'red'), ...row(e, 3, 'guest kernel', 'red')])
    act(beat(2, 3, 0.8), (e) => [...row(e, 4, 'hypervisor', 'blue'), ...row(e, 5, 'physical server', 'blue')])
    // The cost: three identical columns, the price stamped above each one.
    act(beat(2, 4), (e) => [
      ...[0, 1, 2].flatMap((i) => [
        ...txt(e, { x: x + 805 + i * 240, y: y + 175, text: '3 GB', color: 'red', size: 'l' }),
        ...geo(e, { x: x + 760 + i * 240, y: y + 260, w: 200, h: 380, size: 'm' }),
        ...geo(e, { x: x + 785 + i * 240, y: y + 550, w: 150, h: 70, text: 'kernel', color: 'red', size: 's' }),
      ]),
      ...geo(e, { x: x + 760, y: y + 680, w: 680, h: 90, text: 'hypervisor', color: 'blue', size: 's' }),
    ])
    // The verdicts: thin arrows fanning to icon-and-caption pairs.
    act(beat(2, 5), (e) => [
      ...arrow(e, { from: [x + 1460, y + 450], to: [x + 1580, y + 330], size: 's' }),
      ...icon(e, 'stopwatch', x + 1620, y + 220, 110),
      ...txt(e, { x: x + 1600, y: y + 360, text: 'a long time to boot', color: 'grey', size: 's' }),
      ...arrow(e, { from: [x + 1460, y + 500], to: [x + 1580, y + 590], size: 's' }),
      ...icon(e, 'shield', x + 1620, y + 480, 100, 'green'),
      ...txt(e, { x: x + 1600, y: y + 610, text: 'it does isolate well', color: 'green', size: 's' }),
    ])
  }

  /* ——— 3 · the container: one anchor bar, annotated from afar ——— */
  {
    const { x, y } = station(3)
    phrase(3, 1, 'A container fakes nothing.', 'red')
    // The subject floats above its ground, label above it.
    act(beat(3, 2), (e) => [
      ...txt(e, { x: x + 275, y: y + 175, text: 'one ordinary process', color: 'red', size: 'm' }),
      ...icon(e, 'container', x + 300, y + 240, 170, 'red'),
    ])
    // The ground: one wide host bar, the kernel chip living inside it.
    act(beat(3, 3), (e) => [
      ...geo(e, { x: x + 60, y: y + 560, w: 1200, h: 120, size: 'l' }),
      ...icon(e, 'processor', x + 880, y + 575, 90, 'blue'),
      ...txt(e, { x: x + 1010, y: y + 600, text: 'THE HOST', color: 'grey', size: 's', mono: true }),
    ])
    // Annotations travel on long leaders; the label rides the connector.
    act(beat(3, 4), (e) => [
      ...arrow(e, { from: [x + 430, y + 420], to: [x + 850, y + 600], color: 'blue', dash: 'dashed', text: 'shared' }),
      ...txt(e, { x: x + 1130, y: y + 220, text: "host's\nkernel", size: 'm' }),
      ...arrow(e, { from: [x + 1160, y + 330], to: [x + 945, y + 570], size: 's' }),
    ])
    // The consequences, in their own far-right column.
    act(beat(3, 5), (e) => [
      ...icon(e, 'stopwatch', x + 1480, y + 300, 130, 'green'),
      ...txt(e, { x: x + 1445, y: y + 470, text: 'starts almost instantly', color: 'green', size: 's' }),
      ...txt(e, { x: x + 1415, y: y + 520, text: 'only the memory it actually uses', color: 'grey', size: 's' }),
    ])
  }

  return acts.sort((a, b) => a.at - b.at)
}
