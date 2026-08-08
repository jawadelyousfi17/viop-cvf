'use client'

import { type Editor, type TLShapeId } from 'tldraw'
import { code, icon } from './svg-cards'
import {
  arrow,
  geo,
  station,
  stroke,
  txt,
  type Act,
  type CueSheet,
  type Tone,
} from './wall'

/**
 * The Docker lesson, station by station.
 */

/* ------------------------------------------------------------- the mural */

export function buildActs(sheet: CueSheet): Act[] {
  const acts: Act[] = []
  const beat = (scene: number, n: number, delay = 0) => {
    const s_ = sheet.scenes[scene - 1]
    return (s_?.beats[n - 1] ?? s_?.start ?? 0) + delay
  }
  const act = (at: number, make: (e: Editor) => TLShapeId[]) => acts.push({ at, make })

  /** The plain-words opening line every station gets instead of a title. */
  const opening = (scene: number, text: string) => {
    const { x, y } = station(scene)
    act(beat(scene, 1), (e) => txt(e, { x, y, text, size: 'l' }))
  }

  /* ——— 1 · behind the command ——— */
  {
    const { x, y } = station(1)
    opening(1, 'You run one command — and your code is suddenly sealed off.')
    act(beat(1, 1, 0.4), (e) =>
      code(e, x + 40, y + 170, ['$ docker run myapp', 'Unable to find image locally…', 'Status: container started'], { title: 'terminal' })
    )
    act(beat(1, 2), (e) => [
      ...icon(e, 'container', x + 90, y + 420, 170, 'red'),
      ...txt(e, { x: x + 60, y: y + 620, text: 'your container', color: 'red' }),
    ])
    act(beat(1, 3), (e) =>
      txt(e, { x: x + 60, y: y + 680, text: 'cut off from the rest of the machine', color: 'grey', size: 's' })
    )
    act(beat(1, 4), (e) => [
      ...txt(e, { x: x + 360, y: y + 430, text: 'its own file system', size: 's' }),
      ...txt(e, { x: x + 360, y: y + 490, text: 'its own network interfaces', size: 's' }),
      ...txt(e, { x: x + 360, y: y + 550, text: 'its own process tree', size: 's' }),
      ...stroke(e, [[x + 280, y + 445], [x + 350, y + 445]], { color: 'grey' }),
      ...stroke(e, [[x + 280, y + 505], [x + 350, y + 505]], { color: 'grey' }),
      ...stroke(e, [[x + 280, y + 565], [x + 350, y + 565]], { color: 'grey' }),
    ])
    act(beat(1, 5), (e) => [
      ...geo(e, { x: x + 950, y: y + 300, w: 300, h: 140, text: 'your laptop', size: 's' }),
      ...txt(e, { x: x + 1280, y: y + 350, text: '=', color: 'red', size: 'xl' }),
      ...geo(e, { x: x + 1370, y: y + 300, w: 320, h: 140, text: 'a production server', size: 's' }),
    ])
    act(beat(1, 6), (e) =>
      txt(e, { x: x + 950, y: y + 500, text: 'as long as it spins up, nobody looks underneath', color: 'grey', size: 's' })
    )
    act(beat(1, 7), (e) =>
      txt(e, { x: x + 950, y: y + 590, text: 'so what is under there?', color: 'red', size: 'l' })
    )
  }

  /* ——— 2 · a whole computer, simulated ——— */
  {
    const { x, y } = station(2)
    opening(2, 'A virtual machine fakes a whole computer.')
    const stack = [
      ['Physical server', 'blue'], ['Hypervisor', 'blue'], ['Guest kernel', 'red'],
      ['Hardware drivers', 'red'], ['A complete operating system', 'red'], ['Your application', 'black'],
    ] as const
    stack.forEach(([label, tone], i) => {
      act(beat(2, i < 2 ? 2 : 3, i * 0.28), (e) =>
        geo(e, { x: x + 40, y: y + 170 + (stack.length - 1 - i) * 92, w: 540, h: 78, text: label, color: tone as Tone, size: 's' })
      )
    })
    for (const i of [0, 1, 2]) {
      act(beat(2, 4, i * 0.3), (e) => [
        ...geo(e, { x: x + 700 + i * 160, y: y + 170 + i * 20, w: 130, h: 520, color: 'grey', size: 's' }),
        ...geo(e, { x: x + 715 + i * 160, y: y + 480 + i * 20, w: 100, h: 60, text: 'kernel', color: 'red', size: 's' }),
      ])
    }
    act(beat(2, 4, 1.1), (e) =>
      txt(e, { x: x + 700, y: y + 750, text: 'three machines — three whole kernels in memory', color: 'red', size: 's' })
    )
    act(beat(2, 5), (e) => [
      ...txt(e, { x: x + 1330, y: y + 200, text: '3 GB', color: 'red', size: 'xl' }),
      ...txt(e, { x: x + 1330, y: y + 280, text: 'of memory, each', color: 'grey', size: 's' }),
      ...icon(e, 'stopwatch', x + 1330, y + 340, 130),
      ...txt(e, { x: x + 1330, y: y + 500, text: 'a long time to boot', color: 'grey', size: 's' }),
      ...icon(e, 'shield', x + 1330, y + 570, 96, 'green'),
      ...txt(e, { x: x + 1330, y: y + 690, text: 'it does isolate well', color: 'green', size: 's' }),
    ])
  }

  /* ——— 3 · just a process ——— */
  {
    const { x, y } = station(3)
    opening(3, 'A container boots nothing. It is just a process.')
    act(beat(3, 1, 0.3), (e) => [
      ...txt(e, { x: x + 4, y: y + 95, text: 'no operating system to boot, no kernel of its own', color: 'grey', size: 's' }),
      ...stroke(e, [[x + 40, y + 700], [x + 1700, y + 700]], { size: 'm' }),
      ...txt(e, { x: x + 40, y: y + 720, text: 'THE HOST', color: 'grey', size: 's', mono: true }),
    ])
    act(beat(3, 2), (e) => [
      ...icon(e, 'container', x + 180, y + 470, 200, 'red'),
      ...txt(e, { x: x + 150, y: y + 410, text: 'one ordinary process', color: 'red' }),
    ])
    act(beat(3, 4), (e) => [
      ...icon(e, 'processor', x + 800, y + 490, 180, 'blue'),
      ...txt(e, { x: x + 790, y: y + 720, text: 'the host kernel', color: 'blue' }),
      ...arrow(e, { from: [x + 400, y + 570], to: [x + 790, y + 580], text: 'shared', color: 'blue', dash: 'dashed', head: false }),
    ])
    act(beat(3, 5), (e) => [
      ...icon(e, 'stopwatch', x + 1280, y + 430, 150),
      ...txt(e, { x: x + 1240, y: y + 600, text: 'starts almost instantly —', color: 'green' }),
      ...txt(e, { x: x + 1240, y: y + 655, text: 'only the memory it actually uses', color: 'grey', size: 's' }),
    ])
  }

  /* ——— 4 · everyone can see everyone ——— */
  {
    const { x, y } = station(4)
    opening(4, 'Problem: processes on Linux can see each other.')
    const dots: [number, number][] = [
      [x + 260, y + 320], [x + 470, y + 250], [x + 690, y + 330], [x + 900, y + 260],
      [x + 1090, y + 340], [x + 450, y + 470], [x + 820, y + 480],
    ]
    dots.forEach(([dx, dy], i) => {
      act(beat(4, 1, 0.3 + i * 0.12), (e) =>
        geo(e, { x: dx - 16, y: dy - 16, w: 32, h: 32, kind: 'ellipse', size: 's' })
      )
    })
    dots.slice(1).forEach(([dx, dy], i) => {
      act(beat(4, 2, i * 0.12), (e) =>
        stroke(e, [[dots[0][0], dots[0][1]], [dx, dy]], { color: 'grey', dash: 'dashed' })
      )
    })
    act(beat(4, 3), (e) =>
      txt(e, { x: x + 260, y: y + 560, text: 'same file system · same interfaces · same hostname', color: 'grey', size: 's' })
    )
    act(beat(4, 4), (e) => [
      ...icon(e, 'bricks', x + 200, y + 250, 150, 'red'),
      ...txt(e, { x: x + 150, y: y + 430, text: 'unless a wall goes up', color: 'red', size: 's' }),
    ])
    act(beat(4, 5), (e) => [
      ...txt(e, { x: x + 1280, y: y + 420, text: 'namespaces', color: 'red', size: 'xl' }),
      ...txt(e, { x: x + 1280, y: y + 500, text: 'the kernel blocks its view of everything else', color: 'grey', size: 's' }),
    ])
    act(beat(4, 6), (e) =>
      txt(e, { x: x + 1280, y: y + 560, text: 'they control sight — not appetite', color: 'grey', size: 's' })
    )
  }

  /* ——— 5 · one process, two realities ——— */
  {
    const { x, y } = station(5)
    opening(5, 'The PID namespace puts a wall around what it sees.')
    act(beat(5, 2, 0.3), (e) =>
      code(e, x + 40, y + 180, [
        '$ ps -eo pid,comm',
        '    1  systemd',
        '  842  sshd',
        ' 1204  cron',
        ' 4500  python3   ← your web server',
        ' 5120  postgres',
      ], { title: 'on the host' })
    )
    act(beat(5, 4), (e) =>
      txt(e, { x: x + 60, y: y + 470, text: 'it can see all of this', color: 'red', size: 's' })
    )
    act(beat(5, 5), (e) => icon(e, 'bricks', x + 575, y + 240, 150, 'red'))
    act(beat(5, 6), (e) =>
      txt(e, { x: x + 505, y: y + 430, text: 'the kernel filters the answer', color: 'red', size: 's' })
    )
    act(beat(5, 7), (e) =>
      code(e, x + 900, y + 180, ['$ ps -eo pid,comm', '    1  python3'], { title: 'inside the namespace' })
    )
    act(beat(5, 8), (e) => [
      ...txt(e, { x: x + 920, y: y + 390, text: 'PID 1', color: 'red', size: 'xl' }),
      ...txt(e, { x: x + 1140, y: y + 418, text: '— and PID 4500 on the host', color: 'blue', size: 's' }),
    ])
    act(beat(5, 9), (e) => [
      ...txt(e, { x: x + 920, y: y + 510, text: 'the same process,', size: 'm' }),
      ...txt(e, { x: x + 920, y: y + 565, text: 'experiencing a different reality', color: 'grey', size: 'm' }),
    ])
  }

  /* ——— 6 · and the rest of them ——— */
  {
    const { x, y } = station(6)
    opening(6, 'And there is a namespace for every other kind of seeing.')
    const kinds = [
      ['mount', 'its own view of the file system'],
      ['network', 'a private network stack'],
      ['UTS', 'its own hostname'],
      ['IPC', 'its own message queues'],
      ['user', 'root inside, nobody outside'],
    ] as const
    kinds.forEach(([name, what], i) => {
      act(beat(6, 2 + i), (e) => [
        ...icon(e, 'bricks', x + 40, y + 170 + i * 122, 64, 'red'),
        ...txt(e, { x: x + 150, y: y + 180 + i * 122, text: name, size: 'l' }),
        ...txt(e, { x: x + 540, y: y + 198 + i * 122, text: what, color: 'grey', size: 's' }),
        ...stroke(e, [[x + 40, y + 258 + i * 122], [x + 1130, y + 258 + i * 122]], { color: 'grey' }),
      ])
    })
    act(beat(6, 7), (e) => [
      ...icon(e, 'container', x + 1350, y + 300, 190, 'red'),
      ...txt(e, { x: x + 1300, y: y + 540, text: 'combined, it genuinely believes', size: 's' }),
      ...txt(e, { x: x + 1300, y: y + 590, text: 'it has the whole computer', size: 's' }),
    ])
  }

  /* ——— 7 · seeing is not consuming ——— */
  {
    const { x, y } = station(7)
    opening(7, 'Namespaces control sight — not appetite.')
    act(beat(7, 2), (e) => [
      ...icon(e, 'container', x + 80, y + 240, 160, 'red'),
      ...icon(e, 'gauge', x + 330, y + 240, 160, 'red'),
      ...txt(e, { x: x + 70, y: y + 450, text: 'isolated — and still able to eat', color: 'red', size: 's' }),
      ...txt(e, { x: x + 70, y: y + 500, text: 'every CPU on the host', color: 'red', size: 's' }),
    ])
    act(beat(7, 3), (e) => [
      ...txt(e, { x: x + 760, y: y + 110, text: 'cgroups', color: 'orange', size: 'xl' }),
      ...txt(e, { x: x + 1090, y: y + 138, text: '— control groups', color: 'grey', size: 's' }),
    ])
    act(beat(7, 4), (e) => [
      ...geo(e, { x: x + 760, y: y + 220, w: 740, h: 120, text: 'namespaces — restrict what it can SEE', color: 'red', size: 's' }),
      ...geo(e, { x: x + 760, y: y + 380, w: 740, h: 120, text: 'cgroups — restrict what it can USE', color: 'orange', size: 's' }),
    ])
    act(beat(7, 5), (e) =>
      code(e, x + 760, y + 560, ['$ docker run --memory=512m --cpus=2 myapp'], { title: 'the flags that write them' })
    )
  }

  /* ——— 8 · a number in a file ——— */
  {
    const { x, y } = station(8)
    opening(8, 'A cgroup limit is a number written into a file.')
    act(beat(8, 2, 0.3), (e) =>
      code(e, x + 40, y + 170, [
        '/sys/fs/cgroup/docker/a3f9…/',
        '$ echo 536870912 > memory.max',
        '$ cat memory.current',
        '212422656',
      ], { title: 'the whole mechanism' })
    )
    act(beat(8, 2, 2.5), (e) =>
      txt(e, { x: x + 40, y: y + 480, text: 'a number, written into a file', color: 'grey', size: 's' })
    )
    act(beat(8, 3), (e) => [
      ...icon(e, 'gauge', x + 850, y + 190, 210, 'orange'),
      ...txt(e, { x: x + 820, y: y + 440, text: 'the kernel tracks every byte', color: 'grey', size: 's' }),
    ])
    act(beat(8, 4), (e) =>
      geo(e, { x: x + 1250, y: y + 180, w: 460, h: 100, text: 'over the limit? reclaim first', color: 'orange', size: 's' })
    )
    act(beat(8, 5), (e) => [
      ...arrow(e, { from: [x + 1480, y + 290], to: [x + 1480, y + 360], color: 'red' }),
      ...geo(e, { x: x + 1250, y: y + 370, w: 460, h: 100, text: 'not enough? kill the process', color: 'red', size: 's' }),
    ])
    act(beat(8, 6), (e) =>
      txt(e, { x: x + 850, y: y + 570, text: 'one runaway container cannot starve the server', color: 'green' })
    )
  }

  /* ——— 9 · it still needs a root ——— */
  {
    const { x, y } = station(9)
    opening(9, 'The process still needs a root directory of its own.')
    const rows = [
      ['/', 0], ['etc/', 1], ['usr/', 1], ['srv/', 1], ['app/', 2], ['bin/', 3], ['lib/', 3], ['app.py', 3],
    ] as const
    rows.forEach(([name, d], i) => {
      act(beat(9, 1, 0.3 + i * 0.2), (e) =>
        txt(e, { x: x + 60 + d * 70, y: y + 165 + i * 62, text: name, size: 's', mono: true })
      )
    })
    act(beat(9, 1, 0.5), (e) => [
      ...stroke(e, [[x + 72, y + 210], [x + 72, y + 380]], { color: 'grey' }),
      ...stroke(e, [[x + 142, y + 400], [x + 142, y + 445]], { color: 'grey' }),
      ...stroke(e, [[x + 212, y + 460], [x + 212, y + 630]], { color: 'grey' }),
    ])
    act(beat(9, 2), (e) =>
      txt(e, { x: x + 160, y: y + 160, text: '← we cannot lend it this one', color: 'red', size: 's' })
    )
    act(beat(9, 3), (e) => [
      ...txt(e, { x: x + 850, y: y + 190, text: 'chroot', size: 'xl' }),
      ...txt(e, { x: x + 850, y: y + 140, text: 'LONG BEFORE DOCKER', color: 'grey', size: 's', mono: true }),
    ])
    act(beat(9, 4), (e) => [
      ...geo(e, { x: x + 110, y: y + 380, w: 430, h: 320, color: 'red', size: 'l' }),
      ...geo(e, { x: x + 82, y: y + 352, w: 56, h: 56, kind: 'ellipse', color: 'red', text: '/', size: 's' }),
      ...code(e, x + 850, y + 260, ['$ chroot /srv/app /bin/sh', '$ ls /', 'bin/  lib/  app.py'], { title: 'as far as it knows' }),
    ])
    act(beat(9, 5), (e) =>
      txt(e, { x: x + 850, y: y + 540, text: 'but there is one major problem', color: 'grey', size: 's' })
    )
    act(beat(9, 6), (e) =>
      txt(e, { x: x + 850, y: y + 600, text: 'never a security boundary', color: 'red', size: 'l' })
    )
    act(beat(9, 7), (e) => [
      ...arrow(e, { from: [x + 440, y + 600], to: [x + 700, y + 400], bend: -70, color: 'red', size: 'l' }),
      ...txt(e, { x: x + 430, y: y + 310, text: 'running as root, it climbs back out', color: 'red', size: 's' }),
    ])
  }

  /* ——— 10 · swap the root entirely ——— */
  {
    const { x, y } = station(10)
    opening(10, 'pivot_root swaps the root out entirely.')
    act(beat(10, 1, 0.4), (e) =>
      code(e, x + 40, y + 170, ['pivot_root("/newroot", "/put_old")', 'umount2("/put_old", MNT_DETACH)'], { title: 'the system calls' })
    )
    act(beat(10, 2), (e) => [
      ...geo(e, { x: x + 40, y: y + 420, w: 560, h: 100, text: 'chroot — restricts the view', color: 'grey', size: 's' }),
      ...geo(e, { x: x + 40, y: y + 550, w: 560, h: 100, text: 'pivot_root — replaces the root', color: 'blue', size: 's' }),
    ])
    act(beat(10, 3), (e) => [
      ...geo(e, { x: x + 1380, y: y + 200, w: 340, h: 420, color: 'grey', dash: 'dashed', text: "the host's original tree", size: 's' }),
      ...txt(e, { x: x + 1390, y: y + 650, text: 'safely disconnected', color: 'grey', size: 's' }),
    ])
    act(beat(10, 4), (e) => [
      ...geo(e, { x: x + 760, y: y + 200, w: 460, h: 560, color: 'blue', size: 'l' }),
      ...txt(e, { x: x + 780, y: y + 150, text: 'THE NEW ROOT', color: 'grey', size: 's', mono: true }),
    ])
    act(beat(10, 5), (e) =>
      txt(e, { x: x + 800, y: y + 240, text: 'but it cannot be empty', color: 'red', size: 's' })
    )
    ;['/bin', '/lib', '/usr', 'your app'].forEach((name, i) => {
      act(beat(10, 6, i * 0.25), (e) =>
        geo(e, { x: x + 800, y: y + 310 + i * 105, w: 380, h: 84, text: name, color: 'blue', size: 's' })
      )
    })
    act(beat(10, 6, 1.5), (e) => [
      ...icon(e, 'layers', x + 1300, y + 700, 100, 'blue'),
      ...txt(e, { x: x + 1420, y: y + 720, text: 'a docker image is exactly that, pre-filled', size: 's' }),
    ])
  }

  /* ——— 11 · a stack of layers ——— */
  {
    const { x, y } = station(11)
    opening(11, 'An image is a stack of layers.')
    act(beat(11, 2), (e) =>
      code(e, x + 40, y + 170, [
        'FROM python:3.12',
        'RUN pip install -r requirements.txt',
        'COPY . /app',
        'ENV PORT=8000',
        'CMD ["python", "app.py"]',
      ], { title: 'dockerfile' })
    )
    const layers = [
      ['FROM — the base image', 5], ['RUN — the dependencies', 6], ['COPY — your source code', 7],
    ] as const
    layers.forEach(([label, b], i) => {
      act(beat(11, b as number), (e) => [
        ...geo(e, { x: x + 700, y: y + 480 - i * 105, w: 560, h: 88, text: label, size: 's', align: 'start' }),
        ...arrow(e, { from: [x + 500, y + 240 + i * 40], to: [x + 690, y + 500 - i * 105], color: 'grey', dash: 'dashed', size: 's' }),
      ])
    })
    act(beat(11, 8), (e) =>
      txt(e, { x: x + 700, y: y + 610, text: 'ENV and CMD add nothing — they only attach settings', color: 'grey', size: 's' })
    )
    act(beat(11, 10), (e) => [
      ...txt(e, { x: x + 1380, y: y + 260, text: 'overlayfs', color: 'blue', size: 'l' }),
      ...arrow(e, { from: [x + 1270, y + 300], to: [x + 1420, y + 380], color: 'blue', bend: 20 }),
    ])
    act(beat(11, 10, 0.8), (e) =>
      geo(e, { x: x + 1330, y: y + 400, w: 380, h: 120, text: 'one merged file system', color: 'blue', size: 's' })
    )
  }

  /* ——— 12 · frozen, plus one thin layer ——— */
  {
    const { x, y } = station(12)
    opening(12, 'The layers are frozen — you write on one thin sheet on top.')
    for (const i of [0, 1, 2]) {
      act(beat(12, 1, 0.3 + i * 0.2), (e) =>
        geo(e, { x: x + 40, y: y + 500 - i * 100, w: 620, h: 84, text: 'read-only layer', color: 'grey', size: 's', align: 'start' })
      )
    }
    act(beat(12, 2), (e) =>
      geo(e, { x: x + 40, y: y + 180, w: 620, h: 54, text: 'thin writable layer', color: 'red', size: 's', align: 'start' })
    )
    act(beat(12, 3), (e) => icon(e, 'document', x + 720, y + 440, 110))
    act(beat(12, 4), (e) =>
      arrow(e, { from: [x + 770, y + 430], to: [x + 770, y + 250], bend: 50, color: 'red', text: 'copy-up' })
    )
    act(beat(12, 5), (e) => [
      ...txt(e, { x: x + 40, y: y + 640, text: 'the original is never touched —', color: 'red', size: 's' }),
      ...txt(e, { x: x + 40, y: y + 690, text: 'the new version simply hides it', color: 'grey', size: 's' }),
    ])
    for (let i = 0; i < 10; i++) {
      act(beat(12, 7, i * 0.08), (e) =>
        icon(e, 'container', x + 1000 + (i % 5) * 140, y + 200 + Math.floor(i / 5) * 130, 92, 'red')
      )
    }
    act(beat(12, 7, 0.9), (e) => [
      ...txt(e, { x: x + 1000, y: y + 480, text: 'ten containers — one copy of the layers,', color: 'green', size: 's' }),
      ...txt(e, { x: x + 1000, y: y + 530, text: 'shared on disk and in memory', color: 'grey', size: 's' }),
    ])
    act(beat(12, 8), (e) =>
      code(e, x + 1000, y + 610, ['# change a line near the top of the Dockerfile', '# → that layer and every one below it rebuilds'], { title: 'why order matters' })
    )
  }

  /* ——— 13 · a cable to a switch ——— */
  {
    const { x, y } = station(13)
    opening(13, 'Networking: a virtual cable into a virtual switch.')
    act(beat(13, 3), (e) =>
      txt(e, { x: x + 4, y: y + 95, text: 'its own network stack — and no interface at all', color: 'grey', size: 's' })
    )
    act(beat(13, 2), (e) => [
      ...icon(e, 'container', x + 80, y + 380, 170, 'red'),
      ...txt(e, { x: x + 60, y: y + 590, text: 'the container', color: 'red', size: 's' }),
    ])
    act(beat(13, 4), (e) => [
      ...stroke(e, [[x + 270, y + 470], [x + 420, y + 470], [x + 500, y + 540], [x + 650, y + 540]], { size: 'm' }),
      ...txt(e, { x: x + 330, y: y + 400, text: 'a virtual ethernet pair — one cable, two ends', size: 's' }),
    ])
    act(beat(13, 7), (e) => [
      ...icon(e, 'switch', x + 680, y + 480, 150, 'blue'),
      ...txt(e, { x: x + 660, y: y + 660, text: 'docker0 — a bridge on the host', color: 'blue', size: 's' }),
    ])
    act(beat(13, 9), (e) => [
      ...arrow(e, { from: [x + 850, y + 550], to: [x + 1080, y + 550], color: 'blue' }),
      ...geo(e, { x: x + 1090, y: y + 500, w: 320, h: 100, text: 'physical adapter', size: 's' }),
    ])
    act(beat(13, 8), (e) =>
      code(e, x + 1090, y + 650, ['$ ip addr show docker0', 'inet 172.17.0.1/16'], { title: 'on the host' })
    )
  }

  /* ——— 14 · opening one door ——— */
  {
    const { x, y } = station(14)
    opening(14, 'To reach the internet, you open one door.')
    act(beat(14, 1, 0.4), (e) => [
      ...geo(e, { x: x + 40, y: y + 210, w: 640, h: 400, color: 'grey', dash: 'dashed', size: 's' }),
      ...txt(e, { x: x + 60, y: y + 170, text: 'ONE BRIDGE', color: 'grey', size: 's', mono: true }),
      ...icon(e, 'container', x + 120, y + 300, 150, 'red'),
      ...icon(e, 'container', x + 400, y + 300, 150, 'red'),
      ...txt(e, { x: x + 150, y: y + 500, text: 'they reach each other by internal IP', color: 'grey', size: 's' }),
    ])
    act(beat(14, 2), (e) =>
      code(e, x + 780, y + 200, [
        '$ docker run -p 8080:80 myapp',
        '$ sudo iptables -t nat -L DOCKER',
        'DNAT tcp dpt:8080 to:172.17.0.2:80',
      ], { title: 'port mapping is NAT' })
    )
    act(beat(14, 3), (e) => [
      ...txt(e, { x: x + 780, y: y + 520, text: 'host 8080', size: 's' }),
      ...arrow(e, { from: [x + 950, y + 535], to: [x + 1090, y + 535], color: 'blue' }),
      ...geo(e, { x: x + 1100, y: y + 500, w: 150, h: 70, text: 'NAT', color: 'blue', size: 's' }),
      ...arrow(e, { from: [x + 1260, y + 535], to: [x + 1400, y + 535], color: 'blue' }),
      ...txt(e, { x: x + 1410, y: y + 520, text: 'container 80', size: 's' }),
    ])
    act(beat(14, 3, 1.2), (e) =>
      txt(e, { x: x + 780, y: y + 650, text: 'without it the app runs fine — and nothing can reach it', color: 'red', size: 's' })
    )
  }

  /* ——— 15 · nobody who starts it ——— */
  {
    const { x, y } = station(15)
    opening(15, 'The docker command never starts your container.')
    const chain = [
      ['docker CLI', 'just makes an API call', 3],
      ['the daemon', 'images, networks, volumes', 4],
      ['containerd', 'lifecycle, pulls, layers', 6],
    ] as const
    chain.forEach(([name, what, b], i) => {
      act(beat(15, b as number), (e) => [
        ...geo(e, { x: x + 40 + i * 580, y: y + 200, w: 480, h: 170, text: name, size: 'l' }),
        ...txt(e, { x: x + 60 + i * 580, y: y + 390, text: what, color: 'grey', size: 's' }),
      ])
      if (i > 0) {
        act(beat(15, b as number, 0.3), (e) =>
          arrow(e, { from: [x + 40 + (i - 1) * 580 + 480, y + 285], to: [x + 40 + i * 580, y + 285] })
        )
      }
    })
    act(beat(15, 4, 0.5), (e) =>
      code(e, x + 40, y + 470, ['POST /v1.51/containers/create', 'POST /v1.51/containers/{id}/start'], { title: 'what the cli actually sends' })
    )
    act(beat(15, 9), (e) =>
      txt(e, { x: x + 200, y: y + 700, text: 'and even containerd does not create the process', color: 'red', size: 'l' })
    )
  }

  /* ——— 16 · built, then abandoned ——— */
  {
    const { x, y } = station(16)
    opening(16, 'runc builds the container, then walks away.')
    act(beat(16, 1, 0.5), (e) => [
      ...geo(e, { x: x + 40, y: y + 190, w: 360, h: 140, text: 'runc', size: 'l' }),
      ...txt(e, { x: x + 40, y: y + 350, text: 'its only job is to talk to the kernel', color: 'grey', size: 's' }),
    ])
    const jobs = ['sets up the namespaces', 'configures the cgroups', 'unpacks the root file system', 'starts the process']
    jobs.forEach((job, i) => {
      act(beat(16, 2, 0.8 + i * 1.1), (e) => [
        ...icon(e, 'check', x + 520, y + 190 + i * 84, 52, 'green'),
        ...txt(e, { x: x + 600, y: y + 200 + i * 84, text: job, size: 's' }),
      ])
    })
    act(beat(16, 2, 0.4), (e) =>
      code(e, x + 1150, y + 190, [
        'clone(CLONE_NEWPID | CLONE_NEWNS | …)',
        'pivot_root(…) + cgroup limits',
        'execve("/usr/local/bin/python")',
      ], { title: 'what runc says to the kernel' })
    )
    act(beat(16, 3), (e) =>
      txt(e, { x: x + 520, y: y + 560, text: 'and the moment the process runs, runc terminates', color: 'red', size: 's' })
    )
    act(beat(16, 5), (e) =>
      txt(e, { x: x + 40, y: y + 680, text: 'but on Linux, every process needs a parent', size: 's' })
    )
    act(beat(16, 6), (e) =>
      geo(e, { x: x + 40, y: y + 750, w: 360, h: 120, text: 'the shim', color: 'blue', size: 'l' })
    )
    act(beat(16, 7), (e) => [
      ...txt(e, { x: x + 440, y: y + 770, text: 'adopts the container and stays for its whole life —', color: 'grey', size: 's' }),
      ...txt(e, { x: x + 440, y: y + 820, text: 'alive through restarts, holding the exit code at the end', color: 'grey', size: 's' }),
    ])
  }

  /* ——— 17 · nothing but a process ——— */
  {
    const { x, y } = station(17)
    opening(17, 'In the end: nothing but a process.')
    act(beat(17, 2), (e) => [
      ...txt(e, { x: x + 40, y: y + 220, text: 'a regular Linux process', size: 'xl' }),
      ...txt(e, { x: x + 40, y: y + 320, text: 'everything else is the kernel telling it a story', color: 'grey', size: 's' }),
      ...icon(e, 'container', x + 80, y + 420, 180, 'red'),
    ])
    const parts = [
      ['namespaces', 'isolate what it can see', 'red', 3],
      ['cgroups', 'restrict what it can consume', 'orange', 4],
      ['overlayfs', 'stacks its file system', 'blue', 5],
      ['a bridge', 'wires it to the network', 'green', 5],
    ] as const
    parts.forEach(([name, what, tone, b], i) => {
      act(beat(17, b as number, (i % 2) * 0.35), (e) => [
        ...txt(e, { x: x + 850, y: y + 200 + i * 130, text: name, color: tone as Tone, size: 'l' }),
        ...txt(e, { x: x + 1280, y: y + 220 + i * 130, text: what, color: 'grey', size: 's' }),
        ...stroke(e, [[x + 850, y + 280 + i * 130], [x + 1650, y + 280 + i * 130]], { color: tone as Tone }),
      ])
    })
  }

  acts.sort((a, b) => a.at - b.at)
  return acts
}
