import { BLOCKS, CONTAINERS, allNodes, type SlateLesson, type SlateProblem } from './slate'
import { SYMBOLS } from './slate-symbols'

/**
 * The kinds that carry a scene's argument, and so may not arrive together
 * unannounced. Media and attached text are ambient: they illustrate whatever
 * they sit beside rather than adding a step to follow.
 */
const ARGUES = new Set<string>([...CONTAINERS, ...BLOCKS, 'code', 'callout'])

/**
 * What refuses to build, and what only complains.
 *
 * Every rule here was a paragraph of prose in the Chalk prompt, asking a model
 * to remember something while it was busy thinking about something else. A rule
 * a compiler can check is a rule the author gets to forget.
 *
 * The split matters. An error is something that will be wrong on the board and
 * cannot be seen from the source — a name that does not exist, an anchor past
 * the end of the narration. A warning is a judgement about quality, and
 * judgements do not get to stop a build.
 */
export function lint(lesson: SlateLesson): SlateProblem[] {
  const out = lesson.problems.slice()
  const known = new Set(Object.keys(lesson.roles))
  const usedRoles = new Set<string>()

  for (const [index, scene] of lesson.scenes.entries()) {
    const nodes = allNodes(scene)
    const names = new Set(
      nodes
        .filter((node) => node.name)
        .map((node) => node.name!)
        .concat(scene.carries)
    )

    // ---- errors: things that will be wrong and cannot be seen -------------
    for (const mark of scene.marks) {
      if (!names.has(mark.target)) {
        out.push({
          level: 'err',
          line: mark.line,
          msg: `${mark.kind} points at #${mark.target}, which this scene never defines`,
        })
      }
    }

    for (const arrow of nodes.filter((node) => node.kind === 'arrow')) {
      for (const end of arrow.names ?? []) {
        if (!names.has(end)) {
          out.push({
            level: 'err',
            line: arrow.line,
            msg: `arrow end “${end}” is not a shape in scene ${scene.n}`,
          })
        }
      }
    }

    for (const symbol of nodes.filter((node) => node.kind === 'sym')) {
      if (!SYMBOLS[symbol.text.toLowerCase()]) {
        out.push({
          level: 'err',
          line: symbol.line,
          msg: `sym “${symbol.text}” is not in the symbol set${near(symbol.text)}`,
        })
      }
    }

    // A top-level `txt` is the noticeboard, arriving one line at a time.
    for (const row of scene.rows) {
      for (const node of row) {
        if (node.kind === 'txt') {
          out.push({
            level: 'err',
            line: node.line,
            msg: `txt at the top level in scene ${scene.n} — attach it inside a shape, or use callout`,
          })
        }
      }
    }

    const callouts = nodes.filter((node) => node.kind === 'callout')
    if (callouts.length > 1) {
      out.push({
        level: 'err',
        line: callouts[1].line,
        msg: `scene ${scene.n} has ${callouts.length} callouts — one per scene`,
      })
    }

    // Two shapes on one beat land in the same instant. Sometimes that is meant,
    // which is what the star says; unsaid, it is the board running ahead.
    //
    // Scoped to the kinds that carry the argument. A symbol beside the box it
    // illustrates, or a photograph under a callout, is not a second thing to
    // read — it is the same thing, drawn. Written without the scoping this
    // fired eight times on the language's own worked example, every time on a
    // pairing nobody would object to, which is how a useful error becomes an
    // error people learn to ignore.
    const claimed = new Map<number, typeof nodes>()
    for (const node of nodes) {
      if (!node.beat || node.shared || !ARGUES.has(node.kind)) continue
      const list = claimed.get(node.beat) ?? []
      list.push(node)
      claimed.set(node.beat, list)
    }
    for (const [beat, sharing] of claimed) {
      if (sharing.length > 1) {
        out.push({
          level: 'err',
          line: sharing[1].line,
          msg: `scene ${scene.n} draws ${sharing.length} shapes on beat ${beat} — mark one |${beat}* if you meant it`,
        })
      }
    }

    // A carry can only reach back to something that was defined.
    if (scene.carries.length) {
      const earlier = new Set(
        lesson.scenes
          .slice(0, index)
          .flatMap((past) => allNodes(past).filter((node) => node.name).map((node) => node.name!))
      )
      for (const carried of scene.carries) {
        if (carried !== 'all' && !earlier.has(carried)) {
          out.push({
            level: 'err',
            msg: `scene ${scene.n} carries #${carried}, which no earlier scene defines`,
          })
        }
      }
    }

    // ---- warnings: judgements about quality -------------------------------
    const drawn = nodes.filter((node) => node.kind !== 'arrow' && node.kind !== 'txt')
    if (drawn.length > 13) {
      out.push({
        level: 'warn',
        msg: `scene ${scene.n} has ${drawn.length} shapes — over thirteen, the board is crowded`,
      })
    }
    if (drawn.length < 4) {
      out.push({
        level: 'warn',
        msg: `scene ${scene.n} has ${drawn.length} shapes — under four, the board is idle`,
      })
    }

    const images = nodes.filter((node) => node.kind === 'img').length
    if (images === 0) out.push({ level: 'warn', msg: `scene ${scene.n} has no img` })
    if (images > 1) {
      out.push({
        level: 'warn',
        msg: `scene ${scene.n} has ${images} imgs — one photograph a scene`,
      })
    }

    const symbols = nodes.filter((node) => node.kind === 'sym')
    if (symbols.length < 2 || symbols.length > 4) {
      out.push({ level: 'warn', msg: `scene ${scene.n} has ${symbols.length} syms — two to four` })
    }
    // A second symbol of the same thing is decoration pretending to be content.
    const seen = new Set<string>()
    for (const symbol of symbols) {
      const key = symbol.text.toLowerCase()
      if (seen.has(key)) {
        out.push({
          level: 'warn',
          line: symbol.line,
          msg: `sym “${symbol.text}” is drawn twice in scene ${scene.n}`,
        })
      }
      seen.add(key)
    }

    for (const node of nodes) {
      if (node.colour) {
        out.push({
          level: 'warn',
          line: node.line,
          msg: `literal @${node.colour} — declare a role instead`,
        })
      }
      if (node.role) {
        usedRoles.add(node.role)
        if (!known.has(node.role)) {
          out.push({
            level: 'err',
            line: node.line,
            msg: `~${node.role} was never declared`,
          })
        }
      }
      // A child repeating its container's label says nothing twice.
      for (const child of node.children) {
        if (child.text && child.text.toLowerCase() === node.text.toLowerCase()) {
          out.push({
            level: 'warn',
            line: child.line,
            msg: `“${child.text}” repeats the label of the shape holding it`,
          })
        }
      }
    }

    // Beats with nothing arriving: the voice talking to a still picture.
    if (scene.beats.length) {
      const busy = new Set<number>()
      for (const node of nodes) {
        busy.add(node.beat)
        for (const row of node.rows) busy.add(row.beat)
      }
      for (const mark of scene.marks) busy.add(mark.beat)

      let run = 0
      let worst = 0
      let empty = 0
      for (let beat = 1; beat <= scene.beats.length; beat++) {
        if (busy.has(beat)) run = 0
        else {
          run++
          empty++
        }
        worst = Math.max(worst, run)
      }
      if (worst >= 3) {
        out.push({
          level: 'warn',
          msg: `scene ${scene.n} has ${worst} beats in a row with nothing drawn`,
        })
      }
      if (empty >= scene.beats.length / 2) {
        out.push({
          level: 'warn',
          msg: `scene ${scene.n} draws nothing on ${empty} of its ${scene.beats.length} beats`,
        })
      }
    } else {
      out.push({
        level: 'warn',
        msg: `scene ${scene.n} has no narration — beats cannot be checked`,
      })
    }
  }

  for (const role of Object.keys(lesson.roles)) {
    if (!usedRoles.has(role)) {
      out.push({ level: 'warn', msg: `role ~${role} is declared and never used` })
    }
  }

  return out
}

/** The nearest symbol names, so a typo is one line from fixed. */
function near(word: string) {
  const wanted = word.toLowerCase()
  const close = Object.keys(SYMBOLS)
    .filter((name) => name.includes(wanted.split(' ')[0]) || wanted.includes(name.split(' ')[0]))
    .slice(0, 3)
  return close.length ? ` — did you mean ${close.map((n) => `“${n}”`).join(', ')}?` : ''
}

export const errorsIn = (problems: SlateProblem[]) => problems.filter((p) => p.level === 'err')
