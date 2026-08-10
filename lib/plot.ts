/**
 * Graphs, from the expression rather than from the model's arithmetic.
 *
 * The tempting shortcut is to ask for the points and plot those: no parser to
 * write, anything at all can be drawn. It is also how you get a parabola with
 * a kink in it, because a language model sampling x² at twenty-five points
 * will eventually get one of them wrong, and a wrong point on a curve is a
 * lie drawn confidently. So the model writes "x^2 - 2x - 3" and this file
 * evaluates it.
 *
 * A deliberately small language: arithmetic, powers, the usual functions, and
 * the constants. Anything it cannot parse produces no curve rather than a
 * wrong one.
 */

export interface PlotSpec {
  /** Expressions in x, drawn as curves. */
  functions: string[]
  xMin: number
  xMax: number
  /** Points worth naming — a root, a turning point, an intersection. */
  marks: { x: number; y: number; label: string }[]
  caption: string
}

/** What the renderer needs: everything already in the plot's own unit box. */
export interface PlotDrawing {
  /** Curves as polylines in [0,1] space, y already flipped for the screen. */
  curves: { points: { x: number; y: number }[] }[]
  marks: { x: number; y: number; label: string }[]
  /** Where the axes cross, in the same space. Null when off the plot. */
  originX: number | null
  originY: number | null
  ticks: { x: number; label: string }[]
  yTicks: { y: number; label: string }[]
  caption: string
}

const SAMPLES = 160

/**
 * Samples the functions and fits them into a unit box.
 *
 * Breaks the polyline wherever a value is not finite or jumps absurdly, so an
 * asymptote is a gap rather than a vertical line drawn through the whole plot.
 */
export function drawing(spec: PlotSpec): PlotDrawing | null {
  const xMin = Number(spec.xMin)
  const xMax = Number(spec.xMax)
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin) return null

  const compiled = spec.functions
    .slice(0, 3)
    .map((source) => parse(source))
    .filter((fn): fn is (x: number) => number => Boolean(fn))
  if (!compiled.length) return null

  // Sample first, then decide the vertical range from what came back — a plot
  // scaled to an asymptote shows a flat line and nothing else.
  const sampled = compiled.map((fn) => {
    const points: { x: number; y: number }[] = []
    for (let i = 0; i <= SAMPLES; i++) {
      const x = xMin + ((xMax - xMin) * i) / SAMPLES
      points.push({ x, y: fn(x) })
    }
    return points
  })

  const finite = sampled.flat().filter((point) => Number.isFinite(point.y))
  if (!finite.length) return null

  const ys = finite.map((point) => point.y).sort((a, b) => a - b)
  // Trimmed range: the middle 96% of the values, so one point near a pole does
  // not squash everything else into a line.
  const low = ys[Math.floor(ys.length * 0.02)]
  const high = ys[Math.ceil(ys.length * 0.98) - 1]
  const marks = spec.marks.filter((mark) => Number.isFinite(mark.x) && Number.isFinite(mark.y))

  let yMin = Math.min(low, ...marks.map((m) => m.y), 0)
  let yMax = Math.max(high, ...marks.map((m) => m.y), 0)
  if (yMax - yMin < 1e-9) {
    yMin -= 1
    yMax += 1
  }
  const pad = (yMax - yMin) * 0.08
  yMin -= pad
  yMax += pad

  const toUnitX = (x: number) => (x - xMin) / (xMax - xMin)
  const toUnitY = (y: number) => 1 - (y - yMin) / (yMax - yMin)

  const curves = sampled.map((points) => ({
    points: points.map((point) =>
      Number.isFinite(point.y) && point.y >= yMin - (yMax - yMin) && point.y <= yMax + (yMax - yMin)
        ? { x: toUnitX(point.x), y: toUnitY(point.y) }
        : { x: toUnitX(point.x), y: Number.NaN }
    ),
  }))

  return {
    curves,
    marks: marks.map((mark) => ({ x: toUnitX(mark.x), y: toUnitY(mark.y), label: mark.label })),
    originX: xMin <= 0 && xMax >= 0 ? toUnitX(0) : null,
    originY: yMin <= 0 && yMax >= 0 ? toUnitY(0) : null,
    ticks: axisTicks(xMin, xMax).map((value) => ({ x: toUnitX(value), label: label(value) })),
    yTicks: axisTicks(yMin, yMax).map((value) => ({ y: toUnitY(value), label: label(value) })),
    caption: spec.caption,
  }
}

/** Round numbers inside the range — 1, 2, 5 and their decades. */
function axisTicks(min: number, max: number) {
  const span = max - min
  const rough = span / 6
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const step = [1, 2, 5, 10].map((n) => n * magnitude).find((n) => n >= rough) ?? magnitude * 10

  const ticks: number[] = []
  for (let value = Math.ceil(min / step) * step; value <= max + 1e-9; value += step) {
    if (Math.abs(value) < step / 1000) ticks.push(0)
    else ticks.push(Number(value.toFixed(6)))
  }
  return ticks.slice(0, 12)
}

function label(value: number) {
  if (Math.abs(value) >= 1000 || (Math.abs(value) < 0.01 && value !== 0)) return value.toExponential(0)
  return String(Number(value.toFixed(2)))
}

/* ------------------------------------------------------------ the parser --- */

type Fn = (x: number) => number

const FUNCTIONS: Record<string, (value: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  floor: Math.floor,
  ceil: Math.ceil,
  sign: Math.sign,
}

/**
 * Recursive descent over the small grammar, returning a function of x.
 *
 * Returns null on anything it does not understand — including a name it has
 * never heard of. A plot that silently treats `gamma(x)` as zero is worse than
 * no plot.
 */
export function parse(source: string): Fn | null {
  const text = source
    .replace(/\\left|\\right|\\cdot|\\,/g, '')
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))')
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)')
    .replace(/\\(?=[a-z])/g, '')
    .replace(/\s+/g, '')
  if (!text) return null

  let at = 0
  const peek = () => text[at]
  const eat = (token: string) => {
    if (text.startsWith(token, at)) {
      at += token.length
      return true
    }
    return false
  }

  // expression := term (('+' | '-') term)*
  const expression = (): Fn | null => {
    let left: Fn | null = term()
    if (!left) return null

    for (;;) {
      if (eat('+')) {
        const right = term()
        if (!right) return null
        const a: Fn = left
        left = (x) => a(x) + right(x)
      } else if (eat('-')) {
        const right = term()
        if (!right) return null
        const a: Fn = left
        left = (x) => a(x) - right(x)
      } else return left
    }
  }

  // term := power (('*' | '/' | implicit) power)*
  const term = (): Fn | null => {
    let left: Fn | null = power()
    if (!left) return null

    for (;;) {
      if (eat('*')) {
        const right = power()
        if (!right) return null
        const a: Fn = left
        left = (x) => a(x) * right(x)
      } else if (eat('/')) {
        const right = power()
        if (!right) return null
        const a: Fn = left
        left = (x) => a(x) / right(x)
      } else if (peek() && /[\dx(a-z]/.test(peek()!)) {
        // Implicit multiplication: 2x, 3(x+1), x sin(x).
        const right = power()
        if (!right) return null
        const a: Fn = left
        left = (x) => a(x) * right(x)
      } else return left
    }
  }

  // power := unary ('^' power)?   — right associative, as it is written
  const power = (): Fn | null => {
    const base = unary()
    if (!base) return null
    if (!eat('^')) return base

    const exponent = power()
    if (!exponent) return null
    return (x) => Math.pow(base(x), exponent(x))
  }

  const unary = (): Fn | null => {
    if (eat('-')) {
      const inner = unary()
      return inner ? (x) => -inner(x) : null
    }
    if (eat('+')) return unary()
    return atom()
  }

  const atom = (): Fn | null => {
    if (eat('(')) {
      const inner = expression()
      if (!inner || !eat(')')) return null
      return inner
    }

    const number = /^\d+(\.\d+)?/.exec(text.slice(at))
    if (number) {
      at += number[0].length
      const value = Number(number[0])
      return () => value
    }

    const name = /^[a-zA-Z]+/.exec(text.slice(at))
    if (!name) return null
    at += name[0].length
    const word = name[0]

    if (word === 'x') return (x) => x
    if (word === 'pi') return () => Math.PI
    if (word === 'e') return () => Math.E

    const fn = FUNCTIONS[word.toLowerCase()]
    if (!fn) return null

    // A function name must be followed by its argument, bracketed or not.
    const argument = eat('(') ? bracketed() : power()
    if (!argument) return null
    return (x) => fn(argument(x))
  }

  const bracketed = (): Fn | null => {
    const inner = expression()
    if (!inner || !eat(')')) return null
    return inner
  }

  const compiled = expression()
  if (!compiled || at !== text.length) return null

  // One trial run: a function that throws on its first sample is not a plot.
  try {
    compiled(1)
  } catch {
    return null
  }
  return compiled
}
