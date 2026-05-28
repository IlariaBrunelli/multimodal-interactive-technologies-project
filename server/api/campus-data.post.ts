export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const webhookUrl = config.n8nCampusDataWebhook

  if (!webhookUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'N8N_CAMPUS_DATA_WEBHOOK is not configured'
    })
  }

  const body = await readBody(event)

  try {
    const n8nResponse = await $fetch(webhookUrl, {
      method: 'POST',
      body
    })

    return n8nResponse
  } catch (error: any) {
    console.error('N8N Webhook Error:', error)
    throw createError({
      statusCode: 502,
      statusMessage: `n8n Webhook Error: ${error.message || 'Unknown error'}`
    })
  }
})
