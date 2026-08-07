/**
 * Colouring the `code` block.
 *
 * Deliberately one small tokenizer rather than a highlighter library. A board
 * shows four or five lines of a Dockerfile, a shell command or a function — not
 * a file — and the job is to make the shape of those lines readable at a
 * glance, not to be correct about every dialect. Shipping a megabyte of grammar
 * definitions to put three words in violet is the wrong trade, and a language
 * this small can be got right by hand.
 *
 * What it colours is what carries meaning at that size: the thing being run,
 * the strings, the numbers, and the parts the reader is meant to skip.
 */

export type TokenKind = 'com' | 'str' | 'num' | 'key' | 'cmd' | null

export interface Token {
  text: string
  kind: TokenKind
}

/**
 * Words that mean "this line does something", across the languages a teaching
 * board actually shows. Matched case-insensitively so `FROM` and `from` both
 * land — Dockerfile shouts and Python does not.
 */
const KEYWORDS = new Set([
  // Dockerfile
  'from', 'run', 'copy', 'add', 'cmd', 'entrypoint', 'expose', 'workdir', 'env',
  'volume', 'arg', 'label', 'user', 'healthcheck', 'onbuild', 'shell', 'stopsignal',
  // the C-ish family
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'break', 'continue', 'new', 'class', 'extends', 'this', 'typeof',
  'import', 'export', 'default', 'async', 'await', 'yield', 'try', 'catch', 'finally',
  'throw', 'interface', 'type', 'enum', 'public', 'private', 'static', 'void',
  // python and friends
  'def', 'lambda', 'elif', 'pass', 'with', 'as', 'in', 'is', 'not', 'and', 'or',
  'raise', 'except', 'global', 'nonlocal', 'assert', 'del', 'print',
  // sql, and the literals everyone shares
  'select', 'insert', 'update', 'delete', 'where', 'join', 'true', 'false', 'null',
  'none', 'nil', 'undefined', 'self',
])

/** Programs a shell line is likely to start with. */
const COMMANDS = new Set([
  'docker', 'kubectl', 'npm', 'npx', 'yarn', 'pnpm', 'git', 'cd', 'ls', 'cat', 'echo',
  'curl', 'wget', 'make', 'python', 'python3', 'pip', 'node', 'go', 'cargo', 'brew',
  'apt', 'apt-get', 'sudo', 'chmod', 'mkdir', 'rm', 'cp', 'mv', 'ssh', 'scp', 'tar',
])

/**
 * Order matters: a `#` inside a string is not a comment, and a keyword inside
 * one is not a keyword. Strings and comments are therefore matched before
 * anything is allowed to look at a word.
 */
const TOKEN =
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\/[^\n]*|#[^\n]*)|(\b\d[\w.]*\b)|([A-Za-z_][\w-]*)/g

/** One line of source, split into what to colour and what to leave alone. */
export function highlight(line: string): Token[] {
  const out: Token[] = []
  let at = 0
  let first = true

  const plain = (text: string) => {
    if (text) out.push({ text, kind: null })
  }

  for (const match of line.matchAll(TOKEN)) {
    const [text, str, com, num, word] = match
    plain(line.slice(at, match.index))
    at = match.index + text.length

    if (str) out.push({ text, kind: 'str' })
    else if (com) out.push({ text, kind: 'com' })
    else if (num) out.push({ text, kind: 'num' })
    else {
      const lower = word.toLowerCase()
      // The first word of a line is the thing being run — a Dockerfile
      // directive or a program — and reads as the line's verb either way.
      if (KEYWORDS.has(lower)) out.push({ text, kind: 'key' })
      else if (first && COMMANDS.has(lower)) out.push({ text, kind: 'cmd' })
      else plain(text)
    }
    if (/\S/.test(text)) first = false
  }

  plain(line.slice(at))
  return out
}
