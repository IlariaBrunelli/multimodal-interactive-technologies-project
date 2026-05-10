export type UserCalendarPreviewEvent = {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  location: string | null
  description: string | null
}

export type UserCalendarResponse = {
  calendar: {
    icalUrl: string
    calendarName: string | null
    upcomingEvents: UserCalendarPreviewEvent[]
  } | null
}
