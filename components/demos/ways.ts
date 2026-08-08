'use client'

import { type Editor, type TLShapeId } from 'tldraw'
import { code, icon } from './svg-cards'
import { WAY_LIST, type WayMeta } from './ways-list'
import { arrow, geo, phraseAct, station, stroke, txt, type Act, type CueSheet, type Tone } from './wall'

/**
 * Ten ways to explain the same thing.
 *
 * The narration is fixed — the first three scenes of the Docker lesson — and
 * each way answers the same question differently: what should be on the wall
 * while those words are spoken? A metaphor, a proof in the shell, a scoreboard,
 * a comic, a race against the clock. Same voice, ten teachers.
 */

interface Kit {
  acts: Act[]
  beat: (scene: number, n: number, delay?: number) => number
  act: (at: number, make: (e: Editor) => TLShapeId[]) => void
  /** A sentence said full screen — the camera shows it alone, then returns. */
  phrase: (scene: number, n: number, text: string, opts?: { color?: Tone; sub?: string; untilN?: number }) => void
}

function kit(sheet: CueSheet): Kit {
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
  const phrase: Kit['phrase'] = (scene, n, text, opts = {}) => {
    const s_ = sheet.scenes[scene - 1]
    if (!s_) return
    slot++
    const at = s_.beats[n - 1] ?? s_.start
    const until = s_.beats[(opts.untilN ?? n + 1) - 1] ?? s_.end
    acts.push(phraseAct({ slot, scene, at, until, text, sub: opts.sub, color: opts.color }))
  }
  return { acts, beat, act, phrase }
}

const done = (acts: Act[]) => acts.sort((a, b) => a.at - b.at)

/* ————————————————————————————————— 1 · metaphor: the shipping crate ————— */

function buildMetaphor(sheet: CueSheet): Act[] {
  const { acts, beat, act, phrase } = kit(sheet)
  {
    const { x, y } = station(1)
    phrase(1, 1, 'Think of it as\na shipping crate.')
    act(beat(1, 2), (e) => [
      ...icon(e, 'container', x + 120, y + 220, 220, 'red'),
      ...txt(e, { x: x + 130, y: y + 480, text: 'your app, packed inside', color: 'red', size: 's' }),
    ])
    act(beat(1, 3), (e) => [
      ...geo(e, { x: x + 70, y: y + 170, w: 330, h: 330, dash: 'dashed', color: 'red' }),
      ...txt(e, { x: x + 90, y: y + 130, text: 'SEALED', color: 'red', size: 's', mono: true }),
    ])
    act(beat(1, 4), (e) => [
      ...geo(e, { x: x + 520, y: y + 200, w: 360, h: 70, text: 'its own shelves — files', size: 's' }),
      ...geo(e, { x: x + 520, y: y + 290, w: 360, h: 70, text: 'its own letterbox — network', size: 's' }),
      ...geo(e, { x: x + 520, y: y + 380, w: 360, h: 70, text: 'its own family — processes', size: 's' }),
    ])
    act(beat(1, 5), (e) => [
      ...txt(e, { x: x + 1050, y: y + 190, text: 'any port, same crate', size: 's' }),
      ...icon(e, 'container', x + 1050, y + 250, 110, 'red'),
      ...arrow(e, { from: [x + 1180, y + 305], to: [x + 1360, y + 305], text: 'ship it' }),
      ...icon(e, 'container', x + 1380, y + 250, 110, 'red'),
      ...txt(e, { x: x + 1050, y: y + 400, text: 'laptop', color: 'grey', size: 's' }),
      ...txt(e, { x: x + 1400, y: y + 400, text: 'server', color: 'grey', size: 's' }),
    ])
    act(beat(1, 6), (e) => [
      ...icon(e, 'happy face', x + 120, y + 570, 96, 'green'),
      ...txt(e, { x: x + 240, y: y + 600, text: 'nobody ever opens the crate', color: 'grey', size: 's' }),
    ])
    act(beat(1, 7), (e) => [
      ...icon(e, 'wrench', x + 900, y + 560, 100),
      ...txt(e, { x: x + 1020, y: y + 590, text: "tonight we pry the lid off", size: 'm' }),
    ])
  }
  {
    const { x, y } = station(2)
    phrase(2, 1, 'A virtual machine is\na house inside your house.')
    act(beat(2, 2), (e) => [
      ...stroke(e, [[x + 60, y + 420], [x + 60, y + 200], [x + 300, y + 110], [x + 540, y + 200], [x + 540, y + 420], [x + 60, y + 420]], { size: 'm' }),
      ...txt(e, { x: x + 130, y: y + 440, text: 'your house — the host', color: 'grey', size: 's' }),
      ...stroke(e, [[x + 180, y + 380], [x + 180, y + 280], [x + 300, y + 230], [x + 420, y + 280], [x + 420, y + 380], [x + 180, y + 380]], { color: 'red' }),
      ...txt(e, { x: x + 205, y: y + 305, text: 'a whole second\nhouse inside', color: 'red', size: 's' }),
    ])
    act(beat(2, 3), (e) => [
      ...txt(e, { x: x + 700, y: y + 180, text: 'its own plumbing — a kernel', size: 's' }),
      ...txt(e, { x: x + 700, y: y + 240, text: 'its own wiring — drivers', size: 's' }),
      ...txt(e, { x: x + 700, y: y + 300, text: 'its own roof — a whole OS', size: 's' }),
      ...stroke(e, [[x + 560, y + 300], [x + 680, y + 210]], { color: 'grey', dash: 'dashed' }),
    ])
    act(beat(2, 4), (e) => [
      ...[0, 1, 2].flatMap((i) =>
        stroke(e, [[x + 1150 + i * 170, y + 330], [x + 1150 + i * 170, y + 240], [x + 1215 + i * 170, y + 205], [x + 1280 + i * 170, y + 240], [x + 1280 + i * 170, y + 330], [x + 1150 + i * 170, y + 330]], { color: 'red' })
      ),
      ...txt(e, { x: x + 1150, y: y + 360, text: 'three houses — three foundations poured', color: 'red', size: 's' }),
    ])
    act(beat(2, 5), (e) => [
      ...icon(e, 'scales', x + 1150, y + 470, 100),
      ...txt(e, { x: x + 1270, y: y + 500, text: 'very private — but heavy, and slow to build', color: 'grey', size: 's' }),
    ])
  }
  {
    const { x, y } = station(3)
    phrase(3, 1, 'A container is a tent\npitched on your floor.', { color: 'red' })
    act(beat(3, 2), (e) => [
      ...stroke(e, [[x + 100, y + 420], [x + 240, y + 220], [x + 380, y + 420], [x + 100, y + 420]], { color: 'red', size: 'm' }),
      ...txt(e, { x: x + 120, y: y + 450, text: 'no foundation to pour', color: 'red', size: 's' }),
    ])
    act(beat(3, 3), (e) => [
      ...icon(e, 'person', x + 205, y + 300, 90, 'red'),
      ...txt(e, { x: x + 520, y: y + 300, text: 'to the house, it is just another occupant —', size: 's' }),
      ...txt(e, { x: x + 520, y: y + 350, text: 'a process', size: 'l' }),
    ])
    act(beat(3, 4), (e) => [
      ...stroke(e, [[x + 60, y + 560], [x + 1000, y + 560]], { size: 'm' }),
      ...txt(e, { x: x + 70, y: y + 580, text: 'THE FLOOR — ONE SHARED KERNEL', color: 'grey', size: 's', mono: true }),
      ...arrow(e, { from: [x + 240, y + 430], to: [x + 240, y + 550], color: 'blue', dash: 'dashed' }),
    ])
    act(beat(3, 5), (e) => [
      ...icon(e, 'stopwatch', x + 1150, y + 300, 130, 'green'),
      ...txt(e, { x: x + 1130, y: y + 460, text: 'up in a blink,', color: 'green', size: 's' }),
      ...txt(e, { x: x + 1130, y: y + 505, text: 'folds away to nothing', color: 'green', size: 's' }),
    ])
  }
  return done(acts)
}

/* ——————————————————————————— 2 · architect: strict boxes and arrows ————— */

function buildArchitect(sheet: CueSheet): Act[] {
  const { acts, beat, act, phrase } = kit(sheet)
  const box = (e: Editor, bx: number, by: number, w: number, h: number, label: string, tone?: 'red' | 'blue' | 'grey' | 'green') =>
    geo(e, { x: bx, y: by, w, h, text: label, color: tone, size: 's', dash: 'solid' })
  {
    const { x, y } = station(1)
    phrase(1, 1, 'The system,\nas boxes and arrows.')
    act(beat(1, 2), (e) => [
      ...box(e, x + 40, y + 180, 300, 90, 'Dockerfile'),
      ...arrow(e, { from: [x + 340, y + 225], to: [x + 430, y + 225], text: 'build', size: 's' }),
      ...box(e, x + 440, y + 180, 300, 90, 'image'),
      ...arrow(e, { from: [x + 740, y + 225], to: [x + 830, y + 225], text: 'run', size: 's' }),
      ...box(e, x + 840, y + 180, 300, 90, 'container', 'red'),
    ])
    act(beat(1, 3), (e) => [
      ...geo(e, { x: x + 800, y: y + 140, w: 380, h: 460, dash: 'dashed', color: 'grey' }),
      ...txt(e, { x: x + 810, y: y + 610, text: 'ISOLATION BOUNDARY', color: 'grey', size: 's', mono: true }),
    ])
    act(beat(1, 4), (e) => [
      ...box(e, x + 840, y + 310, 300, 70, 'rootfs', 'red'),
      ...box(e, x + 840, y + 400, 300, 70, 'net stack', 'red'),
      ...box(e, x + 840, y + 490, 300, 70, 'pid tree', 'red'),
    ])
    act(beat(1, 5), (e) => [
      ...box(e, x + 1290, y + 250, 260, 80, 'laptop', 'grey'),
      ...box(e, x + 1290, y + 370, 260, 80, 'server', 'grey'),
      ...arrow(e, { from: [x + 1280, y + 290], to: [x + 1190, y + 270], color: 'grey', size: 's' }),
      ...arrow(e, { from: [x + 1280, y + 410], to: [x + 1190, y + 450], color: 'grey', size: 's' }),
      ...txt(e, { x: x + 1290, y: y + 480, text: 'same artifact deployed', color: 'grey', size: 's' }),
    ])
    act(beat(1, 7), (e) => [
      ...box(e, x + 260, y + 420, 380, 100, 'WHAT BUILDS THIS BOUNDARY?', 'red'),
      ...arrow(e, { from: [x + 640, y + 470], to: [x + 795, y + 440], color: 'red' }),
    ])
  }
  {
    const { x, y } = station(2)
    const layers = ['guest app', 'guest OS', 'guest kernel', 'hypervisor', 'hardware']
    phrase(2, 1, 'Architecture A —\nthe virtual machine.')
    act(beat(2, 2), (e) =>
      layers.slice(0, 2).flatMap((l, i) => box(e, x + 60, y + 180 + i * 95, 420, 80, l, i ? 'red' : undefined))
    )
    act(beat(2, 3), (e) =>
      layers.slice(2).flatMap((l, i) => box(e, x + 60, y + 370 + i * 95, 420, 80, l, i === 0 ? 'red' : 'blue'))
    )
    act(beat(2, 4), (e) => [
      ...[0, 1, 2].flatMap((i) => box(e, x + 640 + i * 200, y + 250, 170, 220, `VM ${i + 1}\n—\nkernel`, 'red')),
      ...box(e, x + 640, y + 500, 570, 80, 'one hypervisor', 'blue'),
    ])
    act(beat(2, 5), (e) => [
      ...txt(e, { x: x + 1330, y: y + 300, text: '3 × resident kernels', color: 'red', size: 'm' }),
      ...txt(e, { x: x + 1330, y: y + 360, text: '3 × full boot sequences', color: 'red', size: 'm' }),
    ])
  }
  {
    const { x, y } = station(3)
    phrase(3, 1, 'Architecture B —\nthe container.', { color: 'red' })
    act(beat(3, 2), (e) => [
      ...geo(e, { x: x + 60, y: y + 180, w: 420, h: 90, text: 'app (a process)', color: 'red', size: 's', dash: 'solid' }),
      ...txt(e, { x: x + 520, y: y + 205, text: '← no guest OS, no guest kernel', color: 'green', size: 's' }),
    ])
    act(beat(3, 4), (e) => [
      ...geo(e, { x: x + 60, y: y + 300, w: 420, h: 90, text: 'host kernel', color: 'blue', size: 's', dash: 'solid' }),
      ...geo(e, { x: x + 60, y: y + 420, w: 420, h: 90, text: 'hardware', size: 's', dash: 'solid' }),
      ...[0, 1, 2].flatMap((i) => geo(e, { x: x + 640 + i * 200, y: y + 180, w: 170, h: 90, text: `app ${i + 1}`, color: 'red', size: 's', dash: 'solid' })),
      ...geo(e, { x: x + 640, y: y + 300, w: 570, h: 90, text: 'ONE shared kernel', color: 'blue', size: 's', dash: 'solid' }),
      ...[0, 1, 2].map((i) => arrow(e, { from: [x + 725 + i * 200, y + 270], to: [x + 850, y + 300], color: 'blue', size: 's', head: false })).flat(),
    ])
    act(beat(3, 5), (e) => [
      ...txt(e, { x: x + 640, y: y + 440, text: 'layers removed: 3', color: 'green', size: 'm' }),
      ...txt(e, { x: x + 640, y: y + 500, text: 'boot sequences: 0', color: 'green', size: 'm' }),
    ])
  }
  return done(acts)
}

/* ————————————————————————————— 3 · terminal: prove it in the shell ————— */

function buildTerminal(sheet: CueSheet): Act[] {
  const { acts, beat, act, phrase } = kit(sheet)
  {
    const { x, y } = station(1)
    phrase(1, 1, 'No diagrams.\nJust a shell.')
    act(beat(1, 2), (e) => code(e, x + 40, y + 150, ['$ docker run -d myapp', 'b41f9c02ab31   # running'], { title: 'session 1 — start it' }))
    act(beat(1, 3), (e) => code(e, x + 40, y + 390, ['$ docker exec myapp ls /', 'app  bin  etc  lib  usr'], { title: 'its own filesystem' }))
    act(beat(1, 4), (e) => code(e, x + 620, y + 150, ['$ docker exec myapp ps', '  PID  COMM', '    1  python3'], { title: 'its own process tree' }))
    act(beat(1, 5), (e) => code(e, x + 620, y + 430, ['laptop$  uname -m → x86_64', 'server$  uname -m → x86_64', '# same image, same behaviour'], { title: 'both machines' }))
    act(beat(1, 7), (e) => [
      ...txt(e, { x: x + 1250, y: y + 300, text: 'every demo stops here.', color: 'grey', size: 's' }),
      ...txt(e, { x: x + 1250, y: y + 350, text: 'we type on.', color: 'red', size: 'l' }),
    ])
  }
  {
    const { x, y } = station(2)
    phrase(2, 1, 'The same checks,\nagainst a VM.')
    act(beat(2, 2), (e) => code(e, x + 40, y + 150, ['$ virsh start ubuntu-vm', 'Domain ubuntu-vm started'], { title: 'start one' }))
    act(beat(2, 3), (e) => code(e, x + 40, y + 380, ['[    0.00] Booting Linux 5.15…', '[    4.20] loading 214 drivers', '[   26.80] reached multi-user.target'], { title: 'watch it boot' }))
    act(beat(2, 4), (e) => code(e, x + 750, y + 150, ['$ free -h   # three VMs idle', '              used', 'Mem:          9.2Gi'], { title: 'the bill' }))
    act(beat(2, 5), (e) => [
      ...txt(e, { x: x + 750, y: y + 430, text: '27 seconds. nine gigabytes. idle.', color: 'red', size: 'm' }),
    ])
  }
  {
    const { x, y } = station(3)
    phrase(3, 1, 'Now look at the container\nfrom OUTSIDE.', { color: 'red' })
    act(beat(3, 3), (e) => code(e, x + 40, y + 150, ['host$ ps aux | grep python', 'root  4512  … python3 app.py'], { title: 'it is right there' }))
    act(beat(3, 3, 0.9), (e) =>
      txt(e, { x: x + 40, y: y + 380, text: 'no VM hides its guests like this — it is a process on the host', color: 'red', size: 's' })
    )
    act(beat(3, 4), (e) => code(e, x + 750, y + 150, ['host$ uname -r    → 6.1.0', '$ docker exec myapp uname -r', '6.1.0             # same kernel!'], { title: 'one kernel, shared' }))
    act(beat(3, 5), (e) => [
      ...code(e, x + 750, y + 440, ['$ time docker run myapp true', 'real    0m0.31s'], { title: 'and the clock' }),
      ...txt(e, { x: x + 40, y: y + 470, text: 'a process, dressed up as a machine.', size: 'm' }),
    ])
  }
  return done(acts)
}

/* ———————————————————————————————— 4 · versus: one filling scoreboard ——— */

function buildVersus(sheet: CueSheet): Act[] {
  const { acts, beat, act, phrase } = kit(sheet)
  const { x, y } = station(1)
  const row = (e: Editor, i: number, label: string, vm: string, ct: string, toneVm?: 'red' | 'green' | 'grey', toneCt?: 'red' | 'green' | 'grey') => [
    ...txt(e, { x: x + 60, y: y + 265 + i * 90, text: label, size: 's' }),
    ...geo(e, { x: x + 640, y: y + 240 + i * 90, w: 380, h: 70, text: vm, color: toneVm ?? 'grey', size: 's' }),
    ...geo(e, { x: x + 1060, y: y + 240 + i * 90, w: 380, h: 70, text: ct, color: toneCt ?? 'grey', size: 's' }),
  ]
  phrase(1, 1, 'Two suspects,\none scoreboard.')
  act(beat(1, 2), (e) => [
    ...geo(e, { x: x + 640, y: y + 150, w: 380, h: 70, text: 'VIRTUAL MACHINE', color: 'blue', size: 's' }),
    ...geo(e, { x: x + 1060, y: y + 150, w: 380, h: 70, text: 'CONTAINER', color: 'red', size: 's' }),
  ])
  act(beat(1, 3), (e) => row(e, 0, 'seals your code off', '✓', '✓', 'green', 'green'))
  act(beat(1, 4), (e) => row(e, 1, 'own files · net · pids', '✓', '✓', 'green', 'green'))
  act(beat(1, 5), (e) => row(e, 2, 'same on any machine', '✓', '✓', 'green', 'green'))
  act(beat(1, 7), (e) => [
    ...txt(e, { x: x + 640, y: y + 520, text: 'so far identical — so are they the same thing?', color: 'red', size: 'm' }),
  ])
  phrase(2, 1, 'Round two:\nwhat it costs.')
  act(beat(2, 3), (e) => row(e, 5, 'boots an operating system', 'yes — all of it', '?', 'red', 'grey'))
  act(beat(2, 4), (e) => row(e, 6, 'kernels in memory (×3 apps)', 'three', '?', 'red', 'grey'))
  act(beat(2, 5), (e) => row(e, 7, 'cost', 'GBs · minutes', '?', 'red', 'grey'))
  act(beat(3, 2), (e) => [
    ...geo(e, { x: x + 1060, y: y + 690, w: 380, h: 70, text: 'no OS at all', color: 'green', size: 's' }),
  ])
  act(beat(3, 4), (e) => [
    ...geo(e, { x: x + 1060, y: y + 780, w: 380, h: 70, text: 'zero — borrows the host’s', color: 'green', size: 's' }),
  ])
  act(beat(3, 5), (e) =>
    geo(e, { x: x + 1060, y: y + 870, w: 380, h: 70, text: 'MBs · milliseconds', color: 'green', size: 's' })
  )
  phrase(3, 5, 'Not a small VM.\nA different species: a process.', { color: 'red', untilN: 6 })
  return done(acts)
}

/* ————————————————————— 5 · one picture, progressively annotated ———————— */

function buildOnePicture(sheet: CueSheet): Act[] {
  const { acts, beat, act, phrase } = kit(sheet)
  const { x, y } = station(1)
  phrase(1, 1, 'One drawing.\nWe annotate it for a minute.')
  act(beat(1, 1), (e) => [
    ...geo(e, { x: x + 60, y: y + 160, w: 1100, h: 640, size: 'm' }),
    ...txt(e, { x: x + 80, y: y + 820, text: 'YOUR MACHINE', color: 'grey', size: 's', mono: true }),
    ...geo(e, { x: x + 60, y: y + 690, w: 1100, h: 110, text: 'kernel', color: 'blue', size: 's' }),
  ])
  act(beat(1, 2), (e) => [
    ...icon(e, 'container', x + 170, y + 380, 160, 'red'),
    ...txt(e, { x: x + 160, y: y + 570, text: 'your app', color: 'red', size: 's' }),
  ])
  act(beat(1, 3), (e) =>
    geo(e, { x: x + 120, y: y + 330, w: 260, h: 300, dash: 'dashed', color: 'red' })
  )
  act(beat(1, 4), (e) => [
    ...txt(e, { x: x + 430, y: y + 350, text: 'sees only its own files', size: 's' }),
    ...txt(e, { x: x + 430, y: y + 410, text: 'its own network', size: 's' }),
    ...txt(e, { x: x + 430, y: y + 470, text: 'its own process list', size: 's' }),
    ...stroke(e, [[x + 385, y + 400], [x + 425, y + 375]], { color: 'grey', dash: 'dashed' }),
  ])
  act(beat(1, 5), (e) => [
    ...geo(e, { x: x + 1260, y: y + 330, w: 300, h: 300, dash: 'dashed', color: 'red' }),
    ...icon(e, 'container', x + 1330, y + 400, 140, 'red'),
    ...txt(e, { x: x + 1270, y: y + 660, text: 'the same dashed box,\non any other machine', color: 'grey', size: 's' }),
  ])
  act(beat(1, 7), (e) => [
    ...txt(e, { x: x + 430, y: y + 560, text: 'what IS the dashed line?', color: 'red', size: 'm' }),
    ...arrow(e, { from: [x + 430, y + 585], to: [x + 385, y + 590], color: 'red' }),
  ])
  phrase(2, 1, 'First guess:\nis it a little virtual machine?')
  act(beat(2, 2), (e) => [
    ...geo(e, { x: x + 620, y: y + 200, w: 480, h: 460, dash: 'dashed', color: 'grey' }),
    ...txt(e, { x: x + 640, y: y + 220, text: 'IF it were a VM…', color: 'grey', size: 's', mono: true }),
    ...geo(e, { x: x + 660, y: y + 540, w: 400, h: 90, text: 'its OWN kernel', color: 'grey', size: 's' }),
  ])
  act(beat(2, 3), (e) => [
    ...geo(e, { x: x + 660, y: y + 430, w: 400, h: 90, text: 'a whole guest OS', color: 'grey', size: 's' }),
    ...geo(e, { x: x + 660, y: y + 320, w: 400, h: 90, text: 'drivers, boot, init…', color: 'grey', size: 's' }),
  ])
  act(beat(2, 5), (e) =>
    txt(e, { x: x + 620, y: y + 690, text: 'that would mean GBs of memory and minutes of boot — inside this box', color: 'red', size: 's' })
  )
  act(beat(3, 2), (e) => [
    ...stroke(e, [[x + 620, y + 200], [x + 1100, y + 660]], { color: 'red', size: 'm' }),
    ...stroke(e, [[x + 1100, y + 200], [x + 620, y + 660]], { color: 'red', size: 'm' }),
  ])
  act(beat(3, 3), (e) => [
    ...geo(e, { x: x + 100, y: y + 310, w: 300, h: 340, kind: 'ellipse', color: 'green' }),
    ...txt(e, { x: x + 120, y: y + 260, text: 'just a process', color: 'green', size: 'm' }),
  ])
  act(beat(3, 4), (e) =>
    arrow(e, { from: [x + 250, y + 655], to: [x + 250, y + 690], color: 'blue', text: '', head: true })
  )
  act(beat(3, 4, 0.4), (e) =>
    txt(e, { x: x + 320, y: y + 655, text: 'runs on the one kernel already there', color: 'blue', size: 's' })
  )
  act(beat(3, 5), (e) =>
    txt(e, { x: x + 60, y: y + 970, text: 'no boot, no second OS — the dashed line must be something cheaper. (that story is next.)', color: 'grey', size: 's' })
  )
  return done(acts)
}

/* ———————————————————————————————————— 6 · comic: a story in panels ————— */

function buildComic(sheet: CueSheet): Act[] {
  const { acts, beat, act, phrase } = kit(sheet)
  const panel = (e: Editor, px: number, py: number, caption: string): TLShapeId[] => [
    ...geo(e, { x: px, y: py, w: 360, h: 330, size: 's' }),
    ...txt(e, { x: px + 14, y: py + 345, text: caption, color: 'grey', size: 's' }),
  ]
  {
    const { x, y } = station(1)
    phrase(1, 1, 'Meet your app.')
    act(beat(1, 2), (e) => [
      ...panel(e, x + 40, y + 150, 'it runs happily on your laptop'),
      ...icon(e, 'happy face', x + 160, y + 240, 120, 'green'),
    ])
    act(beat(1, 3), (e) => [
      ...panel(e, x + 460, y + 150, 'docker run — now it lives in a box'),
      ...icon(e, 'happy face', x + 580, y + 240, 120, 'green'),
      ...geo(e, { x: x + 540, y: y + 210, w: 200, h: 190, color: 'red', dash: 'dashed' }),
    ])
    act(beat(1, 4), (e) => [
      ...panel(e, x + 880, y + 150, 'the box has everything it needs'),
      ...txt(e, { x: x + 940, y: y + 220, text: 'files ✓', size: 's' }),
      ...txt(e, { x: x + 940, y: y + 280, text: 'network ✓', size: 's' }),
      ...txt(e, { x: x + 940, y: y + 340, text: 'processes ✓', size: 's' }),
    ])
    act(beat(1, 5), (e) => [
      ...panel(e, x + 1300, y + 150, 'ship the box — still happy'),
      ...icon(e, 'server', x + 1360, y + 250, 100),
      ...icon(e, 'happy face', x + 1500, y + 250, 100, 'green'),
    ])
    act(beat(1, 7), (e) => [
      ...icon(e, 'neutral face', x + 120, y + 590, 100),
      ...txt(e, { x: x + 250, y: y + 620, text: '“…but what IS the box?” — tonight, we open it.', size: 'm' }),
    ])
  }
  {
    const { x, y } = station(2)
    phrase(2, 1, "The box's big cousin:\nthe VM.")
    act(beat(2, 2), (e) => [
      ...panel(e, x + 40, y + 150, 'the VM brings its own EVERYTHING'),
      ...icon(e, 'vm', x + 100, y + 230, 110, 'blue'),
      ...icon(e, 'kernel', x + 250, y + 230, 110, 'blue'),
    ])
    act(beat(2, 4), (e) => [
      ...panel(e, x + 460, y + 150, 'the host carries three of them'),
      ...icon(e, 'sad face', x + 520, y + 240, 110, 'red'),
      ...txt(e, { x: x + 660, y: y + 260, text: '3 × kernels\non my back!', color: 'red', size: 's' }),
    ])
    act(beat(2, 3), (e) => [
      ...panel(e, x + 880, y + 150, '…meanwhile, still booting'),
      ...icon(e, 'hourglass', x + 990, y + 240, 120, 'red'),
    ])
    act(beat(2, 5), (e) => [
      ...panel(e, x + 1300, y + 150, 'but nobody gets through the walls'),
      ...icon(e, 'shield', x + 1420, y + 240, 120, 'green'),
    ])
  }
  {
    const { x, y } = station(3)
    phrase(3, 1, 'Our box travels light.', { color: 'red' })
    act(beat(3, 2), (e) => [
      ...panel(e, x + 40, y + 150, '“no OS in my luggage”'),
      ...icon(e, 'happy face', x + 150, y + 240, 110, 'green'),
      ...icon(e, 'package', x + 290, y + 260, 80, 'red'),
    ])
    act(beat(3, 4), (e) => [
      ...panel(e, x + 460, y + 150, 'host and box share one kernel'),
      ...icon(e, 'happy face', x + 520, y + 240, 100, 'green'),
      ...icon(e, 'kernel', x + 680, y + 240, 100, 'blue'),
      ...arrow(e, { from: [x + 630, y + 290], to: [x + 675, y + 290], color: 'blue', size: 's' }),
    ])
    act(beat(3, 5), (e) => [
      ...panel(e, x + 880, y + 150, 'ready before you blink'),
      ...icon(e, 'stopwatch', x + 990, y + 240, 120, 'green'),
      ...txt(e, { x: x + 1310, y: y + 280, text: 'THE END\n(of the easy part)', size: 'm' }),
    ])
  }
  return done(acts)
}

/* —————————————————————————————— 7 · recipe: steps with checkmarks ——————— */

function buildRecipe(sheet: CueSheet): Act[] {
  const { acts, beat, act, phrase } = kit(sheet)
  const step = (e: Editor, sx: number, sy: number, n: string, label: string, glyph: string, tone?: 'red' | 'green' | 'blue' | 'grey') => [
    ...geo(e, { x: sx, y: sy, w: 64, h: 64, kind: 'ellipse', text: n, size: 's', color: tone }),
    ...icon(e, glyph, sx + 90, sy - 8, 80, tone ?? 'black'),
    ...txt(e, { x: sx + 195, y: sy + 12, text: label, size: 's' }),
  ]
  {
    const { x, y } = station(1)
    phrase(1, 1, 'The whole trick,\nas a recipe.')
    act(beat(1, 2), (e) => [
      ...step(e, x + 60, y + 180, '1', 'write a Dockerfile', 'document'),
      ...step(e, x + 60, y + 290, '2', 'build an image', 'layers'),
      ...step(e, x + 60, y + 400, '3', 'run the container', 'container', 'red'),
    ])
    act(beat(1, 4), (e) => [
      ...txt(e, { x: x + 800, y: y + 170, text: 'what comes out of the oven:', color: 'grey', size: 's' }),
      ...txt(e, { x: x + 800, y: y + 230, text: '✓ its own files', color: 'green', size: 's' }),
      ...txt(e, { x: x + 800, y: y + 285, text: '✓ its own network', color: 'green', size: 's' }),
      ...txt(e, { x: x + 800, y: y + 340, text: '✓ its own process list', color: 'green', size: 's' }),
    ])
    act(beat(1, 5), (e) => step(e, x + 60, y + 510, '4', 'serve on any machine — tastes identical', 'globe', 'green'))
    act(beat(1, 7), (e) =>
      txt(e, { x: x + 800, y: y + 480, text: 'but no one ever reads the ingredients. we will.', color: 'red', size: 'm' })
    )
  }
  {
    const { x, y } = station(2)
    phrase(2, 1, 'Recipe for\na virtual machine:')
    act(beat(2, 2), (e) => step(e, x + 60, y + 180, '1', 'reserve gigabytes of memory', 'ram', 'red'))
    act(beat(2, 3), (e) => [
      ...step(e, x + 60, y + 290, '2', 'boot an entire kernel  (minutes)', 'kernel', 'red'),
      ...step(e, x + 60, y + 400, '3', 'load drivers, init, services…', 'gear', 'red'),
    ])
    act(beat(2, 4), (e) => step(e, x + 60, y + 510, '4', 'repeat for EVERY app on the machine', 'people', 'red'))
    act(beat(2, 5), (e) =>
      code(e, x + 900, y + 250, ['memory   3 GB  × N', 'boot     ~30 s × N', 'isolation      strong'], { title: 'the bill' })
    )
  }
  {
    const { x, y } = station(3)
    phrase(3, 1, 'Recipe for a container:', { color: 'red' })
    act(beat(3, 3), (e) => [
      ...step(e, x + 60, y + 180, '1', 'start the process.', 'container', 'green'),
      ...txt(e, { x: x + 330, y: y + 250, text: "(that's the whole recipe)", color: 'grey', size: 's' }),
    ])
    act(beat(3, 2), (e) => [
      ...txt(e, { x: x + 60, y: y + 340, text: 'boot an OS', color: 'grey', size: 's' }),
      ...stroke(e, [[x + 55, y + 358], [x + 265, y + 358]], { color: 'red' }),
      ...txt(e, { x: x + 60, y: y + 395, text: 'bring a kernel', color: 'grey', size: 's' }),
      ...stroke(e, [[x + 55, y + 413], [x + 300, y + 413]], { color: 'red' }),
    ])
    act(beat(3, 4), (e) => [
      ...txt(e, { x: x + 60, y: y + 470, text: 'borrow instead: the host kernel is already hot', color: 'blue', size: 's' }),
      ...icon(e, 'kernel', x + 700, y + 445, 84, 'blue'),
    ])
    act(beat(3, 5), (e) =>
      code(e, x + 900, y + 250, ['memory   just the app', 'boot     ~0.3 s', 'weight         a process'], { title: 'the bill, again' })
    )
  }
  return done(acts)
}

/* ———————————————————————————— 8 · socratic: questions, then answers ——— */

function buildSocratic(sheet: CueSheet): Act[] {
  const { acts, beat, act, phrase } = kit(sheet)
  const qa = (e: Editor, qx: number, qy: number, q: string, a?: string, tone: 'red' | 'green' | 'blue' = 'red'): TLShapeId[] => [
    ...geo(e, { x: qx, y: qy, w: 560, h: 90, kind: 'cloud', text: q, size: 's' }),
    ...(a ? txt(e, { x: qx + 40, y: qy + 115, text: '— ' + a, color: tone, size: 'm' }) : []),
  ]
  {
    const { x, y } = station(1)
    phrase(1, 1, 'Interrogate the thing\nyou use every day.')
    act(beat(1, 2), (e) => qa(e, x + 40, y + 160, 'where does your code run?', 'in a container', 'red'))
    act(beat(1, 3), (e) => qa(e, x + 40, y + 400, 'what can it see?', 'only itself — files, network, processes', 'red'))
    act(beat(1, 5), (e) => qa(e, x + 720, y + 160, 'laptop or production — any difference?', 'none it can detect', 'green'))
    act(beat(1, 6), (e) => qa(e, x + 720, y + 400, 'and do we ever ask how?', 'almost never', 'blue'))
    phrase(1, 7, 'So: what IS a container,\nreally?', { color: 'red' })
  }
  {
    const { x, y } = station(2)
    phrase(2, 1, 'First hypothesis:\nis it a small virtual machine?')
    act(beat(2, 2), (e) =>
      txt(e, { x: x + 80, y: y + 200, text: 'a VM: hypervisor + a fully simulated computer', size: 's' })
    )
    act(beat(2, 3), (e) =>
      txt(e, { x: x + 80, y: y + 260, text: 'it boots a kernel, drivers, a whole OS — top to bottom', size: 's' })
    )
    act(beat(2, 4), (e) => [
      ...geo(e, { x: x + 800, y: y + 200, w: 640, h: 160, text: 'evidence against:\n3 apps would mean 3 kernels in RAM', color: 'red', size: 's' }),
    ])
    act(beat(2, 5), (e) =>
      txt(e, { x: x + 80, y: y + 430, text: 'if a container were a VM, it would cost gigabytes and minutes. it does not.', color: 'red', size: 'm' })
    )
  }
  {
    const { x, y } = station(3)
    phrase(3, 1, 'Then what is left?', { color: 'red' })
    act(beat(3, 3), (e) => [
      ...txt(e, { x: x + 80, y: y + 200, text: 'a normal Linux process', size: 'l' }),
      ...geo(e, { x: x + 60, y: y + 185, w: 560, h: 90, kind: 'ellipse', color: 'green' }),
    ])
    act(beat(3, 4), (e) => qa(e, x + 800, y + 170, 'running on whose kernel?', "the host's — shared with everything else", 'blue'))
    act(beat(3, 5), (e) => [
      ...txt(e, { x: x + 80, y: y + 420, text: 'which sharpens the real question:', color: 'grey', size: 's' }),
      ...txt(e, { x: x + 80, y: y + 475, text: 'how does a mere process get its own world?', size: 'm' }),
    ])
  }
  return done(acts)
}

/* ——————————————————————————————— 9 · the race: two lanes, one clock ——— */

function buildRace(sheet: CueSheet): Act[] {
  const { acts, beat, act, phrase } = kit(sheet)
  {
    const { x, y } = station(1)
    phrase(1, 1, 'Put docker run\non a stopwatch.')
    act(beat(1, 2), (e) => [
      ...stroke(e, [[x + 60, y + 300], [x + 1500, y + 300]], { size: 'm' }),
      ...stroke(e, [[x + 60, y + 280], [x + 60, y + 320]]),
      ...txt(e, { x: x + 40, y: y + 340, text: 't = 0\n$ docker run', size: 's', mono: true }),
    ])
    act(beat(1, 3), (e) => [
      ...stroke(e, [[x + 420, y + 280], [x + 420, y + 320]]),
      ...txt(e, { x: x + 380, y: y + 220, text: '+0.1s image ready', color: 'grey', size: 's' }),
    ])
    act(beat(1, 4), (e) => [
      ...stroke(e, [[x + 700, y + 280], [x + 700, y + 320]]),
      ...icon(e, 'container', x + 660, y + 160, 90, 'red'),
      ...txt(e, { x: x + 640, y: y + 340, text: '+0.3s sealed world, running', color: 'red', size: 's' }),
    ])
    act(beat(1, 5), (e) =>
      txt(e, { x: x + 1000, y: y + 220, text: 'same two ticks on the laptop, same on the server', color: 'grey', size: 's' })
    )
    phrase(1, 7, 'A whole machine\nin 0.3 seconds?', { color: 'red', sub: 'something is being skipped — rewind, slow-motion' })
  }
  {
    const { x, y } = station(2)
    phrase(2, 1, 'Same clock,\na virtual machine.')
    act(beat(2, 2), (e) => [
      ...stroke(e, [[x + 60, y + 260], [x + 1500, y + 260]], { size: 'm' }),
      ...txt(e, { x: x + 60, y: y + 190, text: 'VM LANE', color: 'grey', size: 's', mono: true }),
      ...stroke(e, [[x + 60, y + 240], [x + 60, y + 280]]),
      ...txt(e, { x: x + 45, y: y + 300, text: 'power on', size: 's' }),
    ])
    act(beat(2, 3), (e) => [
      ...stroke(e, [[x + 480, y + 240], [x + 480, y + 280]]),
      ...txt(e, { x: x + 420, y: y + 300, text: '+9s kernel up', color: 'red', size: 's' }),
      ...stroke(e, [[x + 900, y + 240], [x + 900, y + 280]]),
      ...txt(e, { x: x + 830, y: y + 300, text: '+18s drivers', color: 'red', size: 's' }),
      ...stroke(e, [[x + 1320, y + 240], [x + 1320, y + 280]]),
      ...txt(e, { x: x + 1230, y: y + 300, text: '+27s OS ready', color: 'red', size: 's' }),
      ...icon(e, 'hourglass', x + 1420, y + 160, 80, 'red'),
    ])
    act(beat(2, 4), (e) => [
      ...txt(e, { x: x + 60, y: y + 420, text: '× three VMs — three of these lanes, three kernels held in memory', color: 'red', size: 's' }),
      ...geo(e, { x: x + 60, y: y + 480, w: 900, h: 46, text: '9 GB before any real work', color: 'red', size: 's' }),
    ])
    act(beat(2, 5), (e) =>
      txt(e, { x: x + 1050, y: y + 480, text: '…but the walls are thick.', color: 'grey', size: 's' })
    )
  }
  {
    const { x, y } = station(3)
    phrase(3, 1, 'Back to\nthe container lane.', { color: 'green' })
    act(beat(3, 2), (e) => [
      ...stroke(e, [[x + 60, y + 260], [x + 1500, y + 260]], { size: 'm' }),
      ...txt(e, { x: x + 60, y: y + 190, text: 'CONTAINER LANE', color: 'grey', size: 's', mono: true }),
      ...stroke(e, [[x + 60, y + 240], [x + 60, y + 280]]),
      ...stroke(e, [[x + 160, y + 240], [x + 160, y + 280]]),
      ...txt(e, { x: x + 130, y: y + 300, text: '+0.3s running', color: 'green', size: 's' }),
    ])
    act(beat(3, 2, 0.6), (e) =>
      txt(e, { x: x + 420, y: y + 220, text: 'the boot segment simply is not there', color: 'green', size: 's' })
    )
    act(beat(3, 4), (e) => [
      ...geo(e, { x: x + 60, y: y + 420, w: 1440, h: 70, text: 'ONE kernel lane, underneath everyone', color: 'blue', size: 's' }),
      ...arrow(e, { from: [x + 160, y + 290], to: [x + 300, y + 415], color: 'blue', dash: 'dashed', size: 's' }),
    ])
    act(beat(3, 5), (e) => [
      ...icon(e, 'stopwatch', x + 1250, y + 150, 100, 'green'),
      ...txt(e, { x: x + 60, y: y + 540, text: 'it wins because it never entered the boot race — it is a process on that blue lane.', size: 's' }),
    ])
  }
  return done(acts)
}

/* ————————————————————————————— 10 · poster: five words at a time ——————— */

function buildPoster(sheet: CueSheet): Act[] {
  const { acts, beat, act, phrase } = kit(sheet)
  {
    const { x, y } = station(1)
    phrase(1, 1, 'You use it every day.', { sub: 'but what is it?' })
    act(beat(1, 2), (e) => [
      ...txt(e, { x: x + 40, y: y + 120, text: 'SEALED.', size: 'xl' }),
      ...icon(e, 'container', x + 460, y + 115, 110, 'red'),
    ])
    act(beat(1, 4), (e) =>
      txt(e, { x: x + 44, y: y + 280, text: 'files · network · processes: its own', color: 'grey', size: 's', mono: true })
    )
    act(beat(1, 5), (e) => txt(e, { x: x + 40, y: y + 360, text: 'RUNS ANYWHERE.', size: 'xl' }))
    act(beat(1, 6), (e) => txt(e, { x: x + 44, y: y + 520, text: 'everyone stops here.', color: 'grey', size: 's' }))
    act(beat(1, 7), (e) => [
      ...txt(e, { x: x + 40, y: y + 580, text: "WE WON'T.", color: 'red', size: 'xl' }),
      ...stroke(e, [[x + 44, y + 700], [x + 640, y + 700]], { color: 'red', size: 'm' }),
    ])
  }
  {
    const { x, y } = station(2)
    act(beat(2, 2), (e) => [
      ...txt(e, { x: x + 40, y, text: 'A VM: A FAKE COMPUTER.', size: 'xl' }),
      ...icon(e, 'vm', x + 40, y + 160, 110, 'blue'),
    ])
    act(beat(2, 3), (e) => txt(e, { x: x + 40, y: y + 320, text: 'BOOTS. A WHOLE. OS.', size: 'xl' }))
    act(beat(2, 4), (e) => txt(e, { x: x + 40, y: y + 480, text: '×3 APPS = ×3 KERNELS.', color: 'red', size: 'xl' }))
    act(beat(2, 5), (e) => [
      ...txt(e, { x: x + 40, y: y + 640, text: 'HEAVY. SLOW. SAFE.', color: 'red', size: 'xl' }),
      ...txt(e, { x: x + 44, y: y + 760, text: '(3 GB · 30 s — each)', color: 'grey', size: 's', mono: true }),
    ])
  }
  {
    const { x, y } = station(3)
    act(beat(3, 2), (e) => txt(e, { x: x + 40, y, text: 'A CONTAINER: NO BOOT.', size: 'xl' }))
    act(beat(3, 3), (e) => [
      ...txt(e, { x: x + 40, y: y + 160, text: 'A PROCESS.', color: 'red', size: 'xl' }),
      ...stroke(e, [[x + 44, y + 280], [x + 700, y + 280]], { color: 'red', size: 'm' }),
    ])
    act(beat(3, 4), (e) => [
      ...txt(e, { x: x + 40, y: y + 330, text: 'ONE KERNEL, SHARED.', color: 'blue', size: 'xl' }),
      ...icon(e, 'kernel', x + 40, y + 470, 100, 'blue'),
    ])
    act(beat(3, 5), (e) => [
      ...txt(e, { x: x + 40, y: y + 620, text: 'INSTANT.', color: 'green', size: 'xl' }),
      ...txt(e, { x: x + 44, y: y + 750, text: '(0.3 s · just the memory it uses)', color: 'grey', size: 's', mono: true }),
    ])
  }
  return done(acts)
}

/* ————————————————————————————————————————————————————— the registry ——— */

export interface Way extends WayMeta {
  build: (sheet: CueSheet) => Act[]
}

const BUILDS: Record<string, (sheet: CueSheet) => Act[]> = {
  metaphor: buildMetaphor,
  architect: buildArchitect,
  terminal: buildTerminal,
  versus: buildVersus,
  'one-picture': buildOnePicture,
  comic: buildComic,
  recipe: buildRecipe,
  socratic: buildSocratic,
  race: buildRace,
  poster: buildPoster,
}

export const WAYS: Way[] = WAY_LIST.map((meta) => ({ ...meta, build: BUILDS[meta.slug] }))
