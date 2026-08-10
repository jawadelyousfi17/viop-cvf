import { DEFAULT_PROVIDER, isProvider } from '@/lib/providers'
import { requireIdentity } from '@/lib/owner'
import { LlmError, completeStructured } from '@/lib/llm'
import {
  EXPAND_JSON_SCHEMA,
  MINDMAP_JSON_SCHEMA,
  childrenFromModel,
  mindmapFromModel,
  parseOutline,
  type MindMap,
} from '@/lib/mindmap'
import {
  MINDMAP_EXPAND_SYSTEM_PROMPT,
  MINDMAP_SYSTEM_PROMPT,
  expandPrompt,
  mindmapPrompt,
} from '@/lib/prompt'

export const maxDuration = 120

/**
 * Writes mindmaps: the first one, and every node opened up after it.
 *
 * Its own route rather than a shape kind in a lesson, because a mindmap is a
 * different job from a scene. A scene explains one step of an argument; a
 * mindmap holds a whole topic at once, and it is the thing you want before the
 * lesson starts or after it ends.
 *
 * It returns the tree, not a board. Positions are the client's business now —
 * /mindmap keeps the tree in state, lays it out with its own engine, and grafts
 * an expansion onto the node that asked for it — and a route that also returned
 * coordinates would be handing back a second copy of the truth for the client
 * to ignore.
 *
 * Nothing here is narrated: no scene, no anchors, nothing for /api/tts to say.
 * A map is read, not played.
 *
 * Behind the login wall, and this is the route where that matters most: every
 * path through it either calls a model or is one request away from doing so,
 * and an open endpoint that spends tokens is somebody else's free API.
 *
 * Three ways in:
 *  - `topic`   — ask the model for a map of it.
 *  - `outline` — one already written, in indented lines, markdown bullets or a
 *                Mermaid `mindmap` block. No model call, no key needed, which
 *                is also how the layout gets exercised on its own.
 *  - `trail`   — the path from the centre of an existing map down to one node,
 *                asking for that node's children. This is what makes the map
 *                bottomless: every leaf is a question nobody has asked yet.
 */
export async function POST(request: Request) {
  if (!(await requireIdentity())) {
    return Response.json({ error: 'Sign in to make maps.' }, { status: 401 })
  }

  let topic: unknown
  let outline: unknown
  let trail: unknown
  let heading: unknown
  let title: unknown
  let provider: unknown
  let model: unknown
  try {
    ;({ topic, outline, trail, heading, title, provider, model } = await request.json())
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const chosen = isProvider(provider) ? provider : DEFAULT_PROVIDER
  const variant = typeof model === 'string' ? model : undefined

  // Opening up one node of a map that already exists.
  if (Array.isArray(trail)) {
    const steps = trail
      .filter((step): step is string => typeof step === 'string' && Boolean(step.trim()))
      .map((step) => step.trim().slice(0, 120))
      .slice(0, 12)

    if (steps.length < 2) {
      return Response.json({ error: 'Say which node to open, and where it sits.' }, { status: 400 })
    }

    try {
      const content = await completeStructured({
        provider: chosen,
        model: variant,
        system: MINDMAP_EXPAND_SYSTEM_PROMPT,
        user: expandPrompt(steps),
        schema: EXPAND_JSON_SCHEMA,
        // Deeper nodes are the ones that need thinking about — this is where a
        // map stops listing and starts explaining.
        effort: process.env.OPENAI_MINDMAP_EFFORT ?? 'low',
        maxTokens: 3_000,
      })

      const children = childrenFromModel(JSON.parse(content || '{}'))
      if (!children.length) {
        return Response.json({ error: 'Nothing came back under that one.' }, { status: 502 })
      }
      return Response.json({ children })
    } catch (error) {
      return failed(error, 'open that up')
    }
  }

  // An outline sidesteps the model entirely: the structure is already decided,
  // and all that is left is the layout.
  if (typeof outline === 'string' && outline.trim()) {
    const root = parseOutline(outline.slice(0, 6000))
    if (!root) return Response.json({ error: 'Nothing to map in that outline.' }, { status: 400 })

    return Response.json({
      mindmap: { heading: typeof heading === 'string' ? heading : '', root } satisfies MindMap,
    })
  }

  if (typeof topic !== 'string' || !topic.trim()) {
    return Response.json({ error: 'Give it a topic to map.' }, { status: 400 })
  }
  if (topic.length > 400) {
    return Response.json({ error: 'Keep the topic under 400 characters.' }, { status: 400 })
  }

  try {
    const content = await completeStructured({
      provider: chosen,
      model: variant,
      system: MINDMAP_SYSTEM_PROMPT,
      user: mindmapPrompt(topic.trim(), { title: typeof title === 'string' ? title : '' }),
      schema: MINDMAP_JSON_SCHEMA,
      // A map is a handful of short labels. The thinking that matters is which
      // branches the topic really has, and that does not need a long budget.
      effort: process.env.OPENAI_MINDMAP_EFFORT ?? 'low',
      maxTokens: 4_000,
    })

    if (!content) return Response.json({ error: 'No map came back.' }, { status: 502 })

    const mindmap = mindmapFromModel(JSON.parse(content))
    if (!mindmap) return Response.json({ error: 'The map had no branches.' }, { status: 502 })

    return Response.json({ mindmap })
  } catch (error) {
    return failed(error, 'map that')
  }
}

function failed(error: unknown, what: string) {
  if (error instanceof LlmError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  console.error('[mindmap] failed', error)
  const message = error instanceof Error ? error.message : 'Unknown error'
  return Response.json({ error: `Could not ${what}: ${message}` }, { status: 502 })
}
