'use client'

import { COLOURS, type SlateLesson, type SlateNode, type SlateScene } from '@/lib/slate'
import { MISSING_SYMBOL, SYMBOLS } from '@/lib/slate-symbols'

/**
 * Slate's renderer: a scene in, DOM out.
 *
 * Plain DOM rather than React elements, because what a beat does is toggle a
 * class on a node that already exists. Rebuilding a tree sixty times a second
 * to change one class would throw away the transition that makes a board look
 * drawn rather than switched on — the shapes have to be in the document, and
 * invisible, before their beat arrives.
 */

const el = (tag: string, cls?: string | null, text?: string | null) => {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = text
  return node
}

/** A declared role resolves to its colour; a literal colour is used as given. */
function roleClass(lesson: SlateLesson, node: SlateNode) {
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

  if (node.kind === 'sym') {
    const figure = el('figure', 'sym')
    const art = SYMBOLS[(node.text || '').toLowerCase()] || MISSING_SYMBOL
    figure.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 48 48" aria-hidden="true">${art}</svg>`)
    figure.appendChild(el('span', null, node.text))
    figure.dataset.beat = String(node.beat)
    return figure
  }

  if (node.kind === 'ico') {
    const icon = el('div', 'ico', node.text)
    icon.dataset.beat = String(node.beat)
    return icon
  }

  if (node.kind === 'img') {
    const figure = el('figure', 'photo')
    const frame = el('div', 'frame')
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

  if (node.kind === 'callout') {
    const line = el('p', 'callout ' + colour)
    line.appendChild(el('small', null, 'callout'))
    line.appendChild(document.createTextNode(node.text))
    line.dataset.beat = String(node.beat)
    return line
  }

  if (node.kind === 'label' || node.kind === 'lab') {
    const heading = el('div', 'lab ' + colour, node.text)
    heading.dataset.beat = String(node.beat)
    return heading
  }

  if (node.kind === 'txt') {
    const list = el('div', 'inner-txt', String(node.text).split(' / ').join('\n'))
    list.dataset.beat = String(node.beat)
    return list
  }

  if (node.kind === 'code') {
    const block = el('pre', 'code')
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

  if (node.kind === 'stk') {
    const wrap = el('div', 'stk ' + colour)
    const rows = node.rows.length
      ? node.rows
      : String(node.text)
          .split(' / ')
          .map((text) => ({ text, beat: node.beat }))
    for (const row of rows) {
      const layer = el('div', 'layer', row.text)
      layer.dataset.beat = String(row.beat || node.beat)
      wrap.appendChild(layer)
    }
    wrap.dataset.beat = String(node.beat)
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
      const cell = el('div', 'cell')
      cell.appendChild(document.createTextNode(row.text ?? ''))
      // Indices are drawn, never written: an author counting cells is an author
      // who will get it wrong once.
      cell.appendChild(el('i', null, String(i)))
      cell.dataset.beat = String(row.beat || node.beat)
      wrap.appendChild(cell)
    })
    wrap.dataset.beat = String(node.beat)
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
    return wrap
  }

  // Containers.
  const shape = el('div', 'shape k-' + node.kind + ' ' + colour)
  shape.appendChild(el('span', 'kindtag', node.kind + (node.name ? ' #' + node.name : '')))
  label(shape, node.text || '')

  if (node.stat) {
    const stat = el('span', 'stat')
    const parts = node.stat.split(/\s*·\s*|\s{2,}/)
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
    shape.appendChild(stat)
  }

  if (node.children.length) {
    const kids = el('div', 'children')
    for (const child of node.children) kids.appendChild(drawShape(lesson, child))
    shape.appendChild(kids)
  }

  shape.dataset.beat = String(node.beat)
  if (node.name) shape.dataset.name = node.name
  return shape
}

export interface DrawnScene {
  fragment: DocumentFragment
  /** Every named shape in this scene, for carrying forward and for marks. */
  byName: Record<string, HTMLElement>
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
    const wrap = el('div', 'node')
    wrap.appendChild(clone)
    carried.push([name, wrap])
    byName[name] = clone
  }

  scene.rows.forEach((nodes, index) => {
    const row = el('div', 'row')
    const placed: Record<string, HTMLElement> = {}
    if (index === 0) {
      for (const [name, wrap] of carried) {
        row.appendChild(wrap)
        placed[name] = wrap
      }
    }

    for (const node of nodes) {
      if (node.kind === 'arrow') continue
      const wrap = el('div', 'node')
      const dom = drawShape(lesson, node)
      wrap.appendChild(dom)
      if (node.name) {
        byName[node.name] = dom
        placed[node.name] = wrap
      }
      row.appendChild(wrap)
    }

    // Arrows are slotted between their ends rather than appended, which is what
    // makes "a leads to b" read left to right without anyone writing a position.
    for (const arrow of nodes.filter((node) => node.kind === 'arrow')) {
      const dom = drawShape(lesson, arrow)
      const to = placed[arrow.names?.[1] ?? '']
      if (to) row.insertBefore(dom, to)
      else row.appendChild(dom)
    }

    fragment.appendChild(row)
  })

  // Marks and notes attach to their target wherever it ended up.
  for (const mark of scene.marks) {
    const target = byName[mark.target]
    if (!target) continue
    if (mark.kind === 'note') {
      const note = el('p', 'note', mark.text ?? '')
      note.dataset.beat = String(mark.beat)
      target.parentElement?.appendChild(note)
    } else {
      target.dataset.mark = mark.kind
      target.dataset.markBeat = String(mark.beat)
    }
  }

  return { fragment, byName }
}

/** Shows everything up to `beat`, and applies whatever is marked by then. */
export function showBeat(board: HTMLElement, beat: number) {
  for (const node of Array.from(board.querySelectorAll<HTMLElement>('[data-beat]'))) {
    node.classList.toggle('on', Number(node.dataset.beat) <= beat)
    if (node.dataset.mark) {
      node.classList.toggle('marked-' + node.dataset.mark, Number(node.dataset.markBeat) <= beat)
    }
  }
}
