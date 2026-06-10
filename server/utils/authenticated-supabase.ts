import type { H3Event } from 'h3'

import { createClient } from '@supabase/supabase-js'

function extractBearerToken(event: H3Event) {
  const authorizationHeader = getHeader(event, 'authorization')

  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Login required to access the AI assistant'
    })
  }

  const accessToken = authorizationHeader.slice('Bearer '.length).trim()

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing Supabase access token'
    })
  }

  return accessToken
}

export async function getAuthenticatedSupabaseContext(event: H3Event) {
  const config = useRuntimeConfig(event)
  const accessToken = extractBearerToken(event)

  if (!config.public.supabaseUrl || !config.public.supabaseAnonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase is not configured'
    })
  }

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  })

  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'The Supabase session is no longer valid'
    })
  }

  return {
    supabase,
    user: data.user
  }
}

export async function getAuthenticatedSupabaseUser(event: H3Event) {
  const { user } = await getAuthenticatedSupabaseContext(event)

  return user
}
