'use client'

import {
  COLOURS,
  LAYOUT_KINDS,
  rowIndex,
  splitCaption,
  splitTarget,
  type SlateLesson,
  type SlateNode,
  type SlateScene,
} from '@/lib/slate'
import { resolveSymbol } from '@/lib/slate-symbols'
import { roughPath, type RoughShape } from '@/lib/slate-rough'

/**
 * Slate's renderer: a scene in, DOM out.
 *
 * Plain DOM rather than React elements, because what a beat does is toggle a
 * class on a node that already exists. Rebuilding a tree sixty times a second
 * to change one class would throw away the transition that makes a board look
 * drawn rather than switched on — the shapes have to be in the document, and
 * invisible, before their beat arrives.
 *
 * That principle now carries the rest of the language too. A shape that is
 * replaced, a label that transforms, an emphasis that lifts again — all of it
 * is in the document from the first frame, waiting on a number. Nothing here
 * animates; `showBeat` decides what is true at beat n and the stylesheet does
 * the moving.
 */

const el = (tag: string, cls?: string | null, text?: string | null) => {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = text
  return node
}

/** A declared role resolves to its colour; a literal colour is used as given. */
function roleClass(lesson: SlateLesson, node: { colour?: string | null; role: string | null }) {
  const colour = node.colour || (node.role && lesson.roles[node.role]) || null
  return colour && (COLOURS as readonly string[]).includes(colour) ? 'c-' + colour : ''
}

/** ` / ` in a label is a line break: the first line is the name, the rest detail. */
function label(parent: HTMLElement, text: string) {
  String(text)
    .split(' / ')
    .forEach((part, i) => {
      parent.appendChild(el('span', i === 0 ? 'label' : 'sub', part))
    })
}

/** The stat slot: the number, set large, inside the thing it describes. */
function statBlock(text: string) {
  const stat = el('span', 'stat')
  const parts = text.split(/\s*·\s*|\s{2,}/)
  const head = parts.shift() ?? ''
  stat.appendChild(document.createTextNode(head))
  if (parts.length) stat.appendChild(el('i', null, parts.join(' · ')))
  else {
    // "100 ns per fetch" is a number and a unit: set the number large and the
    // rest small, without making the author split it by hand.
    const split = head.match(/^([\d.,]+(?:\s?(?:ms|s|ns|µs|GB|MB|KB|TB|%|x|k|M))?)\s+(.+)$/)
    if (split) {
      stat.textContent = split[1]
      stat.appendChild(el('i', null, split[2]))
    }
  }
  return stat
}

/**
 * Marks an element to have its outline drawn by hand once it has been laid out.
 *
 * The border is not CSS. It cannot be: a rough outline has to know the box's
 * real pixel size, and the box is sized by its text. So the element declares
 * what it wants drawn and `roughen` comes back for it after layout.
 */
function ink(el: HTMLElement, shape: RoughShape, seed: string) {
  el.dataset.rough = shape
  el.dataset.seed = seed
  return el
}

/** A stable seed, so the same shape wobbles the same way on every redraw. */
const seedOf = (node: SlateNode) => `${node.kind}:${node.name ?? node.text.slice(0, 12)}:${node.line}`

/** Which arrangement class a container's contents get. */
function layoutClass(node: SlateNode, fallback = '') {
  return node.layout ? `lay-${node.layout}` : fallback
}

/** A connector drawn between two steps of a flow. */
function joiner(cycle = false) {
  const join = el('div', 'fjoin' + (cycle ? ' back' : ''))
  join.insertAdjacentHTML(
    'beforeend',
    '<svg viewBox="0 0 40 12" aria-hidden="true"><line x1="0" y1="6" x2="32" y2="6"/><path d="M26 1 L34 6 L26 11"/></svg>'
  )
  return join
}

export function drawShape(lesson: SlateLesson, node: SlateNode): HTMLElement {
  const colour = roleClass(lesson, node)

  if (node.kind === 'arrow') {
    const wrap = el('div', 'arrow' + (node.style === '-->' ? ' dashed' : ''))
    if (node.text) wrap.appendChild(el('span', 'alabel', node.text))
    wrap.insertAdjacentHTML(
      'beforeend',
      `<svg viewBox="0 0 120 12" aria-hidden="true">${
        node.style === '<->' ? '<path d="M16 1 L8 6 L16 11"/>' : ''
      }<line x1="${node.style === '<->' ? 10 : 0}" y1="6" x2="110" y2="6"/><path d="M104 1 L112 6 L104 11"/></svg>`
    )
    wrap.dataset.beat = String(node.beat)
    return wrap
  }

  // A relationship that is not a flow. Drawn as a brace rather than an arrow,
  // because "shares" and "mounts" have no direction of travel and an arrowhead
  // asserts one — which is how every system diagram ended up looking like a
  // pipeline.
  if (node.kind === 'rel') {
    const wrap = el('div', 'rel')
    wrap.appendChild(el('span', 'rword', node.rel ?? ''))
    wrap.insertAdjacentHTML(
      'beforeend',
      '<svg viewBox="0 0 120 14" aria-hidden="true"><path d="M2 3 v4 a4 4 0 0 0 4 4 h48 a6 6 0 0 1 6 4 a6 6 0 0 1 6 -4 h48 a4 4 0 0 0 4 -4 v-4"/></svg>'
    )
    if (node.text) wrap.appendChild(el('span', 'alabel', node.text))
    wrap.dataset.beat = String(node.beat)
    return wrap
  }

  // A symbol, and what it is there to say. Given a caption it becomes a line
  // in a list — icon left, words right — which is how a property of a thing is
  // actually written on a board. Without one it is a small drawing beside what
  // it illustrates, which is what it always was.
  if (node.kind === 'sym') {
    const [name, caption] = splitCaption(node.text)
    const figure = el('figure', 'sym' + (caption ? ' said ' + colour : ''))
    const { art } = resolveSymbol(name, lesson.symbols)
    figure.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 48 48" aria-hidden="true">${art}</svg>`)
    figure.appendChild(el('figcaption', null, caption || name))
    figure.dataset.beat = String(node.beat)
    if (node.name) figure.dataset.name = node.name
    return figure
  }

  if (node.kind === 'ico') {
    const [glyph, caption] = splitCaption(node.text)
    const icon = el('div', 'ico' + (caption ? ' said ' + colour : ''))
    icon.appendChild(el('span', 'emoji glyph', glyph))
    if (caption) icon.appendChild(el('span', 'icaption', caption))
    icon.dataset.beat = String(node.beat)
    if (node.name) icon.dataset.name = node.name
    return icon
  }

  if (node.kind === 'img') {
    const figure = el('figure', 'photo')
    const frame = ink(el('div', 'frame'), 'rect', seedOf(node))
    if (/^https?:\/\//.test(node.text)) {
      const image = el('img') as HTMLImageElement
      image.src = node.text
      image.alt = ''
      frame.appendChild(image)
    } else {
      // Until a picture is fetched, the frame says what it is waiting for
      // rather than collapsing and moving everything around it.
      frame.insertAdjacentHTML(
        'beforeend',
        `<svg viewBox="0 0 100 76"><rect x="6" y="10" width="88" height="58"/><circle cx="34" cy="32" r="9"/><path d="M6 60l26-20 20 15 14-10 28 21"/></svg>`
      )
    }
    figure.appendChild(frame)
    figure.appendChild(el('figcaption', null, 'img · ' + node.text))
    figure.dataset.beat = String(node.beat)
    return figure
  }

  // A callout and a heading each say one thing, so each can be made to say a
  // different one. Their line lives in a `readings` stack like a shape's does,
  // which is what makes `transform` work on them.
  if (node.kind === 'callout' || node.kind === 'label' || node.kind === 'lab') {
    const heading = node.kind === 'callout'
      ? el('p', 'callout ' + colour)
      : ink(el('div', 'lab ' + colour), 'underline', seedOf(node))
    const readings = el('span', 'readings')
    const reading = el('span', 'reading', node.text)
    reading.dataset.beat = String(node.beat)
    readings.appendChild(reading)
    heading.appendChild(readings)
    heading.dataset.beat = String(node.beat)
    if (node.name) heading.dataset.name = node.name
    return heading
  }

  if (node.kind === 'txt') {
    const list = el('div', 'inner-txt', String(node.text).split(' / ').join('\n'))
    list.dataset.beat = String(node.beat)
    return list
  }

  // A part of the thing it sits in, named but not boxed. The lightest way to
  // add to a container, and the reason a container's contents no longer have
  // to be four more boxes.
  if (node.kind === 'item') {
    const item = el('div', 'item ' + colour)
    item.appendChild(el('span', 'bullet', '·'))
    item.appendChild(el('span', 'itext', node.text))
    if (node.stat) item.appendChild(el('span', 'ival', node.stat))
    item.dataset.beat = String(node.beat)
    return item
  }

  if (node.kind === 'code') {
    const block = ink(el('pre', 'code'), 'rect', seedOf(node))
    String(node.text)
      .split(' / ')
      .forEach((line) => {
        const focus = / <$/.test(line)
        block.appendChild(el('span', focus ? 'hlline' : null, line.replace(/ <$/, '')))
        block.appendChild(document.createTextNode('\n'))
      })
    block.dataset.beat = String(node.beat)
    return block
  }

  // ---- arrangement --------------------------------------------------------

  // Bare arrangement: these say where things go and nothing else. No border,
  // no label, no kind tag — a `row` that drew a box round itself would be a
  // `group`, and the whole point is that it is not one.
  if ((LAYOUT_KINDS as readonly string[]).includes(node.kind)) {
    const wrap = el('div', `lay lay-${node.kind === 'col' ? 'column' : node.kind} ${colour}`)
    for (const child of node.children) wrap.appendChild(drawShape(lesson, child))
    wrap.dataset.beat = String(node.beat)
    if (node.name) wrap.dataset.name = node.name
    return wrap
  }

  // Belonging without containment. A dashed boundary says "these go together"
  // without claiming one of them is physically inside another, which is what
  // indentation had been overloaded to mean.
  if (node.kind === 'group') {
    const wrap = ink(el('div', 'group ' + colour), 'rect', seedOf(node))
    if (node.text || node.name) {
      wrap.appendChild(el('span', 'glabel', node.text || '#' + node.name))
    }
    const kids = el('div', 'gkids ' + layoutClass(node, 'lay-row'))
    for (const child of node.children) kids.appendChild(drawShape(lesson, child))
    wrap.appendChild(kids)
    wrap.dataset.beat = String(node.beat)
    if (node.name) wrap.dataset.name = node.name
    return wrap
  }

  // Two things, weighed. The renderer knows what a comparison looks like —
  // balanced columns and a divider — so the author does not arrange one.
  if (node.kind === 'compare') {
    const wrap = el('div', 'compare ' + colour)
    const sides = node.children.length
      ? node.children.map((child) => drawShape(lesson, child))
      : node.text.split(/\s+vs\.?\s+/i).map((text) => {
          const side = el('div', 'shape k-box')
          label(side, text)
          side.dataset.beat = String(node.beat)
          return side
        })

    sides.forEach((side, i) => {
      if (i) wrap.appendChild(el('div', 'vs', 'vs'))
      const cell = el('div', 'side')
      cell.appendChild(side)
      wrap.appendChild(cell)
    })
    wrap.dataset.beat = String(node.beat)
    if (node.name) wrap.dataset.name = node.name
    return wrap
  }

  // A sequence, with its arrows drawn for it. `-> a b c d` still works and
  // still means the same thing; this is for when the sequence *is* the scene
  // and naming four shapes to join three arrows is all ceremony.
  if (node.kind === 'flow') {
    const cycle = node.layout === 'cycle'
    const wrap = el('div', `flow ${layoutClass(node, 'lay-row')}${cycle ? ' cycle' : ''} ${colour}`)
    node.children.forEach((child, i) => {
      if (i) {
        const join = joiner()
        join.dataset.beat = String(child.beat)
        wrap.appendChild(join)
      }
      const step = el('div', 'fstep')
      step.appendChild(drawShape(lesson, child))
      wrap.appendChild(step)
    })
    if (cycle && node.children.length > 1) {
      const back = joiner(true)
      back.dataset.beat = String(node.children[node.children.length - 1].beat)
      wrap.appendChild(back)
    }
    wrap.dataset.beat = String(node.beat)
    if (node.name) wrap.dataset.name = node.name
    return wrap
  }

  // ---- structures ---------------------------------------------------------
  if (node.kind === 'stk') {
    const wrap = el('div', 'stk ' + colour)
    const rows = node.rows.length
      ? node.rows
      : String(node.text)
          .split(' / ')
          .map((text, i) => ({ text, beat: node.beat, line: i }))
    for (const [i, row] of rows.entries()) {
      const layer = ink(el('div', 'layer', row.text), 'rect', `${seedOf(node)}L${i}`)
      layer.dataset.beat = String(row.beat || node.beat)
      wrap.appendChild(layer)
    }
    wrap.dataset.beat = String(node.beat)
    if (node.name) wrap.dataset.name = node.name
    return wrap
  }

  if (node.kind === 'arr') {
    const wrap = el('div', 'arr ' + colour)
    const rows = node.rows.length
      ? node.rows
      : String(node.text)
          .split(',')
          .map((text) => ({ text: text.trim(), beat: node.beat }))
    rows.forEach((row, i) => {
      // A cell with nothing in it is "and more of these" — drawn grey and
      // dashed, and not numbered, because numbering a placeholder claims it is
      // a particular one.
      const text = String(row.text ?? '').trim()
      const blank = !text || text === '-'
      const cell = ink(el('div', 'cell' + (blank ? ' blank' : '')), 'rect', `${seedOf(node)}c${i}`)
      cell.appendChild(document.createTextNode(blank ? '' : text))
      // Indices are drawn, never written: an author counting cells is an author
      // who will get it wrong once.
      if (!blank) cell.appendChild(el('i', null, String(i)))
      cell.dataset.beat = String(row.beat || node.beat)
      wrap.appendChild(cell)
    })
    wrap.dataset.beat = String(node.beat)
    if (node.name) wrap.dataset.name = node.name
    return wrap
  }

  if (node.kind === 'tbl') {
    const table = el('table', 'tbl ' + colour)
    const rows = node.rows.length
      ? node.rows
      : String(node.text)
          .split(' / ')
          .map((row, i) => ({
            cells: row.split(',').map((c) => c.trim()),
            header: i === 0,
            beat: node.beat,
          }))
    for (const row of rows) {
      const tr = el('tr')
      for (const cell of row.cells ?? []) {
        tr.appendChild(el(row.header ? 'th' : 'td', /^[\d.$£€]/.test(cell) ? 'mono' : null, cell))
      }
      tr.dataset.beat = String(row.beat || node.beat)
      table.appendChild(tr)
    }
    table.dataset.beat = String(node.beat)
    if (node.name) table.dataset.name = node.name
    return table
  }

  if (node.kind === 'chart') {
    const wrap = el('div', 'chart ' + colour)
    const title = (node.text || '').replace(/^(bar|pie|line)\s*/, '').replace(/^"|"$/g, '')
    if (title) wrap.appendChild(el('div', 'ctitle', title))

    const rows = node.rows.map((row) => {
      const parsed = String(row.text).match(/^(.*?)\s+(-?[\d.]+)$/)
      return parsed
        ? { label: parsed[1].trim(), value: Number(parsed[2]), beat: row.beat }
        : { label: row.text ?? '', value: 0, beat: row.beat }
    })
    const max = Math.max(1, ...rows.map((row) => row.value))

    for (const row of rows) {
      const line = el('div', 'barrow')
      line.appendChild(el('span', null, row.label))
      const track = el('div', 'track')
      const fill = el('div', 'fill')
      fill.style.transform = `scaleX(${Math.max(0.02, row.value / max)})`
      track.appendChild(fill)
      line.appendChild(track)
      line.appendChild(el('span', 'val', String(row.value)))
      line.dataset.beat = String(row.beat || node.beat)
      wrap.appendChild(line)
    }
    wrap.dataset.beat = String(node.beat)
    if (node.name) wrap.dataset.name = node.name
    return wrap
  }

  // ---- containers ---------------------------------------------------------
  // Each kind's outline is drawn by hand after layout: a box is four bowed
  // sides, a store is a wobbling loop, a decision is a diamond. The CSS carries
  // no border at all.
  const OUTLINE: Record<string, RoughShape> = {
    actor: 'ellipse',
    store: 'ellipse',
    choice: 'diamond',
    branch: 'diamond',
  }
  const shape = ink(
    el('div', 'shape k-' + node.kind + ' ' + colour),
    OUTLINE[node.kind] ?? 'rect',
    seedOf(node)
  )
  shape.appendChild(el('span', 'kindtag', node.kind + (node.name ? ' #' + node.name : '')))

  // The label and its number live in a "reading" — one of possibly several, if
  // the shape transforms later. They are stacked in one grid cell, so a shape
  // that becomes something else keeps the size of its largest reading and the
  // board never reflows around a word changing.
  const readings = el('span', 'readings')
  const reading = el('span', 'reading')
  label(reading, node.text || '')
  if (node.stat) reading.appendChild(statBlock(node.stat))
  reading.dataset.beat = String(node.beat)
  readings.appendChild(reading)
  shape.appendChild(readings)

  // A fork: the ways out, labelled, written inside the decision they leave.
  if (node.arms.length) {
    const arms = el('div', 'arms')
    for (const arm of node.arms) {
      const line = el('div', 'arm')
      line.appendChild(el('span', 'armlabel', arm.label))
      line.appendChild(el('span', 'armto', '→ ' + arm.target))
      line.dataset.beat = String(arm.beat)
      arms.appendChild(line)
    }
    shape.appendChild(arms)
  }

  if (node.children.length) {
    const kids = el('div', 'children ' + layoutClass(node))
    for (const child of node.children) kids.appendChild(drawShape(lesson, child))
    shape.appendChild(kids)
  }

  shape.dataset.beat = String(node.beat)
  if (node.name) shape.dataset.name = node.name
  return shape
}

export interface DrawnScene {
  fragment: DocumentFragment
  /** Every named shape in this scene, live in the fragment, for marks. */
  byName: Record<string, HTMLElement>
  /**
   * The same shapes as they were before this scene changed them — what a later
   * scene should carry forward.
   *
   * A scene is drawn more than once: every scene is drawn in order to build the
   * carry registry, and then the current one is drawn again to display. Handing
   * the *live* elements forward meant a `transform` in scene six found a shape
   * that scene six had already transformed, and added a second reading to it
   * every time the scene was redrawn. Carrying a snapshot cannot compound.
   */
  pristine: Record<string, HTMLElement>
}

/**
 * Draws a whole scene, including whatever it carries forward.
 *
 * Carried shapes lead the first row so an arrow reaching back to one has
 * something to point at, and are dimmed: present, but not what this scene is
 * about. This is what makes a sequence read as one lecture rather than as
 * fifteen posters of the same diagram.
 */
export function drawScene(
  lesson: SlateLesson,
  scene: SlateScene,
  carriedFrom: Record<string, HTMLElement> = {}
): DrawnScene {
  const fragment = document.createDocumentFragment()
  const byName: Record<string, HTMLElement> = {}

  const carried: [string, HTMLElement][] = []
  for (const name of scene.carries) {
    const source = name === 'all' ? null : carriedFrom[name]
    if (!source) continue
    const clone = source.cloneNode(true) as HTMLElement
    clone.classList.add('ghost')
    clone.dataset.beat = '0'
    // A carried shape arrives with none of the previous scene's attention on
    // it: a ring drawn in scene seven is about scene seven, and cloning it
    // forward would highlight the same box in every scene that carries it.
    for (const stale of [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]) {
      delete stale.dataset.until
      delete stale.dataset.mark
      delete stale.dataset.markBeat
      delete stale.dataset.markEnd
      delete stale.dataset.focus
      stale.classList.remove('gone', 'focused', 'unfocused')
    }
    const wrap = el('div', 'node')
    wrap.appendChild(clone)
    carried.push([name, wrap])
    byName[name] = clone
  }

  /** Every named shape's own wrapper, so a replacement lands where it stood. */
  const slots: Record<string, HTMLElement> = {}

  scene.rows.forEach((nodes, index) => {
    const row = el('div', 'row')
    const placed: Record<string, HTMLElement> = {}
    if (index === 0) {
      for (const [name, wrap] of carried) {
        row.appendChild(wrap)
        placed[name] = wrap
        slots[name] = wrap
      }
    }

    for (const node of nodes) {
      if (node.kind === 'arrow' || node.kind === 'rel') continue
      const wrap = el('div', 'node')
      const dom = drawShape(lesson, node)
      wrap.appendChild(dom)
      register(dom, byName)
      if (node.name) {
        placed[node.name] = wrap
        slots[node.name] = wrap
      }
      row.appendChild(wrap)
    }

    // Connectors are slotted between their ends rather than appended, which is
    // what makes "a leads to b" read left to right without anyone writing a
    // position. Wrapped like everything else so focus can dim them too.
    for (const link of nodes.filter((node) => node.kind === 'arrow' || node.kind === 'rel')) {
      const wrap = el('div', 'node link')
      wrap.appendChild(drawShape(lesson, link))
      const to = placed[link.names?.[1] ?? '']
      if (to) row.insertBefore(wrap, to)
      else row.appendChild(wrap)
    }

    fragment.appendChild(row)
  })

  // Taken here, between the drawing and the changing: everything the scene
  // defines, as it was defined, before a mark or a morph touched it.
  const pristine: Record<string, HTMLElement> = {}
  for (const [name, shape] of Object.entries(byName)) {
    pristine[name] = shape.cloneNode(true) as HTMLElement
  }

  // A replacement stands in the slot the old shape stood in, so the board
  // evolves rather than growing a second diagram beside the first.
  for (const swap of scene.swaps) {
    const going = byName[swap.from]
    if (!going) continue
    going.dataset.until = String(swap.beat)
    // The two share one cell, so the shape that arrives is the shape that left,
    // in the same place, at the size of whichever is larger. A slot that
    // changed height would move everything below it mid-sentence.
    slots[swap.from]?.classList.add('swapping')

    if (swap.node) {
      const arriving = drawShape(lesson, swap.node)
      arriving.dataset.beat = String(swap.beat)
      register(arriving, byName)
      ;(slots[swap.from] ?? going.parentElement)?.appendChild(arriving)
    } else {
      // Both ends already exist: move the incoming shape into the slot being
      // vacated, so the exchange happens in one place on the board.
      const coming = byName[swap.to]
      const slot = slots[swap.from]
      if (coming && slot && coming !== going) {
        coming.dataset.beat = String(swap.beat)
        slot.appendChild(coming)
      }
    }
  }

  // A shape becoming a different shape, without clearing and redrawing it.
  const byTarget = new Map<string, typeof scene.morphs>()
  for (const morph of scene.morphs) {
    byTarget.set(morph.target, [...(byTarget.get(morph.target) ?? []), morph])
  }
  for (const [target, morphs] of byTarget) {
    const shape = byName[target]
    const stack = shape?.querySelector<HTMLElement>(':scope > .readings')
    // Only a shape with a label can become a different one. A table or a chart
    // has no single reading to swap, and pretending otherwise would silently
    // do nothing — which is the failure mode Slate exists to remove.
    if (!stack) continue
    let previous = stack.lastElementChild as HTMLElement | null
    if (!previous) continue

    for (const morph of [...morphs].sort((a, b) => a.beat - b.beat)) {
      const reading = el('span', 'reading ' + roleClass(lesson, morph))
      label(reading, morph.text)
      if (morph.stat) reading.appendChild(statBlock(morph.stat))
      reading.dataset.beat = String(morph.beat)
      previous.dataset.until = String(morph.beat)
      stack.appendChild(reading)
      previous = reading
    }
  }

  // Marks and notes attach to their target wherever it ended up.
  for (const mark of scene.marks) {
    const target = markTarget(byName, mark.target)
    if (!target) continue

    if (mark.kind === 'note') {
      // A note about one row of a table still belongs under the table: a line
      // of prose wedged between two rows is not a note, it is a row.
      const note = el('p', 'note', mark.text ?? '')
      note.dataset.beat = String(mark.beat)
      const base = splitTarget(mark.target).name
      ;(slots[base] ?? byName[base]?.parentElement ?? target.parentElement)?.appendChild(note)
      continue
    }
    // `show` moves a shape's arrival; `hide` gives it a departure. Together
    // they are the two halves of "on the board" that beats alone could not say.
    if (mark.kind === 'show') {
      target.dataset.beat = String(mark.beat)
      target.classList.remove('ghost')
      continue
    }
    if (mark.kind === 'hide') {
      target.dataset.until = String(mark.beat)
      continue
    }
    if (mark.kind === 'focus') {
      target.dataset.focus = `${mark.beat}:${mark.beatEnd}`
      continue
    }
    target.dataset.mark = mark.kind
    target.dataset.markBeat = String(mark.beat)
    if (mark.beatEnd) target.dataset.markEnd = String(mark.beatEnd)
  }

  return { fragment, byName, pristine }
}

/**
 * What a mark lands on: a shape, or one row of a block.
 *
 * `hl #records.3` and `hl #stack.top` were in the specification from the first
 * day and implemented nowhere — the lookup found no shape called
 * "records.3" and quietly drew nothing. A documented feature that silently does
 * nothing is the precise failure Slate exists to end, so it is implemented
 * here and checked by the linter.
 */
function markTarget(byName: Record<string, HTMLElement>, target: string): HTMLElement | null {
  const { name, part } = splitTarget(target)
  const shape = byName[name] ?? null
  if (!shape || part == null) return shape

  const rows = Array.from(shape.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      (child.classList.contains('layer') ||
        child.classList.contains('cell') ||
        child.classList.contains('barrow') ||
        // A table's header is not a record, so it is not row one.
        (child.tagName === 'TR' && !child.querySelector('th')))
  )
  const at = rowIndex(part, rows.length)
  return at < 0 ? shape : rows[at]
}

/** Names every shape a scene drew, itself and everything it holds. */
function register(dom: HTMLElement, byName: Record<string, HTMLElement>) {
  if (dom.dataset.name) byName[dom.dataset.name] = dom
  for (const inner of Array.from(dom.querySelectorAll<HTMLElement>('[data-name]'))) {
    byName[inner.dataset.name!] = inner
  }
}

/**
 * What is true at beat n.
 *
 * Everything the language can say about time resolves here, in one pass: what
 * has arrived, what has left, what is emphasised and for how long, and where
 * the attention is. Written as a single read of the document rather than as a
 * queue of scheduled changes, so scrubbing backwards is the same operation as
 * playing forwards — which is why the transport can seek to any beat without
 * anything having to be undone.
 */
export function showBeat(board: HTMLElement, beat: number) {
  for (const node of Array.from(board.querySelectorAll<HTMLElement>('[data-beat]'))) {
    const from = Number(node.dataset.beat)
    const until = node.dataset.until ? Number(node.dataset.until) : 0
    node.classList.toggle('on', from <= beat && (!until || beat < until))
    node.classList.toggle('gone', until > 0 && beat >= until)

    if (node.dataset.mark) {
      const start = Number(node.dataset.markBeat)
      const end = node.dataset.markEnd ? Number(node.dataset.markEnd) : 0
      node.classList.toggle('marked-' + node.dataset.mark, start <= beat && (!end || beat <= end))
    }
  }

  // Attention. The newest focus whose span covers this beat wins, and
  // everything that does not contain it is pushed back — which is the thing a
  // person at a board does with their hand, and the thing a board full of
  // equally bright boxes cannot do at all.
  let active: HTMLElement | null = null
  let newest = -1
  for (const node of Array.from(board.querySelectorAll<HTMLElement>('[data-focus]'))) {
    const [from, end] = node.dataset.focus!.split(':').map(Number)
    if (from <= beat && (!end || beat <= end) && from >= newest) {
      active = node
      newest = from
    }
  }

  board.classList.toggle('focusing', Boolean(active))
  for (const was of Array.from(board.querySelectorAll<HTMLElement>('.focused'))) {
    was.classList.remove('focused')
  }
  for (const peer of Array.from(board.querySelectorAll<HTMLElement>(FOCUSABLE))) {
    // Along the path to the focused shape, or inside it, nothing is pushed
    // back. Everything else is. Written as a containment test rather than as
    // "dim the other top-level shapes" because the two halves of a `compare`
    // share one top-level shape — and focusing one half of a comparison is the
    // single most useful thing focus does.
    const near = Boolean(active) && (peer.contains(active!) || active!.contains(peer))
    peer.classList.toggle('unfocused', Boolean(active) && !near)
  }
  // The shape itself, which is rarely one of the levels above: the thing being
  // focused is usually a box inside a side inside a row.
  active?.classList.add('focused')
}

/** The levels at which attention can be pushed back: rows, sides, steps, parts. */
const FOCUSABLE = '.row > .node, .compare > .side, .flow > .fstep, .gkids > *, .lay > *'

/**
 * Draws every outline on the board by hand.
 *
 * Run after layout, because a rough edge has to know how long it is. A CSS
 * border cannot wobble and a stretched SVG wobbles wrong — a jitter scaled 4×
 * across a wide shape and 1× down a short one stops looking like a pen and
 * starts looking like a mistake. So each outline is generated in its own box's
 * pixels, once, and cached against the size that produced it.
 *
 * Idempotent by design: it is called on every redraw, on resize, and again when
 * the hand-drawn font finishes loading and every box changes width.
 */
export function roughen(board: HTMLElement) {
  for (const el of Array.from(board.querySelectorAll<HTMLElement>('[data-rough]'))) {
    const w = el.offsetWidth
    const h = el.offsetHeight
    if (!w || !h) continue

    const size = `${w}x${h}`
    if (el.dataset.roughAt === size) continue
    el.dataset.roughAt = size

    let svg = el.querySelector<SVGSVGElement>(':scope > svg.ink')
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('class', 'ink')
      svg.setAttribute('aria-hidden', 'true')
      svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'path'))
      // First child, so it paints behind the words without needing a z-index
      // on everything else.
      el.insertBefore(svg, el.firstChild)
    }

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    svg.setAttribute('width', String(w))
    svg.setAttribute('height', String(h))
    svg.firstElementChild?.setAttribute(
      'd',
      roughPath((el.dataset.rough as RoughShape) ?? 'rect', w, h, el.dataset.seed ?? 'x')
    )
  }
}
