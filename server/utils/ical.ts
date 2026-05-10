import type { UserCalendarPreviewEvent } from '../../app/utils/user-calendar'

type ContentLine = {
  name: string
  params: Record<string, string>
  value: string
}

type LocalDateTime = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

type ParsedICalDate = {
  local: LocalDateTime
  date: Date
  allDay: boolean
  timezone: string | null
}

type ParsedRRule = {
  freq: string
  interval: number
  count: number | null
  until: ParsedICalDate | null
  byDay: number[]
  byMonthDay: number[]
}

type RawCalendarEvent = {
  uid: string | null
  summary: string | null
  description: string | null
  location: string | null
  status: string | null
  startProperty: ContentLine | null
  endProperty: ContentLine | null
  recurrenceIdProperty: ContentLine | null
  exdateProperties: ContentLine[]
  rrule: string | null
}

type ParseCalendarOptions = {
  now?: Date
  windowDays?: number
}

type ParsedCalendar = {
  calendarName: string | null
  events: UserCalendarPreviewEvent[]
}

const dayCodeToIndex: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6
}

const dayInMilliseconds = 24 * 60 * 60 * 1000

function createEmptyRawCalendarEvent(): RawCalendarEvent {
  return {
    uid: null,
    summary: null,
    description: null,
    location: null,
    status: null,
    startProperty: null,
    endProperty: null,
    recurrenceIdProperty: null,
    exdateProperties: [],
    rrule: null
  }
}

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function normalizeTimeZoneId(rawTimeZone: string | undefined) {
  if (!rawTimeZone) {
    return null
  }

  const cleanedTimeZone = rawTimeZone.trim().replace(/^"|"$/g, '')

  if (!cleanedTimeZone) {
    return null
  }

  if (isValidTimeZone(cleanedTimeZone)) {
    return cleanedTimeZone
  }

  const segments = cleanedTimeZone.split('/').filter(Boolean)

  for (let index = 0; index < segments.length; index += 1) {
    const candidate = segments.slice(index).join('/')

    if (isValidTimeZone(candidate)) {
      return candidate
    }
  }

  return null
}

function unfoldContentLines(source: string) {
  return source
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
}

function parseContentLine(line: string): ContentLine | null {
  const separatorIndex = line.indexOf(':')

  if (separatorIndex < 0) {
    return null
  }

  const rawNameAndParams = line.slice(0, separatorIndex)
  const rawValue = line.slice(separatorIndex + 1)
  const [rawName, ...rawParams] = rawNameAndParams.split(';')

  if (!rawName) {
    return null
  }

  const params: Record<string, string> = {}

  for (const rawParam of rawParams) {
    const [rawKey, ...rawParamValueParts] = rawParam.split('=')
    const key = rawKey?.trim().toUpperCase()

    if (!key || rawParamValueParts.length === 0) {
      continue
    }

    params[key] = rawParamValueParts.join('=').trim()
  }

  return {
    name: rawName.trim().toUpperCase(),
    params,
    value: rawValue
  }
}

function unescapeText(value: string | null) {
  if (!value) {
    return null
  }

  const normalized = value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()

  return normalized || null
}

function normalizeDescription(value: string | null) {
  return value?.replace(/\s+/g, ' ').trim() || null
}

function parseInteger(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function buildLocalDateTime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): LocalDateTime {
  return { year, month, day, hour, minute, second }
}

function getTimeZoneOffsetInMilliseconds(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const parts = formatter.formatToParts(date)
  const year = parseInteger(parts.find((part) => part.type === 'year')?.value || '') || 0
  const month = parseInteger(parts.find((part) => part.type === 'month')?.value || '') || 1
  const day = parseInteger(parts.find((part) => part.type === 'day')?.value || '') || 1
  const hour = parseInteger(parts.find((part) => part.type === 'hour')?.value || '') || 0
  const minute = parseInteger(parts.find((part) => part.type === 'minute')?.value || '') || 0
  const second = parseInteger(parts.find((part) => part.type === 'second')?.value || '') || 0
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second)

  return asUtc - date.getTime()
}

function zonedLocalDateTimeToUtc(local: LocalDateTime, timeZone: string) {
  let utcTimestamp = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second
  )

  for (let index = 0; index < 2; index += 1) {
    const offset = getTimeZoneOffsetInMilliseconds(new Date(utcTimestamp), timeZone)
    utcTimestamp = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second
    ) - offset
  }

  return new Date(utcTimestamp)
}

function parseDateTimeValue(
  value: string,
  params: Record<string, string>,
  defaultTimeZone: string | null
): ParsedICalDate | null {
  const isAllDay = params.VALUE?.toUpperCase() === 'DATE' || /^\d{8}$/.test(value)

  if (isAllDay) {
    const year = parseInteger(value.slice(0, 4))
    const month = parseInteger(value.slice(4, 6))
    const day = parseInteger(value.slice(6, 8))

    if (!year || !month || !day) {
      return null
    }

    const local = buildLocalDateTime(year, month, day)
    const timeZone = normalizeTimeZoneId(params.TZID) ?? defaultTimeZone
    const date = timeZone
      ? zonedLocalDateTimeToUtc(local, timeZone)
      : new Date(Date.UTC(year, month - 1, day))

    return {
      local,
      date,
      allDay: true,
      timezone: timeZone
    }
  }

  const normalizedValue = value.endsWith('Z') ? value.slice(0, -1) : value
  const year = parseInteger(normalizedValue.slice(0, 4))
  const month = parseInteger(normalizedValue.slice(4, 6))
  const day = parseInteger(normalizedValue.slice(6, 8))
  const hour = parseInteger(normalizedValue.slice(9, 11))
  const minute = parseInteger(normalizedValue.slice(11, 13))
  const second = parseInteger(normalizedValue.slice(13, 15)) ?? 0

  if (!year || !month || !day || hour === null || minute === null) {
    return null
  }

  const local = buildLocalDateTime(year, month, day, hour, minute, second)

  if (value.endsWith('Z')) {
    return {
      local,
      date: new Date(Date.UTC(year, month - 1, day, hour, minute, second)),
      allDay: false,
      timezone: 'UTC'
    }
  }

  const timeZone = normalizeTimeZoneId(params.TZID) ?? defaultTimeZone
  const date = timeZone
    ? zonedLocalDateTimeToUtc(local, timeZone)
    : new Date(Date.UTC(year, month - 1, day, hour, minute, second))

  return {
    local,
    date,
    allDay: false,
    timezone: timeZone
  }
}

function localDateMarker(local: LocalDateTime) {
  return Date.UTC(local.year, local.month - 1, local.day)
}

function compareLocals(left: LocalDateTime, right: LocalDateTime) {
  return (
    Date.UTC(
      left.year,
      left.month - 1,
      left.day,
      left.hour,
      left.minute,
      left.second
    ) -
    Date.UTC(
      right.year,
      right.month - 1,
      right.day,
      right.hour,
      right.minute,
      right.second
    )
  )
}

function addDays(local: LocalDateTime, amount: number) {
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day))
  date.setUTCDate(date.getUTCDate() + amount)

  return buildLocalDateTime(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    local.hour,
    local.minute,
    local.second
  )
}

function addMonths(local: LocalDateTime, amount: number) {
  const date = new Date(Date.UTC(local.year, local.month - 1, 1))
  date.setUTCMonth(date.getUTCMonth() + amount)

  const targetYear = date.getUTCFullYear()
  const targetMonth = date.getUTCMonth() + 1
  const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()

  return buildLocalDateTime(
    targetYear,
    targetMonth,
    Math.min(local.day, lastDayOfMonth),
    local.hour,
    local.minute,
    local.second
  )
}

function getWeekDay(local: LocalDateTime) {
  return new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay()
}

function buildOccurrenceKey(local: LocalDateTime, allDay: boolean) {
  const datePart = `${local.year.toString().padStart(4, '0')}${local.month
    .toString()
    .padStart(2, '0')}${local.day.toString().padStart(2, '0')}`

  if (allDay) {
    return datePart
  }

  return `${datePart}T${local.hour.toString().padStart(2, '0')}${local.minute
    .toString()
    .padStart(2, '0')}${local.second.toString().padStart(2, '0')}`
}

function parseRRule(value: string, defaultTimeZone: string | null) {
  const rule: ParsedRRule = {
    freq: '',
    interval: 1,
    count: null,
    until: null,
    byDay: [],
    byMonthDay: []
  }

  for (const segment of value.split(';')) {
    const [rawKey, rawRuleValue = ''] = segment.split('=')
    const key = rawKey.trim().toUpperCase()
    const normalizedValue = rawRuleValue.trim()

    if (!key || !normalizedValue) {
      continue
    }

    if (key === 'FREQ') {
      rule.freq = normalizedValue.toUpperCase()
    } else if (key === 'INTERVAL') {
      rule.interval = Math.max(parseInteger(normalizedValue) ?? 1, 1)
    } else if (key === 'COUNT') {
      rule.count = parseInteger(normalizedValue)
    } else if (key === 'UNTIL') {
      rule.until = parseDateTimeValue(normalizedValue, {}, defaultTimeZone)
    } else if (key === 'BYDAY') {
      rule.byDay = normalizedValue
        .split(',')
        .map((entry) => entry.trim().slice(-2).toUpperCase())
        .map((entry) => dayCodeToIndex[entry])
        .filter((entry): entry is number => Number.isInteger(entry))
    } else if (key === 'BYMONTHDAY') {
      rule.byMonthDay = normalizedValue
        .split(',')
        .map((entry) => parseInteger(entry.trim()))
        .filter((entry): entry is number => entry !== null)
    }
  }

  return rule
}

function extractDateProperties(line: ContentLine, defaultTimeZone: string | null) {
  return line.value
    .split(',')
    .map((entry) => parseDateTimeValue(entry.trim(), line.params, defaultTimeZone))
    .filter((entry): entry is ParsedICalDate => entry !== null)
}

function shouldIncludeOccurrence(
  startDate: Date,
  endDate: Date,
  windowStart: Date,
  windowEnd: Date
) {
  return endDate >= windowStart && startDate <= windowEnd
}

function buildCalendarEvent(
  rawEvent: RawCalendarEvent,
  startDate: Date,
  endDate: Date,
  occurrenceLocal: LocalDateTime,
  allDay: boolean
): UserCalendarPreviewEvent {
  const title = unescapeText(rawEvent.summary) ?? 'Untitled class'
  const location = unescapeText(rawEvent.location)
  const description = normalizeDescription(unescapeText(rawEvent.description))
  const uid = rawEvent.uid?.trim() || `${title}-${startDate.toISOString()}`

  return {
    id: `${uid}-${buildOccurrenceKey(occurrenceLocal, allDay)}`,
    title,
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    allDay,
    location,
    description
  }
}

function expandRecurringEvent(
  rawEvent: RawCalendarEvent,
  overrides: RawCalendarEvent[],
  defaultTimeZone: string | null,
  windowStart: Date,
  windowEnd: Date
) {
  const start = rawEvent.startProperty
    ? parseDateTimeValue(rawEvent.startProperty.value, rawEvent.startProperty.params, defaultTimeZone)
    : null

  if (!start || !rawEvent.rrule) {
    return []
  }

  const explicitEnd = rawEvent.endProperty
    ? parseDateTimeValue(rawEvent.endProperty.value, rawEvent.endProperty.params, defaultTimeZone)
    : null
  const fallbackEnd = start.allDay ? addDays(start.local, 1) : buildLocalDateTime(
    start.local.year,
    start.local.month,
    start.local.day,
    start.local.hour + 1,
    start.local.minute,
    start.local.second
  )
  const derivedEnd = explicitEnd ?? {
    local: fallbackEnd,
    date: start.timezone
      ? zonedLocalDateTimeToUtc(fallbackEnd, start.timezone)
      : new Date(start.date.getTime() + (start.allDay ? dayInMilliseconds : 60 * 60 * 1000)),
    allDay: start.allDay,
    timezone: start.timezone
  }
  const durationInMilliseconds = Math.max(derivedEnd.date.getTime() - start.date.getTime(), 0)
  const recurrenceRule = parseRRule(rawEvent.rrule, start.timezone ?? defaultTimeZone)
  const exdateKeys = new Set(
    rawEvent.exdateProperties.flatMap((property) =>
      extractDateProperties(property, start.timezone ?? defaultTimeZone).map((entry) =>
        buildOccurrenceKey(entry.local, entry.allDay)
      )
    )
  )
  const overrideMap = new Map<string, RawCalendarEvent>()

  for (const overrideEvent of overrides) {
    if (!overrideEvent.recurrenceIdProperty) {
      continue
    }

    const recurrenceId = parseDateTimeValue(
      overrideEvent.recurrenceIdProperty.value,
      overrideEvent.recurrenceIdProperty.params,
      start.timezone ?? defaultTimeZone
    )

    if (recurrenceId) {
      overrideMap.set(buildOccurrenceKey(recurrenceId.local, recurrenceId.allDay), overrideEvent)
    }
  }

  const results: UserCalendarPreviewEvent[] = []
  const recurrenceLimit = Math.min(recurrenceRule.count ?? 500, 500)
  let emittedOccurrences = 0

  if (recurrenceRule.freq === 'WEEKLY') {
    const dayOffsets = recurrenceRule.byDay.length
      ? [...recurrenceRule.byDay].sort((left, right) => left - right)
      : [getWeekDay(start.local)]
    const baseWeekStart = addDays(start.local, -((getWeekDay(start.local) + 6) % 7))

    for (let weekIndex = 0; weekIndex < 120; weekIndex += recurrenceRule.interval) {
      const currentWeekStart = addDays(baseWeekStart, weekIndex * 7)

      for (const dayIndex of dayOffsets) {
        const offsetFromMonday = (dayIndex + 6) % 7
        const occurrenceLocal = addDays(currentWeekStart, offsetFromMonday)

        if (compareLocals(occurrenceLocal, start.local) < 0) {
          continue
        }

        const occurrenceStart = start.timezone
          ? zonedLocalDateTimeToUtc(occurrenceLocal, start.timezone)
          : new Date(Date.UTC(
            occurrenceLocal.year,
            occurrenceLocal.month - 1,
            occurrenceLocal.day,
            occurrenceLocal.hour,
            occurrenceLocal.minute,
            occurrenceLocal.second
          ))

        if (recurrenceRule.until && occurrenceStart > recurrenceRule.until.date) {
          continue
        }

        emittedOccurrences += 1

        if (emittedOccurrences > recurrenceLimit) {
          return results
        }

        const occurrenceKey = buildOccurrenceKey(occurrenceLocal, start.allDay)
        const overrideEvent = overrideMap.get(occurrenceKey)

        if (overrideEvent?.status?.toUpperCase() === 'CANCELLED' || exdateKeys.has(occurrenceKey)) {
          continue
        }

        if (overrideEvent) {
          results.push(
            ...buildSingleEventsFromRawEvent(
              overrideEvent,
              start.timezone ?? defaultTimeZone,
              windowStart,
              windowEnd
            )
          )
          continue
        }

        const occurrenceEnd = new Date(occurrenceStart.getTime() + durationInMilliseconds)

        if (shouldIncludeOccurrence(occurrenceStart, occurrenceEnd, windowStart, windowEnd)) {
          results.push(
            buildCalendarEvent(rawEvent, occurrenceStart, occurrenceEnd, occurrenceLocal, start.allDay)
          )
        }

        if (occurrenceStart > windowEnd && emittedOccurrences > 0) {
          return results
        }
      }
    }

    return results
  }

  let occurrenceLocal = start.local

  for (let index = 0; index < 500; index += 1) {
    const occurrenceStart = start.timezone
      ? zonedLocalDateTimeToUtc(occurrenceLocal, start.timezone)
      : new Date(Date.UTC(
        occurrenceLocal.year,
        occurrenceLocal.month - 1,
        occurrenceLocal.day,
        occurrenceLocal.hour,
        occurrenceLocal.minute,
        occurrenceLocal.second
      ))

    if (recurrenceRule.until && occurrenceStart > recurrenceRule.until.date) {
      break
    }

    const currentWeekDay = getWeekDay(occurrenceLocal)
    const matchesDailyRule = recurrenceRule.freq === 'DAILY'
    const matchesMonthlyRule = recurrenceRule.freq === 'MONTHLY'

    if (matchesDailyRule || matchesMonthlyRule) {
      const matchesByDay = recurrenceRule.byDay.length === 0 || recurrenceRule.byDay.includes(currentWeekDay)
      const matchesByMonthDay =
        recurrenceRule.byMonthDay.length === 0 || recurrenceRule.byMonthDay.includes(occurrenceLocal.day)

      if (matchesByDay && matchesByMonthDay) {
        emittedOccurrences += 1

        if (emittedOccurrences > recurrenceLimit) {
          break
        }

        const occurrenceKey = buildOccurrenceKey(occurrenceLocal, start.allDay)
        const overrideEvent = overrideMap.get(occurrenceKey)

        if (overrideEvent?.status?.toUpperCase() !== 'CANCELLED' && !exdateKeys.has(occurrenceKey)) {
          if (overrideEvent) {
            results.push(
              ...buildSingleEventsFromRawEvent(
                overrideEvent,
                start.timezone ?? defaultTimeZone,
                windowStart,
                windowEnd
              )
            )
          } else {
            const occurrenceEnd = new Date(occurrenceStart.getTime() + durationInMilliseconds)

            if (shouldIncludeOccurrence(occurrenceStart, occurrenceEnd, windowStart, windowEnd)) {
              results.push(
                buildCalendarEvent(rawEvent, occurrenceStart, occurrenceEnd, occurrenceLocal, start.allDay)
              )
            }
          }
        }
      }
    }

    if (occurrenceStart > windowEnd && emittedOccurrences > 0) {
      break
    }

    occurrenceLocal = recurrenceRule.freq === 'MONTHLY'
      ? addMonths(occurrenceLocal, recurrenceRule.interval)
      : addDays(occurrenceLocal, recurrenceRule.interval)
  }

  return results
}

function buildSingleEventsFromRawEvent(
  rawEvent: RawCalendarEvent,
  defaultTimeZone: string | null,
  windowStart: Date,
  windowEnd: Date
) {
  if (rawEvent.status?.toUpperCase() === 'CANCELLED' || !rawEvent.startProperty) {
    return []
  }

  const start = parseDateTimeValue(rawEvent.startProperty.value, rawEvent.startProperty.params, defaultTimeZone)

  if (!start) {
    return []
  }

  const end = rawEvent.endProperty
    ? parseDateTimeValue(rawEvent.endProperty.value, rawEvent.endProperty.params, defaultTimeZone)
    : null
  const derivedEnd = end ?? {
    local: start.allDay ? addDays(start.local, 1) : buildLocalDateTime(
      start.local.year,
      start.local.month,
      start.local.day,
      start.local.hour + 1,
      start.local.minute,
      start.local.second
    ),
    date: new Date(start.date.getTime() + (start.allDay ? dayInMilliseconds : 60 * 60 * 1000)),
    allDay: start.allDay,
    timezone: start.timezone
  }

  if (!shouldIncludeOccurrence(start.date, derivedEnd.date, windowStart, windowEnd)) {
    return []
  }

  return [buildCalendarEvent(rawEvent, start.date, derivedEnd.date, start.local, start.allDay)]
}

function dedupeAndSortEvents(events: UserCalendarPreviewEvent[]) {
  const eventMap = new Map<string, UserCalendarPreviewEvent>()

  for (const event of events) {
    eventMap.set(event.id, event)
  }

  return [...eventMap.values()].sort((left, right) => {
    const startDifference = left.start.localeCompare(right.start)

    if (startDifference !== 0) {
      return startDifference
    }

    return left.title.localeCompare(right.title)
  })
}

function parseCalendarText(source: string, options: ParseCalendarOptions = {}): ParsedCalendar {
  const lines = unfoldContentLines(source)
  const now = options.now ?? new Date()
  const windowStart = new Date(now.getTime() - dayInMilliseconds)
  const windowEnd = new Date(now.getTime() + (options.windowDays ?? 180) * dayInMilliseconds)
  const rawEvents: RawCalendarEvent[] = []
  let currentEvent: RawCalendarEvent | null = null
  let calendarName: string | null = null
  let calendarTimeZone: string | null = null

  for (const line of lines) {
    const contentLine = parseContentLine(line)

    if (!contentLine) {
      continue
    }

    if (contentLine.name === 'BEGIN' && contentLine.value === 'VEVENT') {
      currentEvent = createEmptyRawCalendarEvent()
      continue
    }

    if (contentLine.name === 'END' && contentLine.value === 'VEVENT') {
      if (currentEvent?.startProperty) {
        rawEvents.push(currentEvent)
      }

      currentEvent = null
      continue
    }

    if (!currentEvent) {
      if (!calendarName && (contentLine.name === 'X-WR-CALNAME' || contentLine.name === 'NAME')) {
        calendarName = unescapeText(contentLine.value)
      }

      if (!calendarTimeZone && contentLine.name === 'X-WR-TIMEZONE') {
        calendarTimeZone = normalizeTimeZoneId(contentLine.value)
      }

      continue
    }

    if (contentLine.name === 'UID') {
      currentEvent.uid = contentLine.value.trim()
    } else if (contentLine.name === 'SUMMARY') {
      currentEvent.summary = contentLine.value
    } else if (contentLine.name === 'DESCRIPTION') {
      currentEvent.description = contentLine.value
    } else if (contentLine.name === 'LOCATION') {
      currentEvent.location = contentLine.value
    } else if (contentLine.name === 'STATUS') {
      currentEvent.status = contentLine.value.trim()
    } else if (contentLine.name === 'DTSTART') {
      currentEvent.startProperty = contentLine
    } else if (contentLine.name === 'DTEND') {
      currentEvent.endProperty = contentLine
    } else if (contentLine.name === 'RRULE') {
      currentEvent.rrule = contentLine.value.trim()
    } else if (contentLine.name === 'EXDATE') {
      currentEvent.exdateProperties.push(contentLine)
    } else if (contentLine.name === 'RECURRENCE-ID') {
      currentEvent.recurrenceIdProperty = contentLine
    }
  }

  const overridesByUid = new Map<string, RawCalendarEvent[]>()
  const standaloneEvents: UserCalendarPreviewEvent[] = []

  for (const rawEvent of rawEvents) {
    if (rawEvent.recurrenceIdProperty && rawEvent.uid) {
      const overrides = overridesByUid.get(rawEvent.uid) ?? []
      overrides.push(rawEvent)
      overridesByUid.set(rawEvent.uid, overrides)
    }
  }

  const handledOverrideIds = new Set<RawCalendarEvent>()

  for (const rawEvent of rawEvents) {
    if (rawEvent.recurrenceIdProperty) {
      continue
    }

    if (rawEvent.rrule) {
      const overrides = rawEvent.uid ? overridesByUid.get(rawEvent.uid) ?? [] : []

      for (const overrideEvent of overrides) {
        handledOverrideIds.add(overrideEvent)
      }

      standaloneEvents.push(
        ...expandRecurringEvent(rawEvent, overrides, calendarTimeZone, windowStart, windowEnd)
      )
      continue
    }

    standaloneEvents.push(
      ...buildSingleEventsFromRawEvent(rawEvent, calendarTimeZone, windowStart, windowEnd)
    )
  }

  for (const rawEvent of rawEvents) {
    if (rawEvent.recurrenceIdProperty && !handledOverrideIds.has(rawEvent)) {
      standaloneEvents.push(
        ...buildSingleEventsFromRawEvent(rawEvent, calendarTimeZone, windowStart, windowEnd)
      )
    }
  }

  return {
    calendarName,
    events: dedupeAndSortEvents(standaloneEvents)
  }
}

async function fetchCalendarText(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1'
    }
  })

  if (!response.ok) {
    throw new Error(`The calendar feed returned HTTP ${response.status}`)
  }

  const text = await response.text()

  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error('The provided link does not look like a valid iCal feed')
  }

  return text
}

export function normalizeIcalUrl(rawUrl: string) {
  const trimmedUrl = rawUrl.trim()

  if (!trimmedUrl) {
    throw new Error('The iCal link is required')
  }

  const normalizedProtocolUrl = trimmedUrl.startsWith('webcal://')
    ? `https://${trimmedUrl.slice('webcal://'.length)}`
    : trimmedUrl
  const parsedUrl = new URL(normalizedProtocolUrl)

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('The iCal link must use http, https or webcal')
  }

  return parsedUrl.toString()
}

export async function loadCalendarFromIcalUrl(
  icalUrl: string,
  options: ParseCalendarOptions = {}
) {
  const normalizedUrl = normalizeIcalUrl(icalUrl)
  const calendarText = await fetchCalendarText(normalizedUrl)
  const parsedCalendar = parseCalendarText(calendarText, options)

  return {
    normalizedUrl,
    calendarName: parsedCalendar.calendarName,
    events: parsedCalendar.events
  }
}
