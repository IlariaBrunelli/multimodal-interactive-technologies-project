type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrapGuidedTourRows(value: unknown): JsonRecord[] {
  if (typeof value === 'string') {
    try {
      return unwrapGuidedTourRows(JSON.parse(value))
    } catch {
      return []
    }
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (isRecord(item) && 'json' in item) {
        return unwrapGuidedTourRows(item.json)
      }

      return isRecord(item) ? [item] : []
    })
  }

  if (!isRecord(value)) {
    return []
  }

  if ('json' in value) {
    return unwrapGuidedTourRows(value.json)
  }

  for (const key of ['steps', 'data', 'rows', 'items', 'result', 'guided_tour']) {
    if (key in value) {
      const rows = unwrapGuidedTourRows(value[key])

      if (rows.length > 0) {
        return rows
      }
    }
  }

  return [value]
}

function getFetchStatusCode(error: any) {
  return error?.statusCode ?? error?.status ?? error?.response?.status ?? null
}

async function fetchGuidedTourWebhook(webhookUrl: string) {
  try {
    return await $fetch<unknown>(webhookUrl, {
      method: 'GET',
      timeout: 60000
    })
  } catch (error: any) {
    const statusCode = getFetchStatusCode(error)

    if (statusCode !== 404 && statusCode !== 405) {
      throw error
    }

    return await $fetch<unknown>(webhookUrl, {
      method: 'POST',
      timeout: 60000,
      body: {}
    })
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const webhookUrl = config.n8nGuidedTourStepsWebhook

  if (!webhookUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'N8N_GUIDED_TOUR_STEPS_WEBHOOK is not configured'
    })
  }

  try {
    const webhookResponse = await fetchGuidedTourWebhook(webhookUrl)
    const steps = unwrapGuidedTourRows(webhookResponse)

    return { steps }
  } catch (error: any) {
    console.error('Guided tour webhook error:', error)
    throw createError({
      statusCode: 502,
      statusMessage: `Guided tour webhook error: ${error.message || 'Unknown error'}`
    })
  }
})
