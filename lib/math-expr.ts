/**
 * A tiny math expression evaluator, for plotting the curves a lesson asks for.
 *
 * The model writes `sin(x)`, `x^2 - 3*x` or `exp(-x*x)` and the board has to
 * turn that into a function. `eval` and `new Function` would both do it in one
 * line, and both would execute whatever the model wrote — a prompt-injected
 * topic could ship code into the learner's browser. So the string is parsed
 * into a tree of known operations and nothing else can be expressed.
 *
 * Recursive descent, standard precedence, `^` binding tighter than `*` and
 * associating right so `2^3^2` is 512.
 */

type Node =
  | { kind: 'num'; value: number }
  | { kind: 'var' }
  | { kind: 'unary'; sign: -1 | 1; arg: Node }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '%' | '^'; left: Node; right: Node }
  | { kind: 'call'; fn: (args: number[]) => number; args: Node[] }

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  tau: Math.PI * 2,
  e: Math.E,
}

const FUNCTIONS: Record<string, (args: number[]) => number> = {
  sin: ([x]) => Math.sin(x),
  cos: ([x]) => Math.cos(x),
  tan: ([x]) => Math.tan(x),
  asin: ([x]) => Math.asin(x),
  acos: ([x]) => Math.acos(x),
  atan: ([x]) => Math.atan(x),
  sinh: ([x]) => Math.sinh(x),
  cosh: ([x]) => Math.cosh(x),
  tanh: ([x]) => Math.tanh(x),
  exp: ([x]) => Math.exp(x),
  ln: ([x]) => Math.log(x),
  log: ([x, base]) => (base === undefined ? Math.log(x) : Math.log(x) / Math.log(base)),
  log10: ([x]) => Math.log10(x),
  log2: ([x]) => Math.log2(x),
  sqrt: ([x]) => Math.sqrt(x),
  cbrt: ([x]) => Math.cbrt(x),
  abs: ([x]) => Math.abs(x),
  floor: ([x]) => Math.floor(x),
  ceil: ([x]) => Math.ceil(x),
  round: ([x]) => Math.round(x),
  sign: ([x]) => Math.sign(x),
  min: (args) => Math.min(...args),
  max: (args) => Math.max(...args),
  pow: ([a, b]) => a ** b,
  atan2: ([a, b]) => Math.atan2(a, b),
  hypot: (args) => Math.hypot(...args),
}

class Parser {
  private at = 0

  constructor(private readonly src: string) {}

  parse(): Node {
    const node = this.expression()
    this.skipSpace()
    if (this.at < this.src.length) {
      throw new Error(`Unexpected "${this.src[this.at]}" at ${this.at}`)
    }
    return node
  }

  private skipSpace() {
    while (this.at < this.src.length && /\s/.test(this.src[this.at])) this.at++
  }

  private eat(token: string) {
    this.skipSpace()
    if (this.src.startsWith(token, this.at)) {
      this.at += token.length
      return true
    }
    return false
  }

  private expression(): Node {
    let left = this.term()
    for (;;) {
      if (this.eat('+')) left = { kind: 'binary', op: '+', left, right: this.term() }
      else if (this.eat('-')) left = { kind: 'binary', op: '-', left, right: this.term() }
      else return left
    }
  }

  private term(): Node {
    let left = this.unary()
    for (;;) {
      if (this.eat('*')) left = { kind: 'binary', op: '*', left, right: this.unary() }
      else if (this.eat('/')) left = { kind: 'binary', op: '/', left, right: this.unary() }
      else if (this.eat('%')) left = { kind: 'binary', op: '%', left, right: this.unary() }
      else return left
    }
  }

  /**
   * Sits *above* power, not below: written maths reads -x^2 as -(x^2), so a
   * leading minus has to take the whole power as its argument.
   */
  private unary(): Node {
    if (this.eat('-')) return { kind: 'unary', sign: -1, arg: this.unary() }
    if (this.eat('+')) return this.unary()
    return this.power()
  }

  private power(): Node {
    const base = this.primary()
    // Right-associative, so 2^3^2 is 512. The exponent goes through unary
    // rather than power so a signed one — 2^-x — still parses.
    if (this.eat('**') || this.eat('^')) {
      return { kind: 'binary', op: '^', left: base, right: this.unary() }
    }
    return base
  }

  private primary(): Node {
    this.skipSpace()

    if (this.eat('(')) {
      const inner = this.expression()
      if (!this.eat(')')) throw new Error('Unclosed (')
      return inner
    }

    const number = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(this.src.slice(this.at))
    if (number) {
      this.at += number[0].length
      return { kind: 'num', value: Number.parseFloat(number[0]) }
    }

    const name = /^[a-zA-Z_][a-zA-Z_0-9]*/.exec(this.src.slice(this.at))
    if (!name) throw new Error(`Expected a value at ${this.at}`)
    this.at += name[0].length
    const identifier = name[0].toLowerCase()

    if (this.eat('(')) {
      const fn = FUNCTIONS[identifier]
      if (!fn) throw new Error(`Unknown function "${identifier}"`)
      const args: Node[] = []
      if (!this.eat(')')) {
        do args.push(this.expression())
        while (this.eat(','))
        if (!this.eat(')')) throw new Error(`Unclosed ( in ${identifier}`)
      }
      return { kind: 'call', fn, args }
    }

    if (identifier === 'x' || identifier === 't') return { kind: 'var' }
    if (identifier in CONSTANTS) return { kind: 'num', value: CONSTANTS[identifier] }
    throw new Error(`Unknown name "${identifier}"`)
  }
}

function evaluate(node: Node, x: number): number {
  switch (node.kind) {
    case 'num':
      return node.value
    case 'var':
      return x
    case 'unary':
      return node.sign * evaluate(node.arg, x)
    case 'call':
      return node.fn(node.args.map((arg) => evaluate(arg, x)))
    case 'binary': {
      const a = evaluate(node.left, x)
      const b = evaluate(node.right, x)
      switch (node.op) {
        case '+':
          return a + b
        case '-':
          return a - b
        case '*':
          return a * b
        case '/':
          return a / b
        case '%':
          return a % b
        case '^':
          return a ** b
      }
    }
  }
}

/**
 * Parses an expression, or returns null if it doesn't. Null rather than
 * throwing: a curve the model wrote badly should cost that one curve, not the
 * scene it appears in.
 */
function parseExpression(source: string): Node | null {
  const trimmed = source?.trim()
  if (!trimmed || trimmed.length > 400) return null

  // "y = sin(x)" and "f(x) = sin(x)" are both natural things to write.
  const body = trimmed.replace(/^\s*(y|f\s*\(\s*[xt]\s*\))\s*=\s*/i, '')

  try {
    return new Parser(body).parse()
  } catch (error) {
    console.warn('[math-expr]', source, error instanceof Error ? error.message : error)
    return null
  }
}

/** Python source for each function, for the server-side Manim renderer. */
const PYTHON_FUNCTIONS: Record<string, string> = {
  sin: 'math.sin',
  cos: 'math.cos',
  tan: 'math.tan',
  asin: 'math.asin',
  acos: 'math.acos',
  atan: 'math.atan',
  sinh: 'math.sinh',
  cosh: 'math.cosh',
  tanh: 'math.tanh',
  exp: 'math.exp',
  ln: 'math.log',
  log: 'math.log',
  log10: 'math.log10',
  log2: 'math.log2',
  sqrt: 'math.sqrt',
  cbrt: 'math.cbrt',
  abs: 'abs',
  floor: 'math.floor',
  ceil: 'math.ceil',
  round: 'round',
  sign: 'math.copysign',
  min: 'min',
  max: 'max',
  pow: 'pow',
  atan2: 'math.atan2',
  hypot: 'math.hypot',
}

/** Reverse lookup, so a parsed call knows which Python name it maps to. */
const PYTHON_BY_FN = new Map(
  Object.entries(FUNCTIONS).map(([name, fn]) => [fn, PYTHON_FUNCTIONS[name] ?? 'abs'])
)

function toPython(node: Node): string {
  switch (node.kind) {
    case 'num':
      return Number.isFinite(node.value) ? `(${node.value})` : '(0)'
    case 'var':
      return 'x'
    case 'unary':
      return `(${node.sign === -1 ? '-' : '+'}${toPython(node.arg)})`
    case 'call': {
      const name = PYTHON_BY_FN.get(node.fn) ?? 'abs'
      // sign(x) has no direct Python builtin; copysign(1, x) is the same thing
      // except at zero, which is close enough for a curve.
      if (name === 'math.copysign') return `math.copysign(1, ${toPython(node.args[0])})`
      return `${name}(${node.args.map(toPython).join(', ')})`
    }
    case 'binary': {
      const a = toPython(node.left)
      const b = toPython(node.right)
      return `(${a} ${node.op === '^' ? '**' : node.op} ${b})`
    }
  }
}

/**
 * Renders an expression as a Python lambda body, or null if it doesn't parse.
 *
 * Built from the parsed tree rather than by passing the model's string
 * through — the string is about to be written into a file that the server
 * executes, so nothing the model wrote may reach it verbatim.
 */
export function compileToPython(source: string): string | null {
  const tree = parseExpression(source)
  return tree ? toPython(tree) : null
}

/** Compiles an expression into a function of x, for the browser renderer. */
export function compileExpression(source: string): ((x: number) => number) | null {
  const tree = parseExpression(source)
  if (!tree) return null

  return (x: number) => {
    const value = evaluate(tree, x)
    // Poles and domain errors are normal in a lesson (tan, 1/x, log of a
    // negative). Report them as NaN so the plotter can break the line.
    return Number.isFinite(value) ? value : Number.NaN
  }
}
