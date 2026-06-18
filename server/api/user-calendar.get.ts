import { loadCalendarFromIcalUrl } from '../utils/ical'
import { getUserInfoCalendarUrl } from '../utils/user-info-calendar'

export default defineEventHandler(async (event) => {
  const icalUrl = await getUserInfoCalendarUrl(event)

  if (!icalUrl) {
    return {
      calendar: null
    }
  }

  try {
    const parsedCalendar = await loadCalendarFromIcalUrl(icalUrl)

    return {
      calendar: {
        icalUrl: parsedCalendar.normalizedUrl,
        calendarName: parsedCalendar.calendarName,
        upcomingEvents: parsedCalendar.events.slice(0, 6)
      }
    }
  } catch (error) {
    throw createError({
      statusCode: 422,
      statusMessage: error instanceof Error
        ? error.message
        : 'The saved iCal link could not be loaded'
    })
  }
})
