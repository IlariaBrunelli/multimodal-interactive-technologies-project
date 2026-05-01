export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const webhookUrl = config.n8nCampusChatWebhook

  if (!webhookUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'N8N_CAMPUS_CHAT_WEBHOOK is not configured'
    })
  }

  const body = await readBody<{ message?: string; sessionId?: string }>(event)
  const message = body?.message?.trim()

  if (!message) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Message is required'
    })
  }

  // Forward the Authorization header for the "Decode a JWT" step in n8n
  const authHeader = getHeader(event, 'authorization')
  const headers: Record<string, string> = {}
  if (authHeader) {
    headers['Authorization'] = authHeader
  }

  try {
    // The webhook call will run on n8n and return an answer with the message content in a json with "text" string field
    const n8nResponse = await $fetch<{ text: string }>(webhookUrl, {
      method: 'POST',
      headers,
      timeout: 600000, // 10 minutes timeout for local LLMs like Ollama
      body: {
        message,
        sessionId: body.sessionId
      }
    })

    if (!n8nResponse || typeof n8nResponse.text !== 'string') {
      throw createError({
        statusCode: 502,
        statusMessage: 'n8n response did not contain a "text" string field'
      })
    }

    return {
      reply: n8nResponse.text,
      sessionId: body.sessionId
    }
  } catch (error: any) {
    console.error('N8N Webhook Error:', error)
    throw createError({
      statusCode: 502,
      statusMessage: `n8n Webhook Error: ${error.message || 'Unknown error'}`
    })
  }
})
