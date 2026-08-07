/**
 * The symbol set, closed on purpose — with a way in for the words authors
 * actually reach for.
 *
 * Chalk's `sym` took any word and sent it to an icon service, which meant
 * "router" could come back as a map of a bus route and nobody would know until
 * they watched the lesson. A closed set is smaller and always right.
 *
 * What the closed set got wrong was the *penalty*. An unknown name used to fail
 * the build, so writing a Docker board and instinctively typing `sym whale`
 * stopped everything over a decoration. Now a name resolves through the aliases
 * below, and a name that still misses draws the generic glyph and warns. The
 * board is never held hostage by an icon.
 *
 * Drawn as stroked paths on a 48x48 grid, so they read as one hand at any size.
 */
export const SYMBOLS: Record<string, string> = {
  compass:
    '<circle cx="24" cy="24" r="17"/><path d="M31 17 L21 21 L17 31 L27 27 Z"/><path d="M24 4v3M24 41v3M4 24h3M41 24h3"/>',
  'card index':
    '<rect x="6" y="14" width="36" height="26" rx="2"/><path d="M6 20h36M6 26h36M6 32h36"/><path d="M18 14V9h12v5"/>',
  router:
    '<rect x="6" y="26" width="36" height="14" rx="2"/><path d="M12 33h4M20 33h4M28 33h8"/><path d="M24 26V14M24 14l-7-6M24 14l7-6"/>',
  server:
    '<rect x="10" y="7" width="28" height="12" rx="2"/><rect x="10" y="21" width="28" height="12" rx="2"/><rect x="10" y="35" width="28" height="8" rx="2"/><path d="M15 13h2M15 27h2M15 39h2"/>',
  database:
    '<ellipse cx="24" cy="12" rx="14" ry="5"/><path d="M10 12v24c0 2.8 6.3 5 14 5s14-2.2 14-5V12"/><path d="M10 24c0 2.8 6.3 5 14 5s14-2.2 14-5"/>',
  globe:
    '<circle cx="24" cy="24" r="17"/><path d="M24 7c-6 6-6 28 0 34M24 7c6 6 6 28 0 34M7 24h34M10 15h28M10 33h28"/>',
  clock: '<circle cx="24" cy="24" r="17"/><path d="M24 13v11l7 5"/>',
  stopwatch: '<circle cx="24" cy="27" r="15"/><path d="M24 18v9l6 4M19 6h10M24 6v6M37 14l3-3"/>',
  hourglass:
    '<path d="M14 6h20M14 42h20M16 6c0 10 8 12 8 18 0 6-8 8-8 18M32 6c0 10-8 12-8 18 0 6 8 8 8 18"/>',
  padlock:
    '<rect x="11" y="21" width="26" height="19" rx="3"/><path d="M17 21v-6a7 7 0 0 1 14 0v6"/><circle cx="24" cy="30" r="2.2"/>',
  'open padlock':
    '<rect x="11" y="21" width="26" height="19" rx="3"/><path d="M17 21v-6a7 7 0 0 1 14 0"/><circle cx="24" cy="30" r="2.2"/>',
  shield: '<path d="M24 6l14 5v12c0 10-6 15-14 19-8-4-14-9-14-19V11z"/><path d="M18 24l4 4 8-9"/>',
  envelope: '<rect x="6" y="12" width="36" height="24" rx="2"/><path d="M6 15l18 13 18-13"/>',
  layers: '<path d="M24 8L6 17l18 9 18-9z"/><path d="M6 26l18 9 18-9M6 34l18 9 18-9"/>',
  tree:
    '<path d="M24 42V26"/><path d="M24 26l-9-8M24 26l9-8"/><circle cx="24" cy="12" r="6"/><circle cx="12" cy="20" r="5"/><circle cx="36" cy="20" r="5"/>',
  signpost: '<path d="M24 42V10"/><path d="M12 14h20l5 5-5 5H12z"/><path d="M36 28H16l-5-5 5-5"/>',
  gear:
    '<circle cx="24" cy="24" r="7"/><path d="M24 5v6M24 37v6M5 24h6M37 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"/>',
  'memory chip':
    '<rect x="14" y="14" width="20" height="20" rx="2"/><path d="M20 14V8M28 14V8M20 40v-6M28 40v-6M14 20H8M14 28H8M40 20h-6M40 28h-6"/>',
  processor:
    '<rect x="13" y="13" width="22" height="22" rx="2"/><rect x="20" y="20" width="8" height="8"/><path d="M19 13V7M29 13V7M19 41v-6M29 41v-6M13 19H7M13 29H7M41 19h-6M41 29h-6"/>',
  person: '<circle cx="24" cy="15" r="7"/><path d="M11 42c0-8 6-13 13-13s13 5 13 13"/>',
  people:
    '<circle cx="18" cy="16" r="6"/><path d="M7 40c0-7 5-11 11-11s11 4 11 11"/><circle cx="33" cy="18" r="5"/><path d="M31 29c5 0 10 4 10 11"/>',
  scales:
    '<path d="M24 8v32M12 40h24M8 18h32M8 18l-5 10a6 6 0 0 0 10 0zM40 18l5 10a6 6 0 0 1-10 0z"/>',
  warehouse: '<path d="M6 40V20l18-8 18 8v20z"/><path d="M16 40V28h16v12"/>',
  document: '<path d="M12 6h16l8 8v28H12z"/><path d="M28 6v8h8"/><path d="M18 24h12M18 30h12M18 36h8"/>',
  disk: '<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="4"/><path d="M24 7v6M24 35v6"/>',
  cache:
    '<rect x="7" y="14" width="34" height="20" rx="2"/><path d="M14 20h8M14 26h14"/><path d="M33 20l4 4-4 4"/>',
  queue:
    '<rect x="5" y="18" width="10" height="12"/><rect x="19" y="18" width="10" height="12"/><rect x="33" y="18" width="10" height="12"/>',
  file: '<path d="M13 6h14l8 8v28H13z"/><path d="M27 6v8h8"/>',
  folder: '<path d="M6 38V12h13l4 5h19v21z"/>',
  key: '<circle cx="15" cy="24" r="8"/><path d="M23 24h19M36 24v7M42 24v5"/>',
  'browser window':
    '<rect x="6" y="10" width="36" height="28" rx="2"/><path d="M6 18h36"/><circle cx="12" cy="14" r="1.5"/><circle cx="18" cy="14" r="1.5"/>',
  terminal: '<rect x="6" y="10" width="36" height="28" rx="2"/><path d="M13 20l6 5-6 5M24 30h10"/>',
  network:
    '<circle cx="24" cy="10" r="5"/><circle cx="10" cy="38" r="5"/><circle cx="38" cy="38" r="5"/><path d="M24 15v10M24 25l-12 9M24 25l12 9"/>',
  cable: '<path d="M8 12v14a10 10 0 0 0 10 10h12a10 10 0 0 1 10 10v2"/><rect x="4" y="6" width="8" height="7"/>',
  battery:
    '<rect x="7" y="16" width="30" height="16" rx="2"/><path d="M37 21h4v6h-4"/><path d="M13 21v6M19 21v6"/>',
  turbine:
    '<circle cx="24" cy="24" r="4"/><path d="M24 20c0-8 3-13 3-13s-9 2-9 8M28 24c8 0 13 3 13 3s-2-9-8-9M20 24c-8 0-13-3-13-3s2 9 8 9M24 28c0 8-3 13-3 13s9-2 9-8"/>',
  neuron:
    '<circle cx="20" cy="24" r="7"/><path d="M27 24h14M41 24l-4-3M41 24l-4 3M15 18l-7-5M15 30l-7 5M20 17V8M20 31v9"/>',
  heart: '<path d="M24 40S8 30 8 19a8 8 0 0 1 16-3 8 8 0 0 1 16 3c0 11-16 21-16 21z"/>',
  leaf: '<path d="M10 38C10 20 24 8 40 8c0 16-12 30-30 30z"/><path d="M10 38c8-8 14-14 22-18"/>',
  container:
    '<rect x="6" y="14" width="36" height="24" rx="2"/><path d="M6 22h36M17 14v24M28 14v24"/>',
  cloud: '<path d="M15 37a9 9 0 0 1 1-18 12 12 0 0 1 22-2 8 8 0 0 1 0 20z"/>',
  switch:
    '<rect x="5" y="20" width="38" height="13" rx="2"/><path d="M11 27h6M21 27h6M31 27h7"/><path d="M15 20v-9h19"/><path d="M30 7l5 4-5 4"/>',
  calendar:
    '<rect x="7" y="11" width="34" height="30" rx="2"/><path d="M7 20h34M16 7v8M32 7v8M16 27h5M27 27h5M16 34h5"/>',
  dna: '<path d="M17 5c0 13 14 13 14 26s-14 12-14 12"/><path d="M31 5c0 13-14 13-14 26s14 12 14 12"/><path d="M19 13h10M16 21h16M16 31h16M19 39h10"/>',
  wrench:
    '<path d="M33 6a10 10 0 0 0-9 14L9 35a4 4 0 0 0 5 6l15-15a10 10 0 0 0 13-12l-7 7-6-2-2-6z"/>',
  pipe: '<path d="M8 18h14a8 8 0 0 1 8 8v14"/><rect x="3" y="13" width="6" height="10"/><rect x="25" y="39" width="10" height="6"/>',
  valve:
    '<circle cx="24" cy="24" r="7"/><path d="M5 24h12M31 24h12M24 5v12M24 31v12"/><path d="M17 5h14M17 43h14"/>',
  phone: '<rect x="14" y="4" width="20" height="40" rx="3"/><path d="M21 9h6M20 38h8"/>',
  antenna:
    '<path d="M24 20v23"/><circle cx="24" cy="16" r="4"/><path d="M14 26a14 14 0 0 1 0-20M34 26a14 14 0 0 0 0-20M18 22a8 8 0 0 1 0-12M30 22a8 8 0 0 0 0-12"/>',
  map: '<path d="M6 12l12-5 12 5 12-5v29l-12 5-12-5-12 5z"/><path d="M18 7v29M30 12v29"/>',
  receipt:
    '<path d="M11 5h26v38l-5-4-4 4-4-4-4 4-4-4-5 4z"/><path d="M17 15h14M17 22h14M17 29h9"/>',
  // A verdict. Boards argue, and the cheapest honest way to say "and this is
  // the bad one" is a face — no colour, no exclamation mark, no adjective the
  // narration has to repeat.
  'sad face':
    '<circle cx="24" cy="24" r="19"/><path d="M14 17l6 5M20 17l-6 5M28 17l6 5M34 17l-6 5"/><path d="M16 35a9 9 0 0 1 16 0"/>',
  'happy face':
    '<circle cx="24" cy="24" r="19"/><circle cx="17" cy="20" r="1.8"/><circle cx="31" cy="20" r="1.8"/><path d="M15 29a10 10 0 0 0 18 0"/>',
  'neutral face':
    '<circle cx="24" cy="24" r="19"/><circle cx="17" cy="20" r="1.8"/><circle cx="31" cy="20" r="1.8"/><path d="M16 32h16"/>',
}

export const SYMBOL_NAMES = Object.keys(SYMBOLS).sort()

/**
 * The words authors reach for, pointed at the glyph that already means them.
 *
 * Not a second symbol set — every value here is a name in `SYMBOLS`. This is
 * how the vocabulary stays closed while the *writing* stays natural: `sym cpu`
 * and `sym processor` are the same picture, and neither one is a build failure.
 * A lesson can add its own with `symbol docker = container`.
 */
export const SYMBOL_ALIASES: Record<string, string> = {
  cpu: 'processor',
  core: 'processor',
  kernel: 'processor',
  chip: 'memory chip',
  ram: 'memory chip',
  memory: 'memory chip',
  db: 'database',
  store: 'database',
  storage: 'disk',
  drive: 'disk',
  bucket: 'warehouse',
  net: 'network',
  internet: 'globe',
  world: 'globe',
  earth: 'globe',
  web: 'globe',
  window: 'browser window',
  browser: 'browser window',
  shell: 'terminal',
  console: 'terminal',
  vm: 'server',
  host: 'server',
  machine: 'server',
  image: 'layers',
  stack: 'layers',
  docker: 'container',
  package: 'container',
  pod: 'container',
  lock: 'padlock',
  unlock: 'open padlock',
  secret: 'key',
  security: 'shield',
  mail: 'envelope',
  email: 'envelope',
  message: 'envelope',
  doc: 'document',
  paper: 'document',
  page: 'document',
  user: 'person',
  users: 'people',
  team: 'people',
  time: 'clock',
  timer: 'stopwatch',
  latency: 'stopwatch',
  cog: 'gear',
  settings: 'gear',
  config: 'gear',
  build: 'wrench',
  tool: 'wrench',
  balance: 'scales',
  tradeoff: 'scales',
  brain: 'neuron',
  plant: 'leaf',
  route: 'signpost',
  direction: 'signpost',
  sad: 'sad face',
  unhappy: 'sad face',
  bad: 'sad face',
  worse: 'sad face',
  happy: 'happy face',
  good: 'happy face',
  better: 'happy face',
  neutral: 'neutral face',
  ok: 'neutral face',
}

/**
 * A symbol name, resolved through the aliases and a lesson's own `symbol`
 * declarations.
 *
 * Returns what to draw either way, so the renderer never has to decide what a
 * miss looks like — and reports whether it was a miss, so the linter can say so
 * once instead of the board saying nothing.
 */
export function resolveSymbol(
  name: string,
  extra: Record<string, string> = {}
): { art: string; resolved: string | null } {
  const wanted = name.trim().toLowerCase()
  // A lesson's own aliases lead: `symbol docker = server` should win over the
  // built-in `docker`, because the author is the one who knows their subject.
  const target = extra[wanted] ?? SYMBOL_ALIASES[wanted] ?? wanted
  const art = SYMBOLS[target]
  return art ? { art, resolved: target } : { art: MISSING_SYMBOL, resolved: null }
}

/** The nearest names to a miss, so a typo is one line from fixed. */
export function nearestSymbols(word: string, limit = 3): string[] {
  const wanted = word.trim().toLowerCase()
  const head = wanted.split(' ')[0]
  const pool = [...Object.keys(SYMBOLS), ...Object.keys(SYMBOL_ALIASES)]
  return pool
    .filter((name) => name.includes(head) || wanted.includes(name.split(' ')[0]))
    .slice(0, limit)
}

/** Drawn when a name is unknown, so the board says "missing" rather than lying. */
export const MISSING_SYMBOL =
  '<circle cx="24" cy="24" r="17" stroke-dasharray="4 4"/><path d="M18 24h12"/>'
