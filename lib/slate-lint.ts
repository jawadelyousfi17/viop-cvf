import {
  BLOCKS,
  CONTAINERS,
  LAYOUT_KINDS,
  allNodes,
  isKind,
  namesIn,
  rowIndex,
  splitCaption,
  splitTarget,
  where,
  type SlateLesson,
  type SlateNode,
  type SlateProblem,
  type SlateScene,
} from './slate'
import { nearestSymbols, resolveSymbol } from './slate-symbols'

/**
 * The kinds that carry a scene's argument, and so may not arrive together
 * unannounced.
 *
 * Media and attached text are ambient: they illustrate whatever they sit beside
 * rather than adding a step to follow. Arrangement — `group`, `row`, `compare`
 * — is ambient for a different reason: it is not a thing on the board at all,
 * it is where the things went.
 */
const ARGUES = new Set<string>([
  ...CONTAINERS.filter((kind) => kind !== 'group' && kind !== 'compare'),
  ...BLOCKS.filter((kind) => kind !== 'flow'),
  'code',
  'callout',
])

/** Arrangement, as opposed to content. Never counted, never coloured. */
const ARRANGES = new Set<string>(['group', 'compare', 'flow', ...LAYOUT_KINDS])

/** How many things may land on one beat before the reveal is too fast. */
const CROWDED_BEAT = 5

/** Containers whose contents are one arrival, not several. */
const TOGETHER = new Set<string>(['compare', 'group', ...LAYOUT_KINDS])

/** The kinds that carry one line, and so can be made to say a different one. */
const MORPHABLE = new Set<string>([
  ...CONTAINERS.filter((kind) => kind !== 'group' && kind !== 'compare'),
  'callout',
  'label',
  'lab',
])

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
 * judgements do not get to stop a build. An unknown symbol moved across that
 * line: a missing icon is a blemish, and a blemish should never cost a lesson.
 */
export function lint(lesson: SlateLesson): SlateProblem[] {
  const out = lesson.problems.slice()
  const known = new Set(Object.keys(lesson.roles))
  const usedRoles = new Set<string>()

  // A lesson's own alias has to point at a glyph that exists, or it is a
  // second way of spelling the same silence.
  for (const [alias, target] of Object.entries(lesson.symbols)) {
    if (!resolveSymbol(target).resolved) {
      out.push({
        level: 'err',
        msg: `symbol ${alias} = ${target}, and “${target}” is not a symbol${listNear(target)}`,
      })
    }
  }

  for (const [index, scene] of lesson.scenes.entries()) {
    const nodes = allNodes(scene)
    const parents = parentMap(scene)
    const names = namesIn(scene)
    const at = where(scene)

    const missing = (target: string, what: string, line: number) => {
      const { name, part } = splitTarget(target)
      if (!names.has(name)) {
        out.push({ level: 'err', line, msg: `${what} points at #${name}, which ${at} never defines` })
        return
      }
      if (part == null) return

      // A row of a block. Checked here because the alternative is what used to
      // happen: `hl #stack.top` resolved to nothing and drew nothing, silently.
      const block = nodes.find((node) => node.name === name)
      const rows = block ? countableRows(block) : 0
      if (!rows) {
        out.push({
          level: 'err',
          line,
          msg: `${what} points at #${name}.${part}, but #${name} has no rows to point at`,
        })
      } else if (rowIndex(part, rows) < 0) {
        out.push({
          level: 'err',
          line,
          msg: `${what} points at row “${part}” of #${name}, which has ${rows} — use a number, “top” or “bottom”`,
        })
      }
    }

    // ---- errors: things that will be wrong and cannot be seen -------------
    // A kind nobody recognises used to reach the renderer, which drew it as a
    // vague box, and the board compiler, which dropped it. Two answers to one
    // typo, neither of them "you have a typo".
    for (const node of nodes) {
      if (node.kind === 'arrow' || node.kind === 'rel') continue
      if (!isKind(node.kind)) {
        out.push({
          level: 'err',
          line: node.line,
          msg: `“${node.kind}” is not a kind — nothing will draw this line`,
        })
      }
    }

    for (const mark of scene.marks) missing(mark.target, mark.kind, mark.line)

    for (const morph of scene.morphs) {
      missing(morph.target, 'transform', morph.line)
      if (!morph.text) {
        out.push({
          level: 'err',
          line: morph.line,
          msg: `transform #${morph.target} says nothing to become — put the new reading under it`,
        })
      }
      // Only a shape with one label can be given a different one. A table or a
      // chart has no single reading to swap, so a transform on one would draw
      // nothing and say nothing — exactly the silence Slate exists to remove.
      const subject = nodes.find((node) => node.name === morph.target)
      if (subject && !MORPHABLE.has(subject.kind)) {
        out.push({
          level: 'err',
          line: morph.line,
          msg: `transform #${morph.target} is a ${subject.kind}, which has no single label to change — use replace`,
        })
      }
    }

    for (const swap of scene.swaps) {
      missing(swap.from, 'replace', swap.line)
      if (!swap.to) {
        out.push({
          level: 'err',
          line: swap.line,
          msg: `replace #${swap.from} has nothing to put in its place`,
        })
      } else if (!swap.node) {
        missing(swap.to, 'replace', swap.line)
      }
    }

    for (const node of nodes) {
      if (node.kind !== 'arrow' && node.kind !== 'rel') continue
      const what = node.kind === 'rel' ? node.rel! : 'arrow'
      for (const end of node.names ?? []) {
        if (!names.has(end)) {
          out.push({
            level: 'err',
            line: node.line,
            msg: `${what} end “${end}” is not a shape in ${at}`,
          })
        }
      }
    }

    for (const node of nodes) {
      for (const arm of node.arms) {
        if (!names.has(arm.target)) {
          out.push({
            level: 'err',
            line: arm.line,
            msg: `branch arm “${arm.label}” leads to #${arm.target}, which ${at} never defines`,
          })
        }
      }
    }

    // Attached text is attached. A top-level `txt` or `item` is the
    // noticeboard, arriving one line at a time.
    for (const row of scene.rows) {
      for (const node of row) {
        if (node.kind === 'txt' || node.kind === 'item') {
          out.push({
            level: 'err',
            line: node.line,
            msg: `${node.kind} at the top level in ${at} — put it inside a shape, or use callout`,
          })
        }
      }
    }

    const callouts = nodes.filter((node) => node.kind === 'callout')
    if (callouts.length > 1) {
      out.push({
        level: 'err',
        line: callouts[1].line,
        msg: `${at} has ${callouts.length} callouts — one per scene`,
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
    //
    // What has been *arranged* together is exempt for the same reason turned
    // inside out: a comparison whose halves arrive separately is not a
    // comparison, and a group dealt out one box at a time is not a group.
    const claimed = new Map<number, SlateNode[]>()
    for (const node of nodes) {
      if (!node.beat || node.shared || !ARGUES.has(node.kind)) continue
      if (TOGETHER.has(parents.get(node)?.kind ?? '')) continue
      // A beat that was inherited was never claimed. The rule is about two
      // *written* numbers colliding — a box and the list inside it arriving
      // together is one thing with its contents, not the board running ahead.
      if (node.beatTok == null && parents.get(node)) continue
      const list = claimed.get(node.beat) ?? []
      list.push(node)
      claimed.set(node.beat, list)
    }
    for (const [beat, sharing] of claimed) {
      if (sharing.length > 1) {
        out.push({
          level: 'err',
          line: sharing[1].line,
          msg: `${at} draws ${sharing.length} shapes on beat ${beat} — mark one |${beat}* if you meant it`,
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
          out.push({ level: 'err', msg: `${at} carries #${carried}, which no earlier scene defines` })
        }
      }
    }

    // ---- warnings: judgements about quality -------------------------------
    for (const symbol of nodes.filter((node) => node.kind === 'sym')) {
      const [glyph] = splitCaption(symbol.text)
      if (!resolveSymbol(glyph, lesson.symbols).resolved) {
        out.push({
          level: 'warn',
          line: symbol.line,
          msg: `unknown symbol “${glyph}”; drawing the generic icon${listNear(glyph)}`,
        })
      }
    }

    // Arrangement is not content: a group of three boxes is three shapes on the
    // board, not four, and counting the boundary would push every structured
    // scene over the ceiling.
    const drawn = nodes.filter(
      (node) => !['arrow', 'rel', 'txt', 'item'].includes(node.kind) && !ARRANGES.has(node.kind)
    )
    if (drawn.length > 13) {
      out.push({ level: 'warn', msg: `${at} has ${drawn.length} shapes — over thirteen, the board is crowded` })
    }
    if (drawn.length < 4) {
      out.push({ level: 'warn', msg: `${at} has ${drawn.length} shapes — under four, the board is idle` })
    }

    for (const node of nodes) {
      if (node.kind === 'compare' && node.children.length !== 2) {
        out.push({
          level: 'warn',
          line: node.line,
          msg: `compare holds ${node.children.length} sides — a comparison is two`,
        })
      }
      if (node.kind === 'flow' && node.children.length < 2) {
        out.push({
          level: 'warn',
          line: node.line,
          msg: `flow has ${node.children.length} step${node.children.length === 1 ? '' : 's'} — a sequence is at least two`,
        })
      }
      // A group of one is usually a box with extra steps — unless the one is a
      // block, where the group is how a table or a stack gets a heading.
      const lone = node.children.length === 1 ? node.children[0] : null
      if (node.kind === 'group' && node.children.length < 2 && !(lone && (BLOCKS as readonly string[]).includes(lone.kind))) {
        out.push({
          level: 'warn',
          line: node.line,
          msg: `group holds ${node.children.length} — a group of one is a box`,
        })
      }
      if ((node.kind === 'branch' || node.kind === 'choice') && node.arms.length === 1) {
        out.push({
          level: 'warn',
          line: node.line,
          msg: `${node.kind} has one arm — a fork with one way out is a step`,
        })
      }
    }

    const images = nodes.filter((node) => node.kind === 'img').length
    if (images > 1) out.push({ level: 'warn', msg: `${at} has ${images} imgs — one photograph a scene` })

    // A captioned symbol is not decoration. `sym shield : good isolation` is a
    // line in a list — content, counted with the shapes — and holding it to the
    // two-to-four budget meant a scene whose whole middle column was a labelled
    // list got told off for having a middle column.
    const symbols = nodes.filter((node) => node.kind === 'sym' && !splitCaption(node.text)[1])
    if (symbols.length > 4) {
      out.push({ level: 'warn', msg: `${at} has ${symbols.length} bare syms — four is plenty` })
    }
    if (!images && !nodes.some((node) => node.kind === 'sym' || node.kind === 'ico')) {
      out.push({ level: 'warn', msg: `${at} has nothing pictorial — no img, no sym, no ico` })
    }
    // A second symbol of the same thing is decoration pretending to be content.
    const seen = new Set<string>()
    for (const symbol of symbols) {
      const [glyph] = splitCaption(symbol.text)
      const key = resolveSymbol(glyph, lesson.symbols).resolved ?? glyph.toLowerCase()
      if (seen.has(key)) {
        out.push({ level: 'warn', line: symbol.line, msg: `sym “${glyph}” is drawn twice in ${at}` })
      }
      seen.add(key)
    }

    for (const node of nodes) {
      if (node.colour) {
        out.push({ level: 'warn', line: node.line, msg: `literal @${node.colour} — declare a role instead` })
      }
      if (node.role) {
        usedRoles.add(node.role)
        if (!known.has(node.role)) {
          out.push({ level: 'err', line: node.line, msg: `~${node.role} was never declared` })
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
    for (const morph of scene.morphs) if (morph.role) usedRoles.add(morph.role)

    // ---- the shape of the reveal ------------------------------------------
    const total = scene.beats.length || scene.declared
    if (total) {
      // Two different questions, and conflating them made both answers wrong.
      // *Arriving* is how much new there is to read on a beat — too much and
      // the board runs ahead of the voice. *Changing* is whether anything
      // happened at all — nothing for three beats and the voice is talking to a
      // still picture. Moving the attention is a change but not a new object,
      // which is the whole reason `focus` is worth having.
      const arriving = new Map<number, number>()
      const changing = new Set<number>()
      const bump = (beat: number) => {
        if (beat <= 0) return
        arriving.set(beat, (arriving.get(beat) ?? 0) + 1)
        changing.add(beat)
      }
      // Counted as a viewer counts: things to read. A connector is not a third
      // object, and a table is one object however many rows it has yet to
      // fill — so a block with rows is counted by its rows, not twice.
      for (const node of nodes) {
        if (ARRANGES.has(node.kind)) continue
        if (['arrow', 'rel', 'txt', 'item'].includes(node.kind)) continue
        if (node.rows.length) for (const row of node.rows) bump(row.beat)
        else bump(node.beat)
      }
      for (const morph of scene.morphs) bump(morph.beat)
      for (const swap of scene.swaps) bump(swap.beat)
      for (const mark of scene.marks) {
        if (mark.kind === 'note') bump(mark.beat)
        else if (mark.beat > 0) changing.add(mark.beat)
      }

      for (const [beat, count] of [...arriving].sort((a, b) => a[0] - b[0])) {
        if (count >= CROWDED_BEAT) {
          out.push({
            level: 'warn',
            msg: `${at}, beat ${beat} has ${count} new objects — consider splitting the reveal`,
          })
        }
      }

      // Beats with nothing arriving: the voice talking to a still picture.
      let run = 0
      let empty = 0
      const stalls: string[] = []
      for (let beat = 1; beat <= total + 1; beat++) {
        const busy = beat <= total && changing.has(beat)
        if (busy) {
          if (run >= 3) stalls.push(`${beat - run}–${beat - 1}`)
          run = 0
        } else if (beat <= total) {
          run++
          empty++
        } else if (run >= 3) {
          stalls.push(`${beat - run}–${beat - 1}`)
        }
      }
      for (const range of stalls) {
        out.push({ level: 'warn', msg: `${at} has no visual change during beats ${range}` })
      }
      if (empty >= total / 2) {
        out.push({ level: 'warn', msg: `${at} draws nothing on ${empty} of its ${total} beats` })
      }
    } else {
      out.push({ level: 'warn', msg: `${at} has no narration and declares no beat count — beats cannot be checked` })
    }
  }

  for (const role of Object.keys(lesson.roles)) {
    if (!usedRoles.has(role)) out.push({ level: 'warn', msg: `role ~${role} is declared and never used` })
  }

  // Asked of the lesson, not of every scene. A diagram-only scene is a fine
  // thing; a lesson with no photograph of anything real in it is a lecture
  // about words.
  if (lesson.scenes.length && !lesson.scenes.some((s) => allNodes(s).some((n) => n.kind === 'img'))) {
    out.push({ level: 'warn', msg: 'no scene has a photograph — nothing here is a real thing' })
  }

  // Read in the order the document is read. The rules fire in whatever order
  // they happen to be written in this file, and a list that jumps from line 30
  // to line 5 and back is a list people scan instead of working through.
  return out
    .map((problem, index) => ({ problem, index }))
    .sort((a, b) => {
      const line = (p: SlateProblem) => p.line ?? Number.MAX_SAFE_INTEGER
      return line(a.problem) - line(b.problem) || a.index - b.index
    })
    .map((entry) => entry.problem)
}

/**
 * The rows a block offers to a `.part` mark.
 *
 * A table's header is not a record, so `#records.1` is its first row of data —
 * anything else would make the number in the source disagree with the number a
 * reader counts on the board.
 */
function countableRows(node: SlateNode): number {
  return node.rows.filter((row) => !row.header).length
}

/** Which shape each shape sits inside, so a rule can ask about the context. */
function parentMap(scene: SlateScene): Map<SlateNode, SlateNode | null> {
  const map = new Map<SlateNode, SlateNode | null>()
  const walk = (node: SlateNode, parent: SlateNode | null) => {
    map.set(node, parent)
    for (const child of node.children) walk(child, node)
  }
  for (const row of scene.rows) for (const node of row) walk(node, null)
  for (const swap of scene.swaps) if (swap.node) walk(swap.node, null)
  return map
}

/** The nearest symbol names, so a typo is one line from fixed. */
function listNear(word: string) {
  const close = nearestSymbols(word)
  return close.length ? ` — did you mean ${close.map((n) => `“${n}”`).join(', ')}?` : ''
}

export const errorsIn = (problems: SlateProblem[]) => problems.filter((p) => p.level === 'err')
