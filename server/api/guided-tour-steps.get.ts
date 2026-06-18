type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isGuidedTourRowLike(value: JsonRecord) {
  return 'building_id' in value || 'storytelling' in value || 'step' in value
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
    return value.flatMap((item) => unwrapGuidedTourRows(item))
  }

  if (!isRecord(value)) {
    return []
  }

  if ('json' in value) {
    return unwrapGuidedTourRows(value.json)
  }

  if (isGuidedTourRowLike(value)) {
    return [value]
  }

  for (const key of ['steps', 'data', 'rows', 'items', 'result', 'guided_tour', 'body', 'response', 'output', 'records']) {
    if (key in value) {
      const rows = unwrapGuidedTourRows(value[key])

      if (rows.length > 0) {
        return rows
      }
    }
  }

  for (const nestedValue of Object.values(value)) {
    const rows = unwrapGuidedTourRows(nestedValue)

    if (rows.length > 0) {
      return rows
    }
  }

  return []
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

async function fetchGuidedTourSupabase(event: any) {
  const config = useRuntimeConfig(event)
  const supabaseUrl = config.public.supabaseUrl
  const supabaseAnonKey = config.public.supabaseAnonKey

  if (!supabaseUrl || !supabaseAnonKey) {
    return []
  }

  const authHeader = getHeader(event, 'authorization')
  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
    Authorization: authHeader || `Bearer ${supabaseAnonKey}`
  }

  const rows = await $fetch<unknown>(`${supabaseUrl}/rest/v1/guided_tour`, {
    method: 'GET',
    headers,
    query: {
      select: 'id,building_id,step,storytelling',
      order: 'step.asc'
    },
    timeout: 30000
  })

  return unwrapGuidedTourRows(rows)
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const webhookUrl = config.n8nGuidedTourStepsWebhook

  let webhookError: any = null

  try {
    if (webhookUrl) {
      const webhookResponse = await fetchGuidedTourWebhook(webhookUrl)
      const steps = unwrapGuidedTourRows(webhookResponse)

      if (steps.length > 0) {
        return { steps, source: 'webhook' }
      }
    }
  } catch (error: any) {
    webhookError = error
    console.warn('Guided tour webhook failed. Falling back to Supabase.', error)
  }

  try {
    const steps = await fetchGuidedTourSupabase(event)

    if (steps.length > 0) {
      return { steps, source: 'supabase' }
    }

    if (webhookError) {
      throw webhookError
    }

    return { steps: [], source: 'empty' }
  } catch (error: any) {
    console.error('Guided tour webhook error:', error)
    throw createError({
      statusCode: 502,
      statusMessage: `Guided tour load error: ${error.message || 'Unknown error'}`
    })
  }
})
