type CampusChatRequest = {
  message?: unknown
  sessionId?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractReply(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const reply = extractReply(item)

      if (reply) {
        return reply
      }
    }

    return ''
  }

  if (!isRecord(value)) {
    return ''
  }

  const replyFields = ['output', 'reply', 'answer', 'response', 'text', 'message', 'content']

  for (const field of replyFields) {
    const reply = extractReply(value[field])

    if (reply) {
      return reply
    }
  }

  return ''
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const webhookUrl = config.n8nCampusChatWebhook

  if (!webhookUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'N8N_CAMPUS_CHAT_WEBHOOK is not configured'
    })
  }

  const body = await readBody<CampusChatRequest>(event)
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!message) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Message is required'
    })
  }

  const sessionId = typeof body.sessionId === 'string' && body.sessionId.trim()
    ? body.sessionId.trim()
    : `campus-${Date.now()}`

  const n8nResponse = await $fetch<unknown>(webhookUrl, {
    method: 'POST',
    body: {
      action: 'sendMessage',
      sessionId,
      chatInput: message
    }
  })

  const reply = extractReply(n8nResponse)

  if (!reply) {
    throw createError({
      statusCode: 502,
      statusMessage: 'n8n response did not contain a reply'
    })
  }

  return {
    reply,
    sessionId
  }
})
