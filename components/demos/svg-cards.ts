'use client'

import { AssetRecordType, createShapeId, type Editor, type TLAssetId, type TLShapeId } from 'tldraw'
import { SYMBOLS } from '@/lib/slate-symbols'
import { roughRect } from '@/lib/slate-rough'
import { highlight, type TokenKind } from '@/lib/slate-code'

/**
 * Icons and code, authored as SVG and inserted into tldraw as images.
 *
 * Drawing icons out of freehand tldraw strokes was the wrong tool twice over:
 * the freehand renderer bulges sparse geometry into scribble, and an icon is
 * not a pen gesture — it is a *drawing*, with parts and proportions. So the
 * glyphs come from the same hand-drawn symbol set the Slate engine publishes,
 * wobbled by a displacement filter so they sit naturally on a hand-drawn
 * board, and arrive on the canvas as image shapes.
 *
 * Code gets the same treatment. tldraw text cannot colour a token or keep a
 * column; an SVG card can do both, wear the house rough border, and still be
 * one grabbable shape on the wall.
 */

const INK = '#1c1a17'
const PAPER = '#fbfaf7'
const TONE: Record<string, string> = {
  black: INK,
  grey: '#8e8e98',
  red: '#c8442a',
  blue: '#2d4a7c',
  green: '#3f6b4a',
  orange: '#b07d1a',
}

/** Glyphs the lesson needs that the published set does not carry. */
const EXTRA: Record<string, string> = {
  bricks:
    '<rect x="5" y="12" width="38" height="24" rx="1"/><path d="M5 20h38M5 28h38M17 12v8M31 20v8M17 28v8"/>',
  gauge:
    '<path d="M8 34a16 16 0 1 1 32 0"/><path d="M24 34 33 22"/><circle cx="24" cy="34" r="2.4"/><path d="M10 28l3 2M38 28l-3 2M24 16v4"/>',
  check: '<path d="M10 26l9 10L38 12"/>',
  tree: '<path d="M14 8v32M14 14h10M14 24h16M14 34h10M30 24v10h8"/>',
  trophy:
    '<path d="M15 8h18v10a9 9 0 0 1-18 0Z"/><path d="M15 11H8a7 7 0 0 0 7 9M33 11h7a7 7 0 0 1-7 9"/><path d="M24 27v7M17 40h14M20 34h8v6"/>',
  bolt: '<path d="M27 5 12 27h9l-2 16 15-22h-9z"/>',
  camera:
    '<rect x="6" y="14" width="36" height="26" rx="3"/><circle cx="24" cy="27" r="8"/><path d="M17 14l3-5h8l3 5M35 20h2"/>',
  fork: '<circle cx="24" cy="9" r="4"/><circle cx="12" cy="39" r="4"/><circle cx="36" cy="39" r="4"/><path d="M24 13v8M24 21c0 8-12 6-12 14M24 21c0 8 12 6 12 14"/>',
  pages:
    '<path d="M10 6h18l6 6v22H10z"/><path d="M28 6v6h6"/><path d="M16 40h20V18" fill="none"/>',
  plug: '<path d="M18 6v10M30 6v10M14 16h20v8a10 10 0 0 1-20 0Z"/><path d="M24 34v8"/>',
}

const seedOf = (name: string) => {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997
  return h
}

/** A named glyph as a standalone hand-drawn SVG document. */
export function iconSvg(name: string, color = 'black'): string {
  const art = SYMBOLS[name] ?? EXTRA[name] ?? EXTRA.bricks
  const stroke = TONE[color] ?? INK
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="-4 -4 56 56">` +
    `<filter id="w" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="${seedOf(name)}"/>` +
    `<feDisplacementMap in="SourceGraphic" scale="2.6"/></filter>` +
    `<g filter="url(#w)" fill="none" stroke="${stroke}" stroke-width="2.3" ` +
    `stroke-linecap="round" stroke-linejoin="round">${art}</g></svg>`
  )
}

const TOKEN_FILL: Record<Exclude<TokenKind, null>, string> = {
  com: '#8e8e98',
  str: '#3f6b4a',
  num: '#b07d1a',
  key: '#6741d9',
  cmd: '#2d4a7c',
}

const escape = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Wide enough for the widest line, in a 15px monospace. */
const CH = 9.1
const LINE = 27

/** A code card: coloured tokens, a rough border, one insertable drawing. */
export function codeSvg(lines: string[], title?: string): { svg: string; w: number; h: number } {
  const padX = 26
  const padY = 22
  const titleH = title ? 30 : 0
  const w = Math.round(Math.max(...lines.map((l) => l.length), title ? title.length + 4 : 0) * CH + padX * 2)
  const h = Math.round(lines.length * LINE + padY * 2 + titleH)

  const rows = lines
    .map((line, i) => {
      const y = padY + titleH + (i + 0.75) * LINE
      const spans = highlight(line)
        .map((t) =>
          t.kind
            ? `<tspan fill="${TOKEN_FILL[t.kind]}">${escape(t.text)}</tspan>`
            : escape(t.text)
        )
        .join('')
      return `<text x="${padX}" y="${y}" xml:space="preserve" font-family="ui-monospace,Menlo,monospace" font-size="15" fill="${INK}">${spans}</text>`
    })
    .join('')

  const head = title
    ? `<text x="${padX}" y="${padY + 8}" font-family="ui-monospace,Menlo,monospace" font-size="11" letter-spacing="2.5" fill="#8e8e98">${escape(title.toUpperCase())}</text>`
    : ''

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 12}" height="${h + 12}" viewBox="-6 -6 ${w + 12} ${h + 12}">` +
    `<rect x="0" y="0" width="${w}" height="${h}" rx="4" fill="${PAPER}"/>` +
    `<path d="${roughRect(w, h, lines[0] ?? 'code')}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` +
    head +
    rows +
    `</svg>`
  return { svg, w: w + 12, h: h + 12 }
}

/** One asset per distinct drawing per editor, however often it is re-created. */
const assetCache = new WeakMap<Editor, Map<string, TLAssetId>>()

function assetFor(editor: Editor, svg: string, w: number, h: number, name: string): TLAssetId {
  let cache = assetCache.get(editor)
  if (!cache) {
    cache = new Map()
    assetCache.set(editor, cache)
  }
  const hit = cache.get(svg)
  if (hit) return hit

  const id = AssetRecordType.createId()
  editor.createAssets([
    {
      id,
      type: 'image',
      typeName: 'asset',
      meta: {},
      props: {
        w,
        h,
        name,
        isAnimated: false,
        mimeType: 'image/svg+xml',
        src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      },
    },
  ])
  cache.set(svg, id)
  return id
}

/** Puts a hand-drawn glyph on the wall at `px` tall. */
export function icon(
  editor: Editor,
  name: string,
  x: number,
  y: number,
  px = 110,
  color = 'black'
): TLShapeId[] {
  const svg = iconSvg(name, color)
  const assetId = assetFor(editor, svg, 56, 56, name)
  const id = createShapeId()
  editor.createShape({
    id,
    type: 'image',
    x,
    y,
    opacity: 0,
    props: { w: px, h: px, assetId, playing: true, altText: name },
  })
  return [id]
}

/** Puts a highlighted code card on the wall, at its natural size. */
export function code(
  editor: Editor,
  x: number,
  y: number,
  lines: string[],
  opts: { title?: string; scale?: number } = {}
): TLShapeId[] {
  const { svg, w, h } = codeSvg(lines, opts.title)
  const assetId = assetFor(editor, svg, w, h, opts.title ?? 'code')
  const k = opts.scale ?? 1
  const id = createShapeId()
  editor.createShape({
    id,
    type: 'image',
    x,
    y,
    opacity: 0,
    props: { w: w * k, h: h * k, assetId, playing: true, altText: lines.join('\n') },
  })
  return [id]
}
