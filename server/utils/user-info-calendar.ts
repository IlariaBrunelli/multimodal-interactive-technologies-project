import type { H3Event } from 'h3'

import { getAuthenticatedSupabaseContext } from './authenticated-supabase'

function normalizeCalendarUrl(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null
}

function createUserInfoError(statusMessage: string) {
  return createError({
    statusCode: 500,
    statusMessage
  })
}

export async function getUserInfoCalendarUrl(event: H3Event) {
  const { supabase, user } = await getAuthenticatedSupabaseContext(event)
  const { data, error } = await supabase
    .from('user_info')
    .select('calendar_url')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw createUserInfoError('Could not read calendar_url from user_info')
  }

  return normalizeCalendarUrl(data?.calendar_url)
}

export async function saveUserInfoCalendarUrl(event: H3Event, calendarUrl: string) {
  const { supabase, user } = await getAuthenticatedSupabaseContext(event)
  const normalizedCalendarUrl = calendarUrl.trim()

  const updateResult = await supabase
    .from('user_info')
    .update({ calendar_url: normalizedCalendarUrl })
    .eq('user_id', user.id)
    .select('calendar_url')
    .maybeSingle()

  if (updateResult.error) {
    throw createUserInfoError('Could not update calendar_url in user_info')
  }

  if (updateResult.data?.calendar_url) {
    return normalizedCalendarUrl
  }

  const insertResult = await supabase
    .from('user_info')
    .insert({
      user_id: user.id,
      calendar_url: normalizedCalendarUrl
    })

  if (insertResult.error) {
    throw createUserInfoError('Could not insert calendar_url into user_info')
  }

  return normalizedCalendarUrl
}
