/**
 * The symbol set, closed on purpose.
 *
 * Chalk's `sym` took any word and sent it to an icon service, which meant
 * "router" could come back as a map of a bus route and nobody would know until
 * they watched the lesson. A closed set is smaller and always right: a name is
 * either in here, or the build fails and says which names are close.
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
}

export const SYMBOL_NAMES = Object.keys(SYMBOLS).sort()

/** Drawn when a name is unknown, so the board says "missing" rather than lying. */
export const MISSING_SYMBOL =
  '<circle cx="24" cy="24" r="17" stroke-dasharray="4 4"/><path d="M18 24h12"/>'
