/**
 * Colouring for code, one line at a time.
 *
 * Not a parser. A parser would be right and would also mean carrying a grammar
 * per language and a lexer that survives a half-typed line — and this runs on
 * every keystroke of an editor whose whole point is that it is a textarea and
 * not Monaco. What colour actually buys a learner is the shape of the line:
 * this is a string, that is a comment, that word is the language and not your
 * variable. A regex sweep gets that, and gets it on a line that will not parse
 * because it is still being written.
 *
 * Line at a time, deliberately: the editor renders one `<div>` per line to keep
 * the caret over the text, so a tokenizer holding state across lines would be
 * describing a document the DOM does not have. The cost is a multi-line
 * `/* … *\/` comment coloured only on the lines where its delimiters appear —
 * a small, visible wrongness rather than a caret that drifts.
 *
 * The kinds are the class names in course.css: key, str, num, com, cmd.
 */

export interface Token {
  text: string
  /** Undefined for ordinary text, which is painted by the surrounding colour. */
  kind?: 'key' | 'str' | 'num' | 'com' | 'cmd'
}

/**
 * The words the language owns.
 *
 * JavaScript first, since that is what the courses teach, with the handful of
 * shell and Dockerfile words that show up on a board next to it. Wrong-language
 * keywords colouring is not a failure worth a language switch: `import` reads
 * as a keyword in every language that has it.
 */
const KEYWORDS = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'of', 'return',
  'static', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void',
  'while', 'with', 'yield', 'async', 'from', 'as',
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
])

/** Shell and Dockerfile verbs, which read as instructions rather than words. */
const COMMANDS = new Set([
  'FROM', 'RUN', 'CMD', 'COPY', 'ADD', 'ENV', 'EXPOSE', 'WORKDIR', 'ENTRYPOINT',
  'VOLUME', 'USER', 'ARG', 'LABEL', 'HEALTHCHECK',
  'npm', 'npx', 'node', 'yarn', 'pnpm', 'git', 'docker', 'curl', 'cd', 'sudo',
  'apt', 'python', 'python3', 'pip',
])

/**
 * One pass, longest-match-first.
 *
 * Order is the whole design: a `//` inside a string is not a comment, and a
 * digit inside a name is not a number, so comments and strings are claimed
 * before words and words before digits.
 */
const PATTERNS: { kind: Token['kind']; re: RegExp }[] = [
  // Comments to end of line, and the delimiters of a block comment.
  { kind: 'com', re: /^(?:\/\/|#(?!!)).*/ },
  { kind: 'com', re: /^\/\*[\s\S]*?(?:\*\/|$)/ },
  { kind: 'com', re: /^\*\// },
  // Strings, including the unterminated one you are halfway through typing.
  { kind: 'str', re: /^"(?:[^"\\]|\\.)*(?:"|$)/ },
  { kind: 'str', re: /^'(?:[^'\\]|\\.)*(?:'|$)/ },
  { kind: 'str', re: /^`(?:[^`\\]|\\.)*(?:`|$)/ },
  // Words: whether they are keywords is decided after the match.
  { kind: undefined, re: /^[A-Za-z_$][\w$]*/ },
  // Numbers, including hex and decimals.
  { kind: 'num', re: /^0[xX][\da-fA-F]+|^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/ },
]

/** Splits one line into coloured runs. Never throws, never drops a character. */
export function highlight(line: string): Token[] {
  const tokens: Token[] = []
  let plain = ''
  let at = 0

  const flush = () => {
    if (plain) tokens.push({ text: plain })
    plain = ''
  }

  while (at < line.length) {
    const rest = line.slice(at)
    let matched = false

    for (const { kind, re } of PATTERNS) {
      const found = re.exec(rest)
      if (!found || !found[0]) continue

      const text = found[0]
      // A word is only special if the language owns it.
      const settled =
        kind === undefined
          ? KEYWORDS.has(text)
            ? 'key'
            : COMMANDS.has(text)
              ? 'cmd'
              : undefined
          : kind

      if (settled) {
        flush()
        tokens.push({ text, kind: settled })
      } else {
        plain += text
      }

      at += text.length
      matched = true
      break
    }

    // Punctuation, whitespace, anything unclaimed: it still has to be emitted,
    // or the editor's text and its colouring drift apart by a character.
    if (!matched) {
      plain += line[at]
      at++
    }
  }

  flush()
  return tokens
}
