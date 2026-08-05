import { compileToPython } from './math-expr'
import type { ManimMobject, ManimScene, ManimStep } from './manim-lesson'

/**
 * Compiles a lesson scene into a Manim Python script.
 *
 * The model never writes Python. It writes the declarative scene language, and
 * this emits code from it — because the file produced here is executed by the
 * server, and a topic is user input. Everything that reaches the output is
 * either a number we clamped, a name from a fixed enum, or a string literal
 * escaped through JSON. Identifiers are rewritten, so a mobject id cannot
 * become a statement.
 *
 * The counterpart to `components/manim/build.ts`, which does the same job
 * against manim-ts in the browser. Same scene language, two renderers.
 */

const COLORS: Record<string, string> = {
  white: '#FFFFFF',
  grey: '#888888',
  blue: '#58C4DD',
  teal: '#5CD0B3',
  green: '#83C167',
  yellow: '#FFFF00',
  gold: '#F0AC5F',
  red: '#FC6255',
  maroon: '#C55F73',
  purple: '#9A72AC',
  pink: '#D147BD',
  orange: '#FF862F',
}

/** A Python float literal. Never NaN or Infinity, which are not literals there. */
function num(value: number, fallback = 0) {
  const safe = Number.isFinite(value) ? value : fallback
  return safe.toFixed(4)
}

/** A Python string literal. JSON's escaping is a subset of Python's. */
function str(value: string) {
  return JSON.stringify(String(value ?? ''))
}

function point(x: number, y: number) {
  return `[${num(x)}, ${num(y)}, 0]`
}

function colorOf(spec: { color: string }) {
  return str(COLORS[spec.color] ?? COLORS.white)
}

/**
 * Python identifiers for mobjects. The model's ids are arbitrary text, so they
 * are rewritten rather than interpolated — the whole point of compiling instead
 * of letting the model emit code.
 */
function nameTable(scene: ManimScene) {
  const names = new Map<string, string>()
  scene.mobjects.forEach((mobject, index) => {
    const safe = mobject.id.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 40)
    names.set(mobject.id, `m${index}_${safe}`)
  })
  return names
}

function styleArgs(spec: ManimMobject, stroke = 4) {
  return `color=${colorOf(spec)}, fill_opacity=${num(spec.fill)}, stroke_width=${num(stroke)}`
}

/** The two endpoints of a line-like mobject, falling back to a horizontal span. */
function endpoints(spec: ManimMobject) {
  const [a, b] = spec.points
  if (a && b) return [point(a.x, a.y), point(b.x, b.y)]
  return [point(spec.x - spec.w / 2, spec.y), point(spec.x + spec.w / 2, spec.y)]
}

/** The constructor call for one mobject, or null if it can't be expressed. */
function construct(
  spec: ManimMobject,
  names: Map<string, string>
): { expression: string; positioned: boolean } | null {
  const style = styleArgs(spec)

  switch (spec.kind) {
    case 'circle':
      return { expression: `Circle(radius=${num(spec.w / 2)}, ${style})`, positioned: false }
    case 'ellipse':
      return {
        expression: `Ellipse(width=${num(spec.w)}, height=${num(spec.h)}, ${style})`,
        positioned: false,
      }
    case 'dot':
      return {
        expression: `Dot(point=${point(spec.x, spec.y)}, radius=${num(Math.max(0.04, spec.w / 2))}, color=${colorOf(spec)})`,
        positioned: true,
      }
    case 'square':
      return { expression: `Square(side_length=${num(spec.w)}, ${style})`, positioned: false }
    case 'rectangle':
      return {
        expression: `Rectangle(width=${num(spec.w)}, height=${num(spec.h)}, ${style})`,
        positioned: false,
      }
    case 'triangle':
      return { expression: `Triangle(${style}).scale(${num(spec.w / 2)})`, positioned: false }
    case 'regularPolygon':
      return {
        expression: `RegularPolygon(n=${Math.round(spec.sides)}, ${style}).scale(${num(spec.w / 2)})`,
        positioned: false,
      }
    case 'polygon': {
      if (spec.points.length < 3) return null
      const vertices = spec.points.map((p) => point(p.x, p.y)).join(', ')
      return { expression: `Polygon(${vertices}, ${style})`, positioned: true }
    }
    case 'arc':
      return {
        expression: `Arc(radius=${num(spec.w / 2)}, start_angle=0, angle=${spec.angle ? `${num(spec.angle)} * DEGREES` : 'PI'}, ${style})`,
        positioned: false,
      }
    case 'line': {
      const [start, end] = endpoints(spec)
      return { expression: `Line(${start}, ${end}, ${style})`, positioned: true }
    }
    case 'dashedLine': {
      const [start, end] = endpoints(spec)
      return { expression: `DashedLine(${start}, ${end}, ${style})`, positioned: true }
    }
    case 'arrow':
    case 'vector': {
      const [start, end] = endpoints(spec)
      // buff=0 so the arrow reaches exactly the points it was given, rather
      // than being inset from them the way manim does by default.
      return { expression: `Arrow(${start}, ${end}, buff=0, ${style})`, positioned: true }
    }
    case 'text':
      return {
        expression: `Text(${str(spec.text)}, font_size=${num(spec.size)}, color=${colorOf(spec)})`,
        positioned: false,
      }
    case 'math':
      // Text, not MathTex: the prompt asks for Unicode rather than LaTeX, so
      // there is nothing for a LaTeX pipeline to do — and requiring one would
      // add a gigabyte of TeX to the install for no gain.
      return {
        expression: `Text(${str(spec.text)}, font_size=${num(spec.size)}, color=${colorOf(spec)}, slant=ITALIC)`,
        positioned: false,
      }
    case 'axes':
      return {
        expression:
          `Axes(x_range=[${num(spec.xRange[0])}, ${num(spec.xRange[1])}, ${num(spec.xRange[2] || 1)}], ` +
          `y_range=[${num(spec.yRange[0])}, ${num(spec.yRange[1])}, ${num(spec.yRange[2] || 1)}], ` +
          `x_length=${num(spec.w)}, y_length=${num(spec.h)}, ` +
          `axis_config={"color": ${colorOf(spec)}, "stroke_width": 2})`,
        positioned: false,
      }
    case 'numberPlane':
      return {
        expression:
          `NumberPlane(x_range=[${num(spec.xRange[0])}, ${num(spec.xRange[1])}, ${num(spec.xRange[2] || 1)}], ` +
          `y_range=[${num(spec.yRange[0])}, ${num(spec.yRange[1])}, ${num(spec.yRange[2] || 1)}])`,
        positioned: false,
      }
    case 'plot': {
      const axes = spec.of ? names.get(spec.of) : null
      const body = compileToPython(spec.text)
      if (!axes || !body) return null
      return {
        expression: `${axes}.plot(lambda x: ${body}, color=${colorOf(spec)}, stroke_width=4)`,
        positioned: true,
      }
    }
    case 'surround': {
      const target = spec.of ? names.get(spec.of) : null
      if (!target) return null
      return {
        expression: `SurroundingRectangle(${target}, color=${colorOf(spec)}, buff=0.15)`,
        positioned: true,
      }
    }
    case 'group': {
      const members = spec.members.map((id) => names.get(id)).filter(Boolean)
      if (!members.length) return null
      return { expression: `VGroup(${members.join(', ')})`, positioned: true }
    }
  }
}

/** The animation calls for one step. */
function animate(step: ManimStep, names: Map<string, string>): string[] {
  const targets = step.targets.map((id) => names.get(id)).filter(Boolean) as string[]
  if (!targets.length) return []

  const out: string[] = []
  for (const target of targets) {
    switch (step.action) {
      case 'create':
      case 'write':
        // Write handles both; Create on a Text has no outline to trace.
        out.push(`Create(${target})`)
        break
      case 'uncreate':
        out.push(`Uncreate(${target})`)
        break
      case 'fadeIn':
        out.push(`FadeIn(${target})`)
        break
      case 'fadeOut':
        out.push(`FadeOut(${target})`)
        break
      case 'grow':
        out.push(`GrowFromCenter(${target})`)
        break
      case 'shrink':
        out.push(`ShrinkToCenter(${target})`)
        break
      case 'spiralIn':
        out.push(`SpiralIn(${target})`)
        break
      case 'indicate':
        out.push(`Indicate(${target})`)
        break
      case 'flash':
        out.push(`Flash(${target}.get_center())`)
        break
      case 'wiggle':
        out.push(`Wiggle(${target})`)
        break
      case 'circumscribe':
        out.push(`Circumscribe(${target})`)
        break
      case 'rotate':
        out.push(`Rotate(${target}, angle=${num(step.angle)} * DEGREES)`)
        break
      case 'shift':
        out.push(`${target}.animate.shift(${point(step.dx, step.dy)})`)
        break
      case 'scale':
        out.push(`${target}.animate.scale(${num(step.factor, 1)})`)
        break
      case 'moveTo':
        out.push(`${target}.animate.move_to(${point(step.dx, step.dy)})`)
        break
      case 'transform': {
        const destination = step.to ? names.get(step.to) : null
        if (destination) out.push(`Transform(${target}, ${destination})`)
        break
      }
      case 'wait':
        break
    }
  }
  return out
}

export interface RenderPlan {
  /** Seconds into the scene at which each step fires, keyed by step id. */
  schedule: Record<string, number>
  /** Total scene length, so the video runs as long as the narration does. */
  duration: number
}

/**
 * Emits the Python for one scene.
 *
 * Unlike the browser renderer, a rendered video cannot wait for the voice — so
 * the timing is baked in here. That is why rendering happens *after* the
 * voiceover exists: by then the real anchor times are known, and the waits
 * emitted between steps put every animation on the word it belongs to.
 */
export function sceneToPython(scene: ManimScene, plan: RenderPlan): string {
  const names = nameTable(scene)
  const body: string[] = []

  const built = new Set<string>()
  let pending = [...scene.mobjects]

  // Same dependency loop as the browser builder: `plot` needs its axes and
  // `surround` needs its target, and the model may declare them in any order.
  for (;;) {
    const deferred: ManimMobject[] = []
    let progressed = false

    // Forward order, so the generated file reads the way the model wrote it —
    // which is what you want when Python hands back a traceback with a line
    // number on it.
    for (const spec of pending) {
      const dependencies = [spec.of, ...spec.members].filter(Boolean) as string[]
      if (dependencies.some((id) => !built.has(id))) {
        deferred.push(spec)
        continue
      }

      const result = construct(spec, names)
      if (result) {
        const name = names.get(spec.id)!
        body.push(`${name} = ${result.expression}`)
        if (spec.angle && spec.kind !== 'arc') {
          body.push(`${name}.rotate(${num(spec.angle)} * DEGREES)`)
        }
        if (!result.positioned) body.push(`${name}.move_to(${point(spec.x, spec.y)})`)
        built.add(spec.id)
      }
      progressed = true
    }

    pending = deferred
    // Nothing built this pass means whatever is left is a reference cycle.
    if (!progressed || !pending.length) break
  }

  // Anything no step touches is the setting: on screen from the first frame.
  const animated = new Set(
    scene.steps.flatMap((step) => [...step.targets, step.to].filter(Boolean) as string[])
  )
  for (const spec of scene.mobjects) {
    if (animated.has(spec.id)) for (const member of spec.members) animated.add(member)
  }
  const statics = scene.mobjects
    .filter((spec) => built.has(spec.id) && !animated.has(spec.id))
    .map((spec) => names.get(spec.id)!)
  if (statics.length) body.push(`self.add(${statics.join(', ')})`)

  // Walk the timeline, waiting out the gaps between steps.
  let clock = 0
  for (const step of scene.steps) {
    const start = Math.max(clock, plan.schedule[step.id] ?? clock)
    if (start > clock + 0.02) body.push(`self.wait(${num(start - clock)})`)
    clock = start

    if (step.action === 'wait') {
      body.push(`self.wait(${num(step.runTime, 1)})`)
      clock += step.runTime
      continue
    }

    const calls = animate(step, names)
    if (!calls.length) continue
    const runTime = num(step.runTime, 1)
    body.push(
      calls.length === 1
        ? `self.play(${calls[0]}, run_time=${runTime})`
        : `self.play(AnimationGroup(${calls.join(', ')}, lag_ratio=${num(step.lag)}), run_time=${runTime})`
    )
    clock += step.runTime
  }

  // Hold the last frame so the video is as long as the narration over it.
  if (plan.duration > clock + 0.05) body.push(`self.wait(${num(plan.duration - clock)})`)
  if (!body.length) body.push('self.wait(1)')

  const indented = body.map((line) => `        ${line}`).join('\n')

  return `# Generated by viop. Do not edit.
import math

from manim import *


class LessonScene(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
${indented}
`
}
