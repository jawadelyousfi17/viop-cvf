import { db } from './db'
import { owned, type Identity } from './owner'
import { isDemo, visible } from './demo'
import { DEFAULT_PROVIDER } from './providers'
import { completeStructured, streamStructured } from './llm'
import {
  EXPAND_JSON_SCHEMA,
  MINDMAP_JSON_SCHEMA,
  childrenFromModel,
  mindmapFromModel,
  parseOutline,
  type MindMap,
} from './mindmap'
import { MATH_JSON_SCHEMA, solutionFromModel } from './math'
import {
  MINDMAP_EXPAND_SYSTEM_PROMPT,
  MINDMAP_SYSTEM_PROMPT,
  MATH_SYSTEM_PROMPT,
  expandPrompt,
  mathPrompt,
  mindmapPrompt,
} from './prompt'

/**
 * Work that finishes whether or not anyone is watching.
 *
 * Every generation here used to live and die with the request that asked for
 * it: close the tab a second before the map came back and the model call was
 * paid for, completed, and thrown away. Now the request writes a row, hands
 * back an id, and the work runs after the response — so leaving the page or
 * reloading it costs you the *view*, never the job.
 *
 * Which makes the client's side of it simple: ask for a job, poll it, and on
 * arrival ask what is still running. A reload picks up exactly where it was.
 */

export type JobKind = 'map' | 'expand' | 'math' | 'lesson'
export type JobStatus = 'running' | 'done' | 'failed'

export interface JobView {
  id: string
  kind: JobKind
  status: JobStatus
  input: unknown
  result: unknown
  error: string | null
  updatedAt: string
}

/** How long a job may run before it is assumed dead. */
const STALE_AFTER = 5 * 60 * 1000

export async function startJob(identity: Identity, kind: JobKind, input: unknown) {
  return db.job.create({
    data: {
      ownerKey: identity.ownerKey,
      userId: identity.userId,
      kind,
      input: JSON.stringify(input ?? {}),
      status: 'running',
    },
    select: { id: true },
  })
}

/** One job, if it belongs to the caller — or to the demo account. */
export async function readJob(identity: Identity, id: string): Promise<JobView | null> {
  const row = await db.job.findFirst({ where: { id, ...visible(identity) } })
  if (!row) return null
  return view(row)
}


/**
 * Everything still running, plus anything that finished while nobody was
 * looking — which is the whole point on a fresh page load.
 */
export async function openJobs(identity: Identity): Promise<JobView[]> {
  const now = Date.now()

  const rows = await db.job.findMany({
    where: {
      ...owned(identity),
      OR: [
        // Still going. Worth an hour, because that is how long one may run
        // before it is assumed dead.
        { status: 'running', updatedAt: { gt: new Date(now - 60 * 60 * 1000) } },
        /**
         * Just finished — the window between leaving a page and coming back
         * to find the work done.
         *
         * It used to be an hour for these too, and that is a bug rather than
         * generosity: the page has no memory of which jobs it has already
         * seen across a reload, so every finished job in the window was
         * handed to it again as if it had just landed. A map that finished
         * forty minutes ago would arrive on load, open itself, and switch the
         * workspace to the mindmap tab — which is exactly what it does when a
         * map genuinely finishes.
         *
         * Two minutes still covers a reload mid-generation and does not
         * re-deliver anything from earlier in the session.
         */
        { status: { not: 'running' }, updatedAt: { gt: new Date(now - 2 * 60 * 1000) } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  })
  return rows.map(view)
}

function view(row: {
  id: string
  kind: string
  status: string
  input: string
  result: string | null
  error: string | null
  updatedAt: Date
}): JobView {
  // A job whose process died mid-flight would otherwise poll forever.
  const stale =
    row.status === 'running' && Date.now() - row.updatedAt.getTime() > STALE_AFTER

  return {
    id: row.id,
    kind: row.kind as JobKind,
    status: stale ? 'failed' : (row.status as JobStatus),
    input: parse(row.input),
    result: parse(row.result),
    error: stale ? 'That took too long and was given up on.' : row.error,
    updatedAt: row.updatedAt.toISOString(),
  }
}

function parse(json: string | null) {
  if (!json) return null
  try {
    return JSON.parse(json) as unknown
  } catch {
    return null
  }
}

async function finish(id: string, result: unknown) {
  await db.job.update({
    where: { id },
    data: { status: 'done', result: JSON.stringify(result) },
  })
}

async function fail(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  console.error('[jobs] failed', message)
  await db.job.update({ where: { id }, data: { status: 'failed', error: message.slice(0, 300) } })
}

/**
 * Does the work.
 *
 * Called from `after()`, so it runs once the response has already gone out.
 * Nothing in here may throw: a rejected promise after the response is a job
 * left saying "running" forever, which is worse than one that says it failed.
 */
export async function runJob(id: string, kind: JobKind, input: Record<string, unknown>) {
  try {
    if (kind === 'map') await runMap(id, input)
    else if (kind === 'expand') await runExpand(id, input)
    else if (kind === 'math') await runMath(id, input)
    else if (kind === 'lesson') await runLesson(id, input)
  } catch (error) {
    await fail(id, error).catch(() => {})
  }
}

const model = (input: Record<string, unknown>) =>
  typeof input.model === 'string' ? input.model : undefined

async function runMap(id: string, input: Record<string, unknown>) {
  // An outline needs no model at all: the structure is already decided.
  if (typeof input.outline === 'string' && input.outline.trim()) {
    const root = parseOutline(input.outline.slice(0, 6000))
    if (!root) throw new Error('Nothing to map in that outline.')
    const mindmap: MindMap = {
      heading: typeof input.heading === 'string' ? input.heading : '',
      root,
    }
    await finish(id, { mindmap })
    return
  }

  const topic = String(input.topic ?? '').trim()
  if (!topic) throw new Error('Give it a topic to map.')

  const content = await completeStructured({
    provider: DEFAULT_PROVIDER,
    model: model(input),
    system: MINDMAP_SYSTEM_PROMPT,
    user: mindmapPrompt(topic),
    schema: MINDMAP_JSON_SCHEMA,
    effort: process.env.OPENAI_MINDMAP_EFFORT ?? 'low',
    maxTokens: 4_000,
  })

  const mindmap = mindmapFromModel(JSON.parse(content || '{}'))
  if (!mindmap) throw new Error('The map had no branches.')
  await finish(id, { mindmap })
}

async function runExpand(id: string, input: Record<string, unknown>) {
  const trail = (Array.isArray(input.trail) ? input.trail : [])
    .filter((step): step is string => typeof step === 'string' && Boolean(step.trim()))
    .map((step) => step.trim().slice(0, 120))
    .slice(0, 12)
  if (trail.length < 2) throw new Error('Say which node to open, and where it sits.')

  const content = await completeStructured({
    provider: DEFAULT_PROVIDER,
    model: model(input),
    system: MINDMAP_EXPAND_SYSTEM_PROMPT,
    user: expandPrompt(trail),
    schema: EXPAND_JSON_SCHEMA,
    effort: process.env.OPENAI_MINDMAP_EFFORT ?? 'low',
    maxTokens: 3_000,
  })

  const children = childrenFromModel(JSON.parse(content || '{}'))
  if (!children.length) throw new Error('Nothing came back under that one.')
  await finish(id, { children, node: input.node ?? null })
}

async function runMath(id: string, input: Record<string, unknown>) {
  const question = String(input.question ?? '').trim()
  if (!question) throw new Error('Give it a problem to work.')

  const content = await completeStructured({
    provider: DEFAULT_PROVIDER,
    model: model(input),
    system: MATH_SYSTEM_PROMPT,
    user: mathPrompt(question),
    schema: MATH_JSON_SCHEMA,
    effort: process.env.OPENAI_MATH_EFFORT ?? 'medium',
    maxTokens: 8_000,
  })

  const solution = solutionFromModel(JSON.parse(content || '{}'))
  if (!solution) throw new Error('That came back empty.')
  await finish(id, { solution })
}

/**
 * A lesson, written into the row as it arrives.
 *
 * The only job with a middle: a lesson is scenes, and someone who reloads
 * thirty seconds in should get the scenes that already exist rather than an
 * empty board and a spinner. So each scene is written as it lands and the
 * client renders whatever the row has.
 */
async function runLesson(id: string, input: Record<string, unknown>) {
  const { LESSON_JSON_SCHEMA, isRenderableScene, normalizeScene } = await import('./lesson')
  const { SYSTEM_PROMPT, userPrompt } = await import('./prompt')

  const topic = String(input.topic ?? '').trim()
  if (!topic) throw new Error('Give it a topic to teach.')

  let text = ''
  let written = 0
  const scenes: unknown[] = []

  for await (const chunk of streamStructured({
    provider: DEFAULT_PROVIDER,
    model: typeof input.model === 'string' ? input.model : undefined,
    system: SYSTEM_PROMPT,
    user: userPrompt(topic),
    schema: LESSON_JSON_SCHEMA,
    maxTokens: 32_000,
  })) {
    text += chunk

    // Cheap progress: every so often, try the partial document. A half-written
    // scene simply does not parse yet, so nothing half-drawn is ever stored.
    if (text.length - written > 4000) {
      written = text.length
      const partial = salvage(text)
      if (partial) {
        await db.job
          .update({ where: { id }, data: { result: JSON.stringify({ lesson: partial }) } })
          .catch(() => {})
      }
    }
  }

  const parsed = JSON.parse(text) as { title?: string; summary?: string; scenes?: unknown[] }
  for (const [index, scene] of (parsed.scenes ?? []).entries()) {
    if (isRenderableScene(scene as never)) scenes.push(normalizeScene(scene as never, index))
  }
  if (!scenes.length) throw new Error('The model returned a lesson with no scenes.')

  await finish(id, {
    lesson: { title: parsed.title ?? topic, summary: parsed.summary ?? '', scenes },
  })
}

/**
 * The finished scenes inside a JSON document that is still being written.
 *
 * The document is streamed a token at a time, so most of the time it ends
 * mid-string. Closing the brackets and trying to parse is enough to recover
 * every *complete* scene without a streaming parser — and a scene that is not
 * complete is one nobody should see yet anyway.
 */
function salvage(text: string): { title: string; summary: string; scenes: unknown[] } | null {
  const scenes: unknown[] = []
  const start = text.indexOf('"scenes"')
  if (start === -1) return null

  let depth = 0
  let from = -1
  let inString = false
  let escaped = false

  for (let i = text.indexOf('[', start); i < text.length && i !== -1; i++) {
    const char = text[i]

    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') {
      if (depth === 0) from = i
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0 && from !== -1) {
        try {
          scenes.push(JSON.parse(text.slice(from, i + 1)))
        } catch {
          // Not a scene, or not a whole one. Either way, skip it.
        }
        from = -1
      }
    }
  }

  if (!scenes.length) return null
  const title = /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text)?.[1] ?? ''
  const summary = /"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text)?.[1] ?? ''
  return { title, summary, scenes }
}
