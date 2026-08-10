import katex from 'katex'
import type { BoardShape } from '@/lib/lesson'
import type { PlotDrawing } from '@/lib/plot'
import { edgePoint, inkArrowhead, inkEllipse, inkLine, inkRect, tilt } from './ink'
import { STROKE, TYPE, dashArray, inkOf } from './palette'

/**
 * One board shape, as SVG.
 *
 * Geometry is drawn as paths — see ink.ts for why they wander — and text is
 * real HTML inside a foreignObject rather than SVG <text>. That is the whole
 * reason the labels wrap, centre and ellipsize without this file having to
 * measure a font: the browser already knows how, and a board is mostly text in
 * boxes that were sized before anyone knew what would be typed in them.
 */

/** How far behind and below a filled shape its saturated twin sits. */
const SHADOW = 7

export function Shape({
  shape,
  shapes,
  symbol,
}: {
  shape: BoardShape
  /** Everything on the board, so an arrow can find the shapes it joins. */
  shapes: Map<string, BoardShape>
  /** Resolved symbol art, when the lookup has come back. */
  symbol?: string
}) {
  const { ink, wash, shadow } = inkOf(shape.color)
  const weight = STROKE[shape.size]
  const filled = shape.fill !== 'none'

  const common = {
    fill: 'none',
    stroke: ink,
    strokeWidth: weight,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeDasharray: dashArray(shape.dash, weight),
  }

  if (shape.kind === 'arrow') {
    const from = shape.from ? shapes.get(shape.from) : undefined
    const to = shape.to ? shapes.get(shape.to) : undefined
    if (!from || !to) return null

    // Two shapes in different columns are joined side to side, whatever their
    // heights: a connector that leaves through the bottom of a box and climbs
    // to the one above it travels through the column in between, and on a
    // mindmap that column is the paragraph written under the node it is aiming
    // at. Only when the boxes actually sit above one another does the shortest
    // edge-to-edge line win.
    const apart = to.x > from.x + from.w || from.x > to.x + to.w
    const rightward = to.x > from.x

    const start = apart
      ? { x: rightward ? from.x + from.w + 6 : from.x - 6, y: from.y + from.h / 2 }
      : edgePoint(from, { x: to.x + to.w / 2, y: to.y + to.h / 2 }, 6)
    const end = apart
      ? { x: rightward ? to.x - 9 : to.x + to.w + 9, y: to.y + to.h / 2 }
      : edgePoint(to, { x: from.x + from.w / 2, y: from.y + from.h / 2 }, 9)

    // A connector between two columns arrives horizontally, on an S-curve
    // whose control points sit on the line between them. That keeps the whole
    // stroke inside the corridor separating the columns — a straight diagonal
    // leaves it, and on a mindmap what it leaves it through is the paragraph
    // written under the node it is pointing at.
    const dx = end.x - start.x
    const dy = end.y - start.y
    const sideways = apart || Math.abs(dx) >= Math.abs(dy)

    const path = sideways
      ? `M ${start.x} ${start.y} C ${start.x + dx * 0.5} ${start.y}, ${end.x - dx * 0.5} ${end.y}, ${end.x} ${end.y}`
      : `M ${start.x} ${start.y} C ${start.x} ${start.y + dy * 0.5}, ${end.x} ${end.y - dy * 0.5}, ${end.x} ${end.y}`

    // The head follows the curve's tangent, which at the end is flat.
    const approach = sideways
      ? { x: end.x - Math.sign(dx) * 24, y: end.y }
      : { x: end.x, y: end.y - Math.sign(dy) * 24 }

    return (
      <g data-shape-id={shape.id} style={{ pointerEvents: 'none' }}>
        <path d={path} {...common} strokeWidth={weight * 0.9} />
        <path
          d={inkArrowhead(end, approach, shape.id, 14)}
          {...common}
          strokeWidth={weight * 0.9}
          strokeDasharray={undefined}
        />
      </g>
    )
  }

  const body = (() => {
    switch (shape.kind) {
      case 'ellipse':
      case 'oval':
        return {
          d: inkEllipse(
            shape.x + shape.w / 2,
            shape.y + shape.h / 2,
            shape.w / 2,
            shape.h / 2,
            shape.id
          ),
          label: 'centre' as const,
        }
      case 'text':
        return { d: '', label: 'start' as const }
      case 'label':
        // Bare lettering with a rule under it — a note on a limb, not another
        // box. The rule is what keeps it from floating.
        return {
          d: inkLine(
            { x: shape.x + 4, y: shape.y + shape.h - 2 },
            { x: shape.x + shape.w - 4, y: shape.y + shape.h - 2 },
            shape.id,
            'rule'
          ),
          label: 'centre' as const,
          rule: true,
        }
      case 'symbol':
        return { d: '', label: 'none' as const }
      case 'plot':
        return { d: '', label: 'none' as const }
      case 'math':
        // Written on the page, not framed on it. The one exception is the
        // answer, which is boxed — because that is what a person does when
        // they get to the end of a piece of working.
        return {
          d: shape.fill === 'semi' ? inkRect(shape.x, shape.y, shape.w, shape.h, shape.id) : '',
          label: 'none' as const,
        }
      case 'note':
        // No frame. A box around a sentence is a box that has to be read as
        // well as the sentence, and a column of them turns an argument into a
        // form. The equations keep theirs — those are what the eye returns to.
        return { d: '', label: 'start' as const, note: true }
      default:
        return { d: inkRect(shape.x, shape.y, shape.w, shape.h, shape.id), label: 'centre' as const }
    }
  })()

  return (
    <g
      data-shape-id={shape.id}
      transform={`rotate(${tilt(shape.id)} ${shape.x + shape.w / 2} ${shape.y + shape.h / 2})`}
      style={{ cursor: 'pointer' }}
    >
      {/*
        The hit area.

        SVG only registers a hit on geometry that was actually painted, so
        without this a node is clickable on its outline and its lettering and
        nowhere in between — and a leaf, whose only stroke is a thin rule under
        the words, is nearly unclickable. A transparent fill still takes hits,
        which `fill="none"` does not.
      */}
      <rect
        x={shape.x}
        y={shape.y}
        width={Math.max(1, shape.w)}
        height={Math.max(1, shape.h)}
        fill="transparent"
      />

      {/* The saturated twin, offset. Only under filled shapes, and never under
          black or grey, where it reads as a smudge rather than a shadow. */}
      {filled && shadow && body.d && !body.rule && (
        <path
          d={body.d}
          transform={`translate(${SHADOW} ${SHADOW})`}
          fill={shadow}
          opacity={0.16}
          stroke="none"
        />
      )}

      {filled && body.d && !body.rule && <path d={body.d} fill={wash} stroke="none" />}
      {body.d && <path d={body.d} {...common} />}

      {shape.kind === 'plot' && <Plot shape={shape} ink={ink} />}

      {/*
        LaTeX, typeset by KaTeX into the same foreignObject the board uses for
        everything else. `throwOnError` is off on purpose: a model that writes
        one malformed macro should cost its own line, not the whole solution.
      */}
      {shape.kind === 'math' && shape.text.trim() && (
        <foreignObject
          x={shape.x}
          y={shape.y}
          width={Math.max(1, shape.w)}
          height={Math.max(1, shape.h)}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              // Indented from the margin, the way working is written down a
              // page — centred equations read as slides, not as a notebook.
              justifyContent: shape.fill === 'semi' ? 'center' : 'flex-start',
              padding: '4px 18px',
              boxSizing: 'border-box',
              overflow: 'hidden',
              color: ink,
              fontSize: 21,
            }}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(shape.text, {
                throwOnError: false,
                displayMode: true,
                output: 'html',
              }),
            }}
          />
        </foreignObject>
      )}

      {shape.kind === 'symbol' && symbol && (
        <image
          href={symbol}
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          preserveAspectRatio="xMidYMid meet"
        />
      )}

      {body.label !== 'none' && shape.text.trim() && (
        <foreignObject
          x={shape.x}
          y={shape.y}
          width={Math.max(1, shape.w)}
          height={Math.max(1, shape.h)}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: body.note ? 'flex-start' : 'center',
              justifyContent: body.label === 'centre' ? 'center' : 'flex-start',
              // A label's rule is drawn along the bottom of its box, so the
              // words have to sit off it rather than on it.
              padding: body.rule ? '2px 6px 10px' : body.label === 'centre' ? '4px 10px' : '0 2px',
              boxSizing: 'border-box',
              fontFamily: 'var(--font-hand), ui-rounded, "Comic Sans MS", cursive',
              fontSize: TYPE[shape.size],
              lineHeight: 1.15,
              textAlign: body.label === 'centre' ? 'center' : 'left',
              color: ink,
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              userSelect: 'none',
            }}
          >
            {body.note ? <Note text={shape.text} /> : shape.text}
          </div>
        </foreignObject>
      )}
    </g>
  )
}

/**
 * A card whose first line is its heading.
 *
 * One shape rather than two, because a heading and the sentence under it are
 * one thought — and on a board you can pan away from, two shapes are two
 * things that can end up on different screens.
 */
function Note({ text }: { text: string }) {
  const [heading, ...rest] = text.split('\n')
  const body = rest.join('\n').trim()

  return (
    <span style={{ display: 'block', width: '100%' }}>
      <span style={{ display: 'block', fontSize: '1.15em', letterSpacing: '-0.01em' }}>
        {heading}
      </span>
      {body && (
        <span style={{ display: 'block', marginTop: 6, opacity: 0.75 }}>{body}</span>
      )}
    </span>
  )
}

/**
 * A graph, drawn from the sampling lib/plot.ts already did.
 *
 * Everything arrives in [0,1] and is mapped into the shape's box here, which
 * is what lets the same drawing be shown at any size without re-sampling. A
 * NaN in a curve is a break rather than a point — an asymptote is a gap, not a
 * vertical line through the whole plot.
 */
function Plot({ shape, ink }: { shape: BoardShape; ink: string }) {
  let drawn: PlotDrawing
  try {
    drawn = JSON.parse(shape.text) as PlotDrawing
  } catch {
    return null
  }

  const pad = 34
  const left = shape.x + pad
  const top = shape.y + 8
  const width = shape.w - pad * 2
  const height = shape.h - pad - 26
  const px = (x: number) => left + x * width
  const py = (y: number) => top + y * height

  const path = (points: { x: number; y: number }[]) => {
    let d = ''
    let open = false
    for (const point of points) {
      if (!Number.isFinite(point.y)) {
        open = false
        continue
      }
      d += `${open ? ' L' : ' M'} ${px(point.x).toFixed(1)} ${py(point.y).toFixed(1)}`
      open = true
    }
    return d.trim()
  }

  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={left} y={top} width={width} height={height} fill="#ffffff" opacity={0.55} />

      {/* Axes, where they fall inside the window. */}
      {drawn.originY !== null && (
        <line x1={left} y1={py(drawn.originY)} x2={left + width} y2={py(drawn.originY)} stroke="#0f172a" strokeOpacity={0.35} strokeWidth={1.2} />
      )}
      {drawn.originX !== null && (
        <line x1={px(drawn.originX)} y1={top} x2={px(drawn.originX)} y2={top + height} stroke="#0f172a" strokeOpacity={0.35} strokeWidth={1.2} />
      )}

      {drawn.ticks.map((tick) => (
        <g key={`x${tick.label}`}>
          <line x1={px(tick.x)} y1={top + height} x2={px(tick.x)} y2={top + height + 5} stroke="#0f172a" strokeOpacity={0.3} strokeWidth={1} />
          <text x={px(tick.x)} y={top + height + 19} textAnchor="middle" fontSize={13} fill="#64748b">
            {tick.label}
          </text>
        </g>
      ))}
      {drawn.yTicks.map((tick) => (
        <text key={`y${tick.label}`} x={left - 8} y={py(tick.y) + 4} textAnchor="end" fontSize={13} fill="#64748b">
          {tick.label}
        </text>
      ))}

      {drawn.curves.map((curve, i) => (
        <path
          key={i}
          d={path(curve.points)}
          fill="none"
          stroke={ink}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={i === 0 ? 1 : 0.65}
        />
      ))}

      {drawn.marks.map((mark, i) => (
        <g key={`m${i}`}>
          <circle cx={px(mark.x)} cy={py(mark.y)} r={4.5} fill={ink} />
          <text x={px(mark.x) + 8} y={py(mark.y) - 8} fontSize={14} fill={ink}>
            {mark.label}
          </text>
        </g>
      ))}

      {drawn.caption && (
        <text x={left} y={shape.y + shape.h - 4} fontSize={14} fill="#64748b">
          {drawn.caption}
        </text>
      )}
    </g>
  )
}
