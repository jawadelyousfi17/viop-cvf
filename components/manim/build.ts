'use client'

import {
  Arc,
  Arrow,
  Axes,
  Circle,
  Create,
  Circumscribe,
  DashedLine,
  Dot,
  Ellipse,
  FadeIn,
  FadeOut,
  Flash,
  GrowFromCenter,
  Indicate,
  Line,
  MathTex,
  Mobject,
  NumberPlane,
  Polygon,
  Rectangle,
  RegularPolygon,
  MethodAnimation,
  OUT,
  Rotate,
  ShrinkToCenter,
  SpiralIn,
  Square,
  SurroundingRectangle,
  Text,
  Transform,
  Triangle,
  Uncreate,
  Unwrite,
  VGroup,
  VMobject,
  Vector,
  Wiggle,
  Write,
  BLUE,
  GOLD,
  GREEN,
  GREY,
  MAROON,
  ORANGE,
  PINK,
  PURPLE,
  RED,
  TEAL,
  WHITE,
  YELLOW,
  DEGREES,
  type Animation,
  type Vec3,
} from 'manim-ts'
import { compileExpression } from '@/lib/math-expr'
import type { ManimMobject, ManimScene, ManimStep } from '@/lib/manim-lesson'

const COLORS: Record<string, string> = {
  white: WHITE,
  grey: GREY,
  blue: BLUE,
  teal: TEAL,
  green: GREEN,
  yellow: YELLOW,
  gold: GOLD,
  red: RED,
  maroon: MAROON,
  purple: PURPLE,
  pink: PINK,
  orange: ORANGE,
}

/** Everything a built scene needs to animate itself. */
export interface BuiltScene {
  mobjects: Map<string, Mobject>
  /** Mobjects that should already be on screen — nothing ever animates them in. */
  initial: Mobject[]
}

function styleOf(spec: ManimMobject) {
  const color = COLORS[spec.color] ?? WHITE
  return {
    color,
    fillColor: color,
    fillOpacity: spec.fill,
    strokeWidth: 4,
  }
}

const at = (spec: ManimMobject): Vec3 => [spec.x, spec.y, 0]

/** The two endpoints of a line-like mobject, falling back to a horizontal span. */
function endpoints(spec: ManimMobject): [Vec3, Vec3] {
  const [a, b] = spec.points
  if (a && b) return [[a.x, a.y, 0], [b.x, b.y, 0]]
  return [
    [spec.x - spec.w / 2, spec.y, 0],
    [spec.x + spec.w / 2, spec.y, 0],
  ]
}

/**
 * Builds every mobject in a scene.
 *
 * Two kinds refer to others — `plot` needs its axes and `surround` needs the
 * thing it boxes — so this loops until a pass builds nothing new rather than
 * assuming the model declared them in dependency order. Anything still unbuilt
 * after that is part of a reference cycle and is skipped.
 */
export function buildScene(scene: ManimScene): BuiltScene {
  const mobjects = new Map<string, Mobject>()
  let pending = [...scene.mobjects]

  for (;;) {
    const deferred: ManimMobject[] = []
    let progressed = false

    for (const spec of pending) {
      const dependencies = [spec.of, ...spec.members].filter(Boolean) as string[]
      if (dependencies.some((id) => !mobjects.has(id))) {
        deferred.push(spec)
        continue
      }

      const built = buildMobject(spec, mobjects)
      if (built) mobjects.set(spec.id, built)
      progressed = true
    }

    pending = deferred
    if (!progressed || !pending.length) break
  }

  // Anything no step ever touches would otherwise never appear. Drawing it from
  // the start is the right reading: it's the diagram the animated parts happen
  // on top of — axes, a baseline, a label.
  const animated = new Set(
    scene.steps.flatMap((step) => [...step.targets, step.to].filter(Boolean) as string[])
  )
  // A group's members are animated through the group, and drawing both would
  // double-draw them.
  for (const spec of scene.mobjects) {
    if (animated.has(spec.id)) for (const member of spec.members) animated.add(member)
  }

  const initial = scene.mobjects
    .filter((spec) => !animated.has(spec.id))
    .map((spec) => mobjects.get(spec.id))
    .filter((mobject): mobject is Mobject => Boolean(mobject))

  return { mobjects, initial }
}

function buildMobject(spec: ManimMobject, built: Map<string, Mobject>): Mobject | null {
  const style = styleOf(spec)
  const color = style.color
  let mobject: Mobject | null = null
  /** Line-likes and anything positioned by reference place themselves. */
  let positioned = false

  switch (spec.kind) {
    case 'circle':
      mobject = new Circle(spec.w / 2, style)
      break
    case 'ellipse':
      mobject = new Ellipse(spec.w, spec.h, style)
      break
    case 'dot':
      mobject = new Dot(at(spec), Math.max(0.04, spec.w / 2), style)
      positioned = true
      break
    case 'square':
      mobject = new Square(spec.w, style)
      break
    case 'rectangle':
      mobject = new Rectangle(spec.w, spec.h, style)
      break
    case 'triangle':
      mobject = new Triangle(style)
      mobject.scale(spec.w / 2)
      break
    case 'regularPolygon':
      mobject = new RegularPolygon(spec.sides, style)
      mobject.scale(spec.w / 2)
      break
    case 'polygon': {
      if (spec.points.length < 3) return null
      mobject = new Polygon(
        spec.points.map((p) => [p.x, p.y, 0] as Vec3),
        style
      )
      positioned = true
      break
    }
    case 'arc':
      // Half a turn by default: a full one is a circle, and the model reaches
      // for `arc` when it wants a curve between two things.
      mobject = new Arc(spec.w / 2, 0, spec.angle ? spec.angle * DEGREES : Math.PI, style)
      break
    case 'line': {
      const [start, end] = endpoints(spec)
      mobject = new Line(start, end, style)
      positioned = true
      break
    }
    case 'dashedLine': {
      const [start, end] = endpoints(spec)
      mobject = new DashedLine(start, end, 0.12, style)
      positioned = true
      break
    }
    case 'arrow': {
      const [start, end] = endpoints(spec)
      mobject = new Arrow(start, end, style)
      positioned = true
      break
    }
    case 'vector': {
      const [start, end] = endpoints(spec)
      // A vector is rooted where it is drawn from, so honour both points when
      // the model gave them and fall back to an origin-rooted arrow when not.
      mobject = spec.points.length >= 2
        ? new Arrow(start, end, style)
        : new Vector([spec.x, spec.y, 0], style)
      positioned = true
      break
    }
    case 'text':
      mobject = new Text(spec.text, { color, fontSize: spec.size })
      break
    case 'math':
      mobject = new MathTex(spec.text, { color, fontSize: spec.size })
      break
    case 'axes':
      mobject = new Axes({
        xRange: spec.xRange as [number, number, number],
        yRange: spec.yRange as [number, number, number],
        xLength: spec.w,
        yLength: spec.h,
        axisStyle: { color, strokeWidth: 2 },
      })
      break
    case 'numberPlane':
      mobject = new NumberPlane({
        xRange: spec.xRange as [number, number, number],
        yRange: spec.yRange as [number, number, number],
      })
      break
    case 'plot': {
      const axes = spec.of ? built.get(spec.of) : null
      const fn = compileExpression(spec.text)
      // A curve with no axes to sit on has no coordinate system to be drawn in,
      // and one whose expression didn't parse has nothing to draw.
      if (!(axes instanceof Axes) || !fn) return null
      mobject = axes.plot(fn, { color, strokeWidth: 4 })
      positioned = true
      break
    }
    case 'surround': {
      const target = spec.of ? built.get(spec.of) : null
      if (!target) return null
      mobject = new SurroundingRectangle(target, { color, strokeWidth: 3 }, 0.15)
      positioned = true
      break
    }
    case 'group': {
      const members = spec.members
        .map((id) => built.get(id))
        .filter((m): m is Mobject => Boolean(m))
      if (!members.length) return null
      mobject = new VGroup(...members)
      // Members were placed individually; moving the group would shift them
      // all a second time.
      positioned = true
      break
    }
  }

  if (!mobject) return null
  if (spec.angle && spec.kind !== 'arc') mobject.rotate(spec.angle * DEGREES)
  if (!positioned) mobject.moveTo(at(spec))
  return mobject
}

/** One `.animate`-style call, as the animation the builder would have made. */
function method(
  target: Mobject,
  name: string,
  args: unknown[],
  options: { runTime: number }
): Animation {
  return new MethodAnimation(target, [{ name, args }], options)
}

/**
 * Turns one step into the animations it stands for.
 *
 * Returns an empty array rather than throwing on anything it can't express:
 * one step the model got wrong should cost that step, not the scene.
 */
export function buildAnimations(step: ManimStep, built: Map<string, Mobject>): Animation[] {
  const targets = step.targets
    .map((id) => built.get(id))
    .filter((m): m is Mobject => Boolean(m))
  if (!targets.length) return []

  const options = { runTime: step.runTime }
  const animations: Animation[] = []

  for (const target of targets) {
    switch (step.action) {
      case 'create':
        // Text isn't built from beziers, so there is no outline to trace —
        // Write is what "draw this on" means for lettering.
        animations.push(
          target instanceof Text
            ? new Write(target, options)
            : target instanceof VMobject
              ? new Create(target, options)
              : new FadeIn(target, options)
        )
        break
      case 'write':
        animations.push(
          target instanceof Text || target instanceof VMobject
            ? new Write(target as VMobject, options)
            : new FadeIn(target, options)
        )
        break
      case 'uncreate':
        animations.push(
          target instanceof Text
            ? new Unwrite(target, options)
            : target instanceof VMobject
              ? new Uncreate(target, options)
              : new FadeOut(target, options)
        )
        break
      case 'fadeIn':
        animations.push(new FadeIn(target, options))
        break
      case 'fadeOut':
        animations.push(new FadeOut(target, options))
        break
      case 'grow':
        animations.push(new GrowFromCenter(target, options))
        break
      case 'shrink':
        animations.push(new ShrinkToCenter(target, options))
        break
      case 'spiralIn':
        animations.push(new SpiralIn(target, 8, 0.3, options))
        break
      case 'indicate':
        animations.push(new Indicate(target, options))
        break
      case 'flash':
        animations.push(new Flash(target.getCenter(), options))
        break
      case 'wiggle':
        animations.push(new Wiggle(target, options))
        break
      case 'circumscribe':
        animations.push(new Circumscribe(target, options))
        break
      case 'rotate':
        animations.push(new Rotate(target, step.angle * DEGREES, OUT, undefined, options))
        break
      // The three that move something already on screen. `.animate` builds a
      // Playable rather than an Animation, and Scene.play would take it — but
      // these are composed into groups here, so go straight to the animation
      // the builder would have produced.
      case 'shift':
        animations.push(method(target, 'shift', [[step.dx, step.dy, 0]], options))
        break
      case 'scale':
        animations.push(method(target, 'scale', [step.factor], options))
        break
      case 'moveTo':
        animations.push(method(target, 'moveTo', [[step.dx, step.dy, 0]], options))
        break
      case 'transform': {
        const destination = step.to ? built.get(step.to) : null
        if (destination) animations.push(new Transform(target, destination, options))
        break
      }
      case 'wait':
        break
    }
  }

  return animations
}
