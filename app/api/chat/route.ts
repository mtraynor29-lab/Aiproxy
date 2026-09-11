import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UPSTREAM_URL = 'https://api.hcnsec.cn/v1/chat/completions'
const MAX_MESSAGES = 100

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function isValidMessages(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) {
    return false
  }
  return value.every(
    (m) =>
      m !== null &&
      typeof m === 'object' &&
      typeof (m as ChatMessage).role === 'string' &&
      ['system', 'user', 'assistant'].includes((m as ChatMessage).role) &&
      typeof (m as ChatMessage).content === 'string',
  )
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.HCNSEC_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: { message: 'Server API key is not configured', type: 'configuration_error' } },
      { status: 500 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { error: { message: 'Malformed JSON in request body', type: 'invalid_request_error' } },
      { status: 400 },
    )
  }

  const messages = (body as { messages?: unknown })?.messages
  if (!isValidMessages(messages)) {
    return Response.json(
      { error: { message: 'A non-empty "messages" array is required', type: 'invalid_request_error' } },
      { status: 400 },
    )
  }

  let upstream: Response
  try {
    upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: 'auto',
        stream: true,
        messages,
      }),
    })
  } catch {
    return Response.json(
      { error: { message: 'Upstream request failed', type: 'upstream_error' } },
      { status: 502 },
    )
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    return Response.json(
      {
        error: {
          message: 'Upstream returned an error',
          type: 'upstream_error',
          status: upstream.status,
          detail: detail.slice(0, 2000),
        },
      },
      { status: upstream.status || 502 },
    )
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
