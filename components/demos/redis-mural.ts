'use client'

import { type Editor, type TLShapeId } from 'tldraw'
import { code, icon } from './svg-cards'
import { arrow, geo, station, stroke, txt, type Act, type CueSheet, type Tone } from './wall'

/**
 * The Redis lesson, told to someone who has never opened its manual.
 *
 * No plate numbers and no headings — each station opens with the plain
 * sentence a person would actually say, and the drawings carry the rest.
 * The order is the narrator's: the cache you bolted on, the box you thought
 * it was, and then the machine it actually is.
 */

export function buildRedisActs(sheet: CueSheet): Act[] {
  const acts: Act[] = []
  const beat = (scene: number, n: number, delay = 0) => {
    const s_ = sheet.scenes[scene - 1]
    if (!s_) return NaN // scene cut from a sampled sheet: skip its acts
    return (s_.beats[n - 1] ?? s_.start) + delay
  }
  const act = (at: number, make: (e: Editor) => TLShapeId[]) => {
    if (Number.isFinite(at)) acts.push({ at, make })
  }

  /** The plain-words opening line every station gets instead of a title. */
  const opening = (scene: number, text: string, tone: Tone = 'black') => {
    const { x, y } = station(scene)
    act(beat(scene, 1), (e) => txt(e, { x, y, text, size: 'l', color: tone }))
  }

  /* ——— 1 · the story everyone starts with ——— */
  {
    const { x, y } = station(1)
    opening(1, 'Your app is getting slow.')
    act(beat(1, 1, 0.5), (e) => [
      ...icon(e, 'browser window', x + 60, y + 200, 130),
      ...arrow(e, { from: [x + 210, y + 265], to: [x + 360, y + 265] }),
      ...icon(e, 'server', x + 380, y + 200, 130),
      ...arrow(e, { from: [x + 530, y + 265], to: [x + 680, y + 265] }),
      ...icon(e, 'database', x + 700, y + 200, 130, 'blue'),
      ...icon(e, 'stopwatch', x + 920, y + 190, 120, 'red'),
      ...txt(e, { x: x + 900, y: y + 340, text: 'every question waits for the disk', color: 'red', size: 's' }),
    ])
    act(beat(1, 2), (e) =>
      txt(e, { x: x + 60, y: y + 450, text: 'someone says: “put a cache in front of it”', size: 'm' })
    )
    act(beat(1, 3), (e) => [
      ...code(e, x + 60, y + 530, ['$ docker run redis'], {}),
      ...icon(e, 'cache', x + 560, y + 520, 120, 'red'),
      ...arrow(e, { from: [x + 545, y + 350], to: [x + 610, y + 500], color: 'red', dash: 'dashed', head: true }),
      ...txt(e, { x: x + 720, y: y + 550, text: 'latency drops. everything is fine.', color: 'green' }),
      ...icon(e, 'happy face', x + 1140, y + 520, 100, 'green'),
    ])
  }

  /* ——— 2 · the box you think it is ——— */
  {
    const { x, y } = station(2)
    opening(2, 'And for most of us, that is where the idea stops.')
    act(beat(2, 2), (e) => [
      ...geo(e, { x: x + 60, y: y + 160, w: 520, h: 220, text: 'a temporary box\nof key → value pairs', size: 'm' }),
      ...icon(e, 'key', x + 620, y + 190, 110),
    ])
    act(beat(2, 2, 0.8), (e) => [
      ...code(e, x + 60, y + 430, ['SET user:42 "Ali"', 'GET user:42   →  "Ali"'], {}),
      ...txt(e, { x: x + 60, y: y + 640, text: 'reboot the server — everything in it is gone', color: 'red', size: 's' }),
      ...icon(e, 'plug', x + 620, y + 610, 90, 'red'),
    ])
    act(beat(2, 3), (e) => [
      ...txt(e, { x: x + 900, y: y + 160, text: 'but then why do real systems use it for…', size: 'm' }),
      ...icon(e, 'envelope', x + 900, y + 240, 96),
      ...txt(e, { x: x + 1020, y: y + 270, text: 'passing messages', size: 's' }),
      ...icon(e, 'gauge', x + 900, y + 360, 96),
      ...txt(e, { x: x + 1020, y: y + 390, text: 'live analytics', size: 's' }),
      ...icon(e, 'globe', x + 1320, y + 240, 96),
      ...txt(e, { x: x + 1440, y: y + 270, text: 'map tracking', size: 's' }),
      ...icon(e, 'database', x + 1320, y + 360, 96),
      ...txt(e, { x: x + 1440, y: y + 390, text: 'a primary database', size: 's' }),
    ])
    act(beat(2, 4), (e) => [
      ...icon(e, 'phone', x + 940, y + 520, 110),
      ...txt(e, { x: x + 1070, y: y + 540, text: '“Redis is only a cache” is like', size: 's' }),
      ...txt(e, { x: x + 1070, y: y + 585, text: '“a phone is only for ringing”', size: 's' }),
    ])
    act(beat(2, 6), (e) => [
      ...txt(e, { x: x + 60, y: y + 760, text: "so let's open it up:", color: 'grey', size: 's' }),
      ...txt(e, { x: x + 300, y: y + 760, text: 'how it works · why one thread · fast AND durable', size: 's' }),
    ])
  }

  /* ——— 3 · what a database does to answer you ——— */
  {
    const { x, y } = station(3)
    opening(3, 'First: why is it so much faster than a database?')
    const steps = ['parse the SQL', 'plan the query', 'walk a B-tree', 'read the data'] as const
    steps.forEach((label, i) => {
      act(beat(3, 4, i * 0.3), (e) => [
        ...geo(e, { x: x + 60 + i * 330, y: y + 200, w: 280, h: 100, text: label, size: 's' }),
        ...(i < 3 ? arrow(e, { from: [x + 340 + i * 330, y + 250], to: [x + 390 + i * 330, y + 250] }) : []),
      ])
    })
    act(beat(3, 5), (e) => [
      ...icon(e, 'disk', x + 620, y + 400, 150, 'red'),
      ...txt(e, { x: x + 800, y: y + 440, text: 'and the data itself lives here — on disk', color: 'red' }),
    ])
    act(beat(3, 6), (e) => [
      ...txt(e, { x: x + 800, y: y + 530, text: 'even a fast SSD answers in microseconds', color: 'grey', size: 's' }),
      ...txt(e, { x: x + 620, y: y + 620, text: 'µs', color: 'red', size: 'xl' }),
    ])
  }

  /* ——— 4 · redis keeps it in RAM ——— */
  {
    const { x, y } = station(4)
    opening(4, 'Redis keeps everything in memory instead.')
    act(beat(4, 2), (e) => [
      ...icon(e, 'memory chip', x + 80, y + 190, 190, 'green'),
      ...txt(e, { x: x + 300, y: y + 250, text: 'reads and writes never touch the disk', size: 'm' }),
    ])
    act(beat(4, 3), (e) => [
      ...txt(e, { x: x + 80, y: y + 460, text: 'ns', color: 'green', size: 'xl' }),
      ...txt(e, { x: x + 180, y: y + 485, text: 'nanoseconds from RAM', color: 'green', size: 's' }),
      ...txt(e, { x: x + 620, y: y + 460, text: 'µs', color: 'red', size: 'xl' }),
      ...txt(e, { x: x + 720, y: y + 485, text: 'microseconds from disk', color: 'red', size: 's' }),
      ...txt(e, { x: x + 80, y: y + 580, text: '— a thousand times closer', color: 'grey', size: 's' }),
    ])
  }

  /* ——— 5 · but speed alone is a global variable ——— */
  {
    const { x, y } = station(5)
    opening(5, "But raw speed isn't the whole story.")
    act(beat(5, 2), (e) => [
      ...code(e, x + 60, y + 170, ['# your app could already do this', 'cache = {}   # a dict in RAM'], {}),
      ...txt(e, { x: x + 60, y: y + 400, text: 'same RAM. same speed. so what is Redis adding?', size: 'm' }),
    ])
    act(beat(5, 3), (e) => [
      ...txt(e, { x: x + 60, y: y + 520, text: 'the second half of its name:', color: 'grey', size: 's' }),
      ...txt(e, { x: x + 60, y: y + 580, text: 'a data structure store', color: 'red', size: 'xl' }),
      ...stroke(e, [[x + 60, y + 660], [x + 900, y + 660]], { color: 'red' }),
    ])
  }

  /* ——— 6 · what a plain cache makes you do ——— */
  {
    const { x, y } = station(6)
    opening(6, 'A plain cache only understands strings.')
    act(beat(6, 2), (e) =>
      code(e, x + 60, y + 170, ['GET user:42', '"{\\"name\\": \\"Ali\\", \\"cart\\": [3, 7, 19]}"'], {})
    )
    act(beat(6, 3), (e) => {
      const steps = ['fetch it all', 'parse it', 'change one field', 'stringify it', 'save it all'] as const
      const ids: TLShapeId[] = []
      steps.forEach((label, i) => {
        ids.push(
          ...geo(e, { x: x + 60 + i * 300, y: y + 420, w: 250, h: 90, text: label, color: 'red', size: 's' }),
          ...(i < 4 ? arrow(e, { from: [x + 310 + i * 300, y + 465], to: [x + 360 + i * 300, y + 465], color: 'red' }) : [])
        )
      })
      ids.push(...txt(e, { x: x + 60, y: y + 570, text: 'five steps, round-tripped through your app — to change one field', color: 'grey', size: 's' }))
      return ids
    })
  }

  /* ——— 7 · redis speaks structures ——— */
  {
    const { x, y } = station(7)
    opening(7, 'Redis understands the shapes of your data.')
    act(beat(7, 2), (e) => [
      ...geo(e, { x: x + 60, y: y + 180, w: 300, h: 110, text: 'LIST', size: 's' }),
      ...geo(e, { x: x + 400, y: y + 180, w: 300, h: 110, text: 'SET', size: 's' }),
      ...geo(e, { x: x + 60, y: y + 320, w: 300, h: 110, text: 'HASH', size: 's' }),
      ...geo(e, { x: x + 400, y: y + 320, w: 300, h: 110, text: 'SORTED SET', color: 'red', size: 's' }),
      ...icon(e, 'trophy', x + 760, y + 300, 130, 'red'),
    ])
    act(beat(7, 3), (e) => [
      ...code(e, x + 60, y + 510, ['HSET user:42 city Tanger', 'LPUSH jobs "send-email-9312"'], {}),
      ...txt(e, { x: x + 60, y: y + 720, text: 'each comes with its own operations — you change the data in place', size: 's' }),
    ])
  }

  /* ——— 8 · the leaderboard ——— */
  {
    const { x, y } = station(8)
    opening(8, "Say you're building a game leaderboard.")
    act(beat(8, 2), (e) => [
      ...txt(e, { x: x + 60, y: y + 140, text: 'the database way:', color: 'grey', size: 's' }),
      ...code(e, x + 60, y + 190, ['SELECT player, score FROM scores', 'ORDER BY score DESC LIMIT 10'], {}),
      ...txt(e, { x: x + 60, y: y + 400, text: 'sort millions of rows again —', color: 'red', size: 's' }),
    ])
    act(beat(8, 3), (e) => [
      ...txt(e, { x: x + 60, y: y + 450, text: 'on every single page refresh', color: 'red', size: 's' }),
      ...icon(e, 'hourglass', x + 480, y + 390, 100, 'red'),
    ])
    act(beat(8, 4), (e) => [
      ...txt(e, { x: x + 850, y: y + 140, text: 'the Redis way:', color: 'grey', size: 's' }),
      ...code(e, x + 850, y + 190, ['ZADD board 9800 "ali"'], {}),
    ])
    act(beat(8, 5), (e) => [
      // The skip list: express lanes over a sorted row.
      ...stroke(e, [[x + 870, y + 420], [x + 1560, y + 420]], { color: 'red' }),
      ...stroke(e, [[x + 870, y + 470], [x + 1210, y + 470], [x + 1560, y + 470]], { color: 'red', dash: 'dashed' }),
      ...[0, 1, 2, 3, 4, 5].flatMap((i) =>
        geo(e, { x: x + 860 + i * 140, y: y + 500, w: 90, h: 60, text: String(9800 - i * 350), color: 'red', size: 's' })
      ),
      ...txt(e, { x: x + 870, y: y + 600, text: 'a hash table + a skip list: kept sorted as it is written', color: 'grey', size: 's' }),
    ])
    act(beat(8, 7), (e) =>
      code(e, x + 850, y + 660, ['ZREVRANGE board 0 9   → instant'], {})
    )
    act(beat(8, 8), (e) => [
      ...txt(e, { x: x + 60, y: y + 640, text: 'the sorting happened at write time.', size: 'm' }),
      ...txt(e, { x: x + 60, y: y + 700, text: 'the computation moved into the store itself.', color: 'red', size: 'm' }),
    ])
  }

  /* ——— 9 · ten thousand clients, one thread ——— */
  {
    const { x, y } = station(9)
    opening(9, 'Now the strange part: how does it talk to 10,000 clients at once?')
    act(beat(9, 2), (e) => [
      ...icon(e, 'people', x + 60, y + 200, 120),
      ...icon(e, 'people', x + 200, y + 200, 120),
      ...icon(e, 'people', x + 340, y + 200, 120),
      ...txt(e, { x: x + 60, y: y + 350, text: '10,000 connections', size: 's' }),
      ...arrow(e, { from: [x + 480, y + 260], to: [x + 640, y + 260] }),
      ...icon(e, 'server', x + 660, y + 200, 130, 'red'),
      ...txt(e, { x: x + 60, y: y + 430, text: 'surely it starts a thread for each one, like a web server would?', color: 'grey', size: 's' }),
    ])
    act(beat(9, 3), (e) =>
      txt(e, { x: x + 60, y: y + 540, text: 'it is single-threaded.', color: 'red', size: 'xl' })
    )
    act(beat(9, 5), (e) => [
      ...txt(e, { x: x + 60, y: y + 660, text: 'and it still does', color: 'grey', size: 's' }),
      ...txt(e, { x: x + 320, y: y + 650, text: '100,000 requests / second', size: 'l' }),
    ])
  }

  /* ——— 10 · what actually makes threads slow ——— */
  {
    const { x, y } = station(10)
    opening(10, 'To see why, look at what makes many threads slow.')
    act(beat(10, 2), (e) => [
      ...geo(e, { x: x + 60, y: y + 190, w: 260, h: 100, text: 'thread A', size: 's' }),
      ...geo(e, { x: x + 60, y: y + 330, w: 260, h: 100, text: 'thread B', size: 's' }),
      ...geo(e, { x: x + 620, y: y + 250, w: 300, h: 120, text: 'the same\nmemory', size: 's' }),
      ...arrow(e, { from: [x + 330, y + 240], to: [x + 610, y + 290] }),
      ...arrow(e, { from: [x + 330, y + 380], to: [x + 610, y + 330], color: 'red', dash: 'dashed' }),
      ...icon(e, 'padlock', x + 960, y + 250, 110, 'red'),
      ...txt(e, { x: x + 960, y: y + 390, text: 'locks, so they cannot corrupt it', color: 'red', size: 's' }),
    ])
    act(beat(10, 3), (e) =>
      txt(e, { x: x + 60, y: y + 500, text: 'A locks the data. B just… waits.', size: 'm' })
    )
    act(beat(10, 4), (e) => [
      ...icon(e, 'gear', x + 620, y + 570, 100, 'red'),
      ...txt(e, { x: x + 740, y: y + 600, text: 'and the CPU burns cycles switching between them', color: 'red', size: 's' }),
    ])
  }

  /* ——— 11 · the real wait is the network ——— */
  {
    const { x, y } = station(11)
    opening(11, 'Redis skips that whole game.')
    act(beat(11, 1, 0.6), (e) =>
      txt(e, { x: x + 60, y: y + 130, text: 'memory work takes ~no time — the real wait is the network', color: 'grey', size: 's' })
    )
    act(beat(11, 3), (e) => [
      ...txt(e, { x: x + 60, y: y + 230, text: 'so: one thread, watching every socket at once', size: 'm' }),
      ...txt(e, { x: x + 60, y: y + 290, text: '(the trick is called I/O multiplexing)', color: 'grey', size: 's' }),
    ])
    act(beat(11, 4), (e) =>
      code(e, x + 60, y + 360, ['epoll_wait(epfd, events, 10000, -1)', '→ "these 3 sockets have something for you"'], { title: 'one syscall, all the sockets' })
    )
    act(beat(11, 5), (e) => {
      const ids: TLShapeId[] = []
      for (let i = 0; i < 5; i++) {
        ids.push(
          ...geo(e, { x: x + 950, y: y + 180 + i * 90, w: 130, h: 60, text: `sock ${i + 1}`, color: 'grey', size: 's' }),
          ...arrow(e, { from: [x + 1080, y + 210 + i * 90], to: [x + 1220, y + 400], color: i === 2 ? 'red' : 'grey', size: 's', head: false })
        )
      }
      ids.push(
        ...geo(e, { x: x + 1230, y: y + 350, w: 280, h: 110, text: 'ONE thread', color: 'red', size: 's' })
      )
      return ids
    })
    act(beat(11, 6), (e) => [
      ...icon(e, 'queue', x + 1290, y + 510, 110, 'red'),
      ...txt(e, { x: x + 1240, y: y + 650, text: 'ready commands line up here', color: 'grey', size: 's' }),
    ])
  }

  /* ——— 12 · one at a time is a superpower ——— */
  {
    const { x, y } = station(12)
    opening(12, 'Commands run strictly one after another.')
    act(beat(12, 1, 0.5), (e) => [
      ...geo(e, { x: x + 60, y: y + 170, w: 220, h: 80, text: 'GET', size: 's' }),
      ...geo(e, { x: x + 300, y: y + 170, w: 220, h: 80, text: 'DECR', color: 'red', size: 's' }),
      ...geo(e, { x: x + 540, y: y + 170, w: 220, h: 80, text: 'SET', size: 's' }),
      ...arrow(e, { from: [x + 790, y + 210], to: [x + 900, y + 210] }),
      ...txt(e, { x: x + 920, y: y + 195, text: 'in. done. next.', color: 'grey', size: 's' }),
    ])
    act(beat(12, 2), (e) =>
      txt(e, { x: x + 60, y: y + 320, text: 'which quietly gives you atomic operations — for free', size: 'm' })
    )
    act(beat(12, 4), (e) => [
      ...txt(e, { x: x + 60, y: y + 420, text: 'two people buy the last ticket at the same millisecond:', color: 'grey', size: 's' }),
      ...code(e, x + 60, y + 470, ['DECR stock:tickets   → 1   # first, fully', 'DECR stock:tickets   → 0   # then the other'], {}),
    ])
    act(beat(12, 5), (e) => [
      ...txt(e, { x: x + 60, y: y + 690, text: 'no race. no corruption.', size: 'm' }),
      ...txt(e, { x: x + 430, y: y + 690, text: 'and not a lock in sight.', color: 'green', size: 'm' }),
    ])
    act(beat(12, 6), (e) => [
      ...txt(e, { x: x + 1050, y: y + 420, text: 'fine print: new versions add a few threads,', color: 'grey', size: 's' }),
      ...txt(e, { x: x + 1050, y: y + 465, text: 'but only to read the network —', color: 'grey', size: 's' }),
      ...txt(e, { x: x + 1050, y: y + 510, text: 'the data is still touched by one thread only', size: 's' }),
    ])
  }

  /* ——— 13 · RAM forgets ——— */
  {
    const { x, y } = station(13)
    opening(13, 'One problem left: RAM forgets.')
    act(beat(13, 2), (e) => [
      ...icon(e, 'memory chip', x + 60, y + 190, 150, 'red'),
      ...icon(e, 'plug', x + 260, y + 200, 110, 'red'),
      ...txt(e, { x: x + 400, y: y + 250, text: 'power gone → data gone', color: 'red', size: 'm' }),
    ])
    act(beat(13, 3), (e) =>
      txt(e, { x: x + 60, y: y + 430, text: 'losing a cache? nobody cries.', color: 'grey', size: 's' })
    )
    act(beat(13, 4), (e) => [
      ...txt(e, { x: x + 60, y: y + 490, text: 'losing sessions and shopping carts? a real problem.', size: 'm' }),
      ...icon(e, 'warehouse', x + 900, y + 450, 110),
    ])
    act(beat(13, 5), (e) =>
      txt(e, { x: x + 60, y: y + 620, text: 'so Redis remembers — in two different ways.', color: 'red', size: 'm' })
    )
  }

  /* ——— 14 · the snapshot, and the awkward question ——— */
  {
    const { x, y } = station(14)
    opening(14, 'Way one: RDB — a photograph of everything.')
    act(beat(14, 2), (e) => [
      ...icon(e, 'camera', x + 60, y + 180, 130, 'blue'),
      ...txt(e, { x: x + 220, y: y + 230, text: 'a point-in-time snapshot of the whole dataset', size: 's' }),
    ])
    act(beat(14, 3), (e) => [
      ...arrow(e, { from: [x + 350, y + 330], to: [x + 350, y + 430], color: 'blue' }),
      ...icon(e, 'disk', x + 300, y + 440, 110, 'blue'),
      ...txt(e, { x: x + 440, y: y + 480, text: 'saved to disk', color: 'blue', size: 's' }),
    ])
    act(beat(14, 4), (e) => [
      ...geo(e, { x: x + 850, y: y + 200, w: 700, h: 220, color: 'red', text: 'wait — writing 10 GB takes seconds.\nwouldn’t the single thread freeze,\nand every request block?', size: 's' }),
    ])
  }

  /* ——— 15 · fork ——— */
  {
    const { x, y } = station(15)
    opening(15, 'It would — except for an old operating-system trick.')
    act(beat(15, 2), (e) =>
      code(e, x + 60, y + 160, ['pid = fork()'], { title: 'ask the kernel to split' })
    )
    act(beat(15, 3), (e) => [
      ...icon(e, 'fork', x + 500, y + 160, 140, 'red'),
      ...geo(e, { x: x + 720, y: y + 140, w: 330, h: 110, text: 'parent — keeps serving', color: 'red', size: 's' }),
      ...geo(e, { x: x + 720, y: y + 280, w: 330, h: 110, text: 'child — an exact twin', color: 'blue', size: 's' }),
    ])
    act(beat(15, 4), (e) => [
      ...geo(e, { x: x + 1200, y: y + 180, w: 330, h: 130, text: 'the SAME memory', size: 's' }),
      ...arrow(e, { from: [x + 1050, y + 190], to: [x + 1190, y + 230], color: 'red', head: true }),
      ...arrow(e, { from: [x + 1050, y + 330], to: [x + 1190, y + 260], color: 'blue', head: true }),
      ...txt(e, { x: x + 1200, y: y + 340, text: 'no copy is made — both just point at it', color: 'grey', size: 's' }),
    ])
    act(beat(15, 5), (e) => [
      ...arrow(e, { from: [x + 880, y + 400], to: [x + 880, y + 500], color: 'blue' }),
      ...icon(e, 'disk', x + 830, y + 510, 100, 'blue'),
      ...txt(e, { x: x + 960, y: y + 550, text: 'the child calmly writes it all to disk', color: 'blue', size: 's' }),
    ])
  }

  /* ——— 16 · copy-on-write ——— */
  {
    const { x, y } = station(16)
    opening(16, 'But what if a write comes in mid-photograph?')
    act(beat(16, 2), (e) =>
      txt(e, { x: x + 60, y: y + 140, text: 'copy-on-write', color: 'red', size: 'xl' })
    )
    act(beat(16, 3), (e) => [
      ...icon(e, 'pages', x + 60, y + 260, 120, 'red'),
      ...geo(e, { x: x + 240, y: y + 260, w: 240, h: 100, text: 'page', size: 's' }),
      ...arrow(e, { from: [x + 490, y + 310], to: [x + 610, y + 310], color: 'red', text: 'duplicated' }),
      ...geo(e, { x: x + 620, y: y + 260, w: 240, h: 100, text: 'the copy', color: 'red', size: 's' }),
      ...txt(e, { x: x + 60, y: y + 410, text: 'the parent edits the copy — just that one page', color: 'red', size: 's' }),
    ])
    act(beat(16, 4), (e) => [
      ...txt(e, { x: x + 60, y: y + 500, text: 'the child never notices:', size: 'm' }),
      ...txt(e, { x: x + 60, y: y + 555, text: 'it still sees memory exactly as it was at the instant of the fork', color: 'grey', size: 's' }),
    ])
    act(beat(16, 5), (e) => [
      ...icon(e, 'check', x + 1050, y + 500, 80, 'green'),
      ...txt(e, { x: x + 1150, y: y + 520, text: 'main thread never blocked —', color: 'green', size: 's' }),
      ...txt(e, { x: x + 1150, y: y + 565, text: 'snapshot lands safely', color: 'green', size: 's' }),
    ])
  }

  /* ——— 17 · the diary ——— */
  {
    const { x, y } = station(17)
    opening(17, 'Way two: AOF — a diary of every write.')
    act(beat(17, 2), (e) => [
      ...icon(e, 'document', x + 60, y + 180, 120),
      ...txt(e, { x: x + 210, y: y + 210, text: 'RDB photographs every few minutes;', color: 'grey', size: 's' }),
      ...txt(e, { x: x + 210, y: y + 255, text: 'the AOF writes every command down as it happens', size: 's' }),
    ])
    act(beat(17, 3), (e) =>
      code(e, x + 60, y + 340, ['SET user:42 "Ali"', '→ appended to appendonly.aof'], {})
    )
    act(beat(17, 4), (e) => [
      ...txt(e, { x: x + 60, y: y + 570, text: 'crash? read the diary top to bottom,', size: 's' }),
      ...txt(e, { x: x + 60, y: y + 615, text: 'replay every line — the data rebuilds itself', size: 's' }),
    ])
    act(beat(17, 5), (e) => [
      ...txt(e, { x: x + 950, y: y + 400, text: 'in production: both.', size: 'm' }),
      ...txt(e, { x: x + 950, y: y + 460, text: 'RDB → fast restarts, compact backups', color: 'blue', size: 's' }),
      ...txt(e, { x: x + 950, y: y + 505, text: 'AOF → the last few minutes survive a power cut', color: 'green', size: 's' }),
    ])
  }

  /* ——— 18 · the toolbox ——— */
  {
    const { x, y } = station(18)
    opening(18, 'Put the pieces together and it stops being “just a cache”.')
    act(beat(18, 1, 0.6), (e) => [
      ...icon(e, 'memory chip', x + 60, y + 160, 84, 'green'),
      ...icon(e, 'layers', x + 170, y + 160, 84, 'red'),
      ...icon(e, 'bolt', x + 280, y + 160, 84, 'orange'),
      ...icon(e, 'disk', x + 390, y + 160, 84, 'blue'),
      ...txt(e, { x: x + 510, y: y + 190, text: 'RAM · structures · one loop · persistence', color: 'grey', size: 's' }),
    ])
    act(beat(18, 3), (e) => [
      ...txt(e, { x: x + 60, y: y + 310, text: 'rate-limit an API:', size: 's' }),
      ...code(e, x + 460, y + 285, ['INCR ip:9.9.9.9  ·  EXPIRE ip:9.9.9.9 60'], {}),
    ])
    act(beat(18, 4), (e) => [
      ...txt(e, { x: x + 60, y: y + 450, text: 'pass messages between services:', size: 's' }),
      ...icon(e, 'envelope', x + 620, y + 420, 90, 'blue'),
      ...txt(e, { x: x + 730, y: y + 450, text: 'pub/sub · streams', color: 'blue', size: 's' }),
    ])
    act(beat(18, 5), (e) => [
      ...txt(e, { x: x + 60, y: y + 580, text: 'stop two people booking one seat:', size: 's' }),
      ...code(e, x + 620, y + 550, ['MULTI … EXEC   # all or nothing'], {}),
    ])
  }

  /* ——— 19 · the closing thought ——— */
  {
    const { x, y } = station(19)
    opening(19, 'It changes how you think about where data lives.')
    act(beat(19, 2), (e) => [
      ...icon(e, 'memory chip', x + 60, y + 200, 110, 'green'),
      ...icon(e, 'network', x + 200, y + 200, 110, 'blue'),
      ...txt(e, { x: x + 340, y: y + 240, text: 'data structures at RAM speed, behind a socket', size: 'm' }),
    ])
    act(beat(19, 3), (e) => [
      ...code(e, x + 60, y + 400, ['$ docker run redis'], {}),
      ...txt(e, { x: x + 60, y: y + 590, text: 'not a temporary bucket —', color: 'grey', size: 'm' }),
      ...txt(e, { x: x + 60, y: y + 650, text: 'one of the most elegantly engineered pieces of the modern stack.', color: 'red', size: 'm' }),
    ])
  }

  acts.sort((a, b) => a.at - b.at)
  return acts
}
