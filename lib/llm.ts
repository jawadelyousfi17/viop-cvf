import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { modelFor, type Provider } from './providers'

/**
 * One structured-output call, streamed, against either model.
 *
 * The two APIs express "return JSON matching this schema" differently: OpenAI
 * has `response_format: json_schema`, while Claude has no such thing and gets
 * there through a forced tool call whose input schema is the same document.
 * Both end up emitting the JSON a token at a time, which is what the scene
 * parsers consume — so the difference stops here.
 */

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export interface StreamRequest {
  provider: Provider
  /** A variant from the provider's list; anything else falls back. */
  model?: string
  system: string
  user: string
  schema: object
  /** Reasoning budget. Only OpenAI takes it; Claude ignores it. */
  effort?: string
  maxTokens?: number
}

/** Streams the raw JSON text of the response, chunk by chunk. */
export async function* streamStructured(request: StreamRequest): AsyncGenerator<string> {
  if (request.provider === 'claude') yield* streamClaude(request)
  else yield* streamOpenAI(request)
}

/** The whole response at once, for the short calls that don't stream. */
export async function completeStructured(request: StreamRequest): Promise<string> {
  let text = ''
  for await (const chunk of streamStructured(request)) text += chunk
  return text
}

/**
 * Plain text out, no schema.
 *
 * For the formats that are their own validator. A JSON schema exists to stop a
 * model inventing a field; YAML and the line form are checked by a parser and a
 * linter that were going to run anyway, and forcing them through a tool call
 * would only mean asking for a string inside an object.
 */
export async function* streamText(
  request: Omit<StreamRequest, 'schema'>
): AsyncGenerator<string> {
  if (request.provider === 'claude') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new LlmError('ANTHROPIC_API_KEY is not set.', 501)

    const stream = new Anthropic({ apiKey }).messages.stream({
      model: modelFor('claude', request.model),
      max_tokens: request.maxTokens ?? 16_000,
      system: request.system,
      messages: [{ role: 'user', content: request.user }],
    })
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new LlmError('OPENAI_API_KEY is not set.', 501)

  const stream = await new OpenAI({ apiKey }).chat.completions.create({
    model: modelFor('openai', request.model),
    stream: true,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.user },
    ],
    ...(request.effort ? { reasoning_effort: request.effort as never } : {}),
  })
  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content
    if (delta) yield delta
  }
}

async function* streamOpenAI(request: StreamRequest): AsyncGenerator<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new LlmError('OPENAI_API_KEY is not set.', 501)

  const client = new OpenAI({ apiKey })
  const stream = await client.chat.completions.create({
    model: modelFor('openai', request.model),
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.user },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'lesson', strict: true, schema: request.schema as never },
    },
    ...(request.effort ? { reasoning_effort: request.effort as never } : {}),
  })

  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content
    if (delta) yield delta
  }
}

async function* streamClaude(request: StreamRequest): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new LlmError('ANTHROPIC_API_KEY is not set.', 501)

  const client = new Anthropic({ apiKey })

  // Claude has no json_schema response format. A single tool it is forced to
  // call gives the same guarantee: the arguments are validated against the
  // schema, and they arrive as partial JSON while it writes them.
  const stream = client.messages.stream({
    model: modelFor('claude', request.model),
    max_tokens: request.maxTokens ?? 32_000,
    system: request.system,
    messages: [{ role: 'user', content: request.user }],
    tools: [
      {
        name: 'lesson',
        description: 'Return the finished lesson.',
        input_schema: request.schema as never,
      },
    ],
    tool_choice: { type: 'tool', name: 'lesson' },
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'input_json_delta' &&
      event.delta.partial_json
    ) {
      yield event.delta.partial_json
    }
  }
}
