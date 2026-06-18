import { loadCalendarFromIcalUrl } from '../utils/ical'
import { saveUserInfoCalendarUrl } from '../utils/user-info-calendar'

type UserCalendarPreviewRequest = {
  icalUrl?: unknown
}

export default defineEventHandler(async (event) => {
  const body = await readBody<UserCalendarPreviewRequest>(event)
  const icalUrl = typeof body.icalUrl === 'string' ? body.icalUrl.trim() : ''

  if (!icalUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The iCal link is required'
    })
  }

  let parsedCalendar: Awaited<ReturnType<typeof loadCalendarFromIcalUrl>>

  try {
    parsedCalendar = await loadCalendarFromIcalUrl(icalUrl)
  } catch (error) {
    throw createError({
      statusCode: 422,
      statusMessage: error instanceof Error
        ? error.message
        : 'The iCal link could not be validated'
    })
  }

  await saveUserInfoCalendarUrl(event, parsedCalendar.normalizedUrl)

  return {
    calendar: {
      icalUrl: parsedCalendar.normalizedUrl,
      calendarName: parsedCalendar.calendarName,
      upcomingEvents: parsedCalendar.events.slice(0, 6)
    }
  }
})
