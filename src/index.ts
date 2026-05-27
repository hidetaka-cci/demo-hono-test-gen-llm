import { Hono } from 'hono'
import { DateTime } from 'luxon'

function countBusinessDays(start: DateTime, end: DateTime): { businessDays: number; totalDays: number } {
  const startDay = start.startOf('day')
  const endDay = end.startOf('day')
  let businessDays = 0
  let totalDays = 0

  for (let day = startDay; day <= endDay; day = day.plus({ days: 1 })) {
    totalDays++
    if (day.weekday >= 1 && day.weekday <= 5) {
      businessDays++
    }
  }

  return { businessDays, totalDays }
}

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/now', (c) => {
  return c.json({ now: new Date().toISOString() })
})

app.get('/today', (c) => {
  const nowUtc = DateTime.now().toUTC()
  const startOfToday = nowUtc.startOf('day')
  const startOfNextYear = DateTime.utc(nowUtc.year + 1, 1, 1)
  const daysUntilNextYear = Math.floor(startOfNextYear.diff(startOfToday, 'days').days)
  const daysRemainingInYear = Math.max(0, daysUntilNextYear - 1)

  return c.json({
    date: startOfToday.toISODate(),
    daysRemainingInYear,
  })
})

app.post('/convert-timezone/:tz', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const tz = c.req.param('tz')
  const datetime =
    typeof body === 'object' && body !== null && 'datetime' in body
      ? (body as { datetime?: unknown }).datetime
      : undefined

  if (typeof datetime !== 'string') {
    return c.json({ error: '`datetime` must be an ISO string' }, 400)
  }

  const parsed = DateTime.fromISO(datetime, { setZone: true })
  if (!parsed.isValid) {
    return c.json({ error: 'Invalid datetime' }, 400)
  }

  const converted = parsed.setZone(tz)
  if (!converted.isValid) {
    return c.json({ error: 'Invalid timezone' }, 400)
  }

  return c.json({
    input: datetime,
    timezone: tz,
    converted: converted.toISO(),
  })
})

app.post('/business-days', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (typeof body !== 'object' || body === null) {
    return c.json({ error: 'Request body must be a JSON object' }, 400)
  }

  const start =
    'start' in body ? (body as { start?: unknown }).start : undefined
  const end = 'end' in body ? (body as { end?: unknown }).end : undefined

  if (start === undefined) {
    return c.json({ error: '`start` is required' }, 400)
  }
  if (end === undefined) {
    return c.json({ error: '`end` is required' }, 400)
  }
  if (typeof start !== 'string') {
    return c.json({ error: '`start` must be an ISO string' }, 400)
  }
  if (typeof end !== 'string') {
    return c.json({ error: '`end` must be an ISO string' }, 400)
  }
  if (start.trim() === '' || end.trim() === '') {
    return c.json({ error: '`start` and `end` cannot be empty' }, 400)
  }

  const startDt = DateTime.fromISO(start)
  const endDt = DateTime.fromISO(end)
  if (!startDt.isValid) {
    return c.json({ error: 'Invalid start date' }, 400)
  }
  if (!endDt.isValid) {
    return c.json({ error: 'Invalid end date' }, 400)
  }

  if (endDt < startDt) {
    return c.json({ error: '`end` must be on or after `start`' }, 400)
  }

  const spanDays = Math.floor(endDt.diff(startDt, 'days').days)
  if (spanDays > 366) {
    return c.json({ error: 'Date range cannot exceed 366 days' }, 400)
  }
  if (startDt.year < 1900 || endDt.year > 2100) {
    return c.json({ error: 'Dates must be between years 1900 and 2100' }, 400)
  }

  const { businessDays, totalDays } = countBusinessDays(startDt, endDt)

  return c.json({
    start: startDt.toISODate(),
    end: endDt.toISODate(),
    businessDays,
    totalDays,
  })
})

app.post('/offset-datetime', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (typeof body !== 'object' || body === null) {
    return c.json({ error: 'Request body must be a JSON object' }, 400)
  }

  const datetime =
    'datetime' in body ? (body as { datetime?: unknown }).datetime : undefined
  const offset = 'offset' in body ? (body as { offset?: unknown }).offset : undefined

  if (datetime === undefined) {
    return c.json({ error: '`datetime` is required' }, 400)
  }
  if (typeof datetime !== 'string') {
    return c.json({ error: '`datetime` must be an ISO string' }, 400)
  }
  if (datetime.trim() === '') {
    return c.json({ error: '`datetime` cannot be empty' }, 400)
  }

  if (offset === undefined) {
    return c.json({ error: '`offset` is required' }, 400)
  }
  if (typeof offset !== 'object' || offset === null || Array.isArray(offset)) {
    return c.json({ error: '`offset` must be an object' }, 400)
  }

  const offsetObj = offset as { days?: unknown; hours?: unknown; minutes?: unknown }
  const days = offsetObj.days
  const hours = offsetObj.hours
  const minutes = offsetObj.minutes

  const hasNumericOffset =
    typeof days === 'number' || typeof hours === 'number' || typeof minutes === 'number'
  if (!hasNumericOffset) {
    return c.json({ error: '`offset` must include at least one numeric field' }, 400)
  }

  if (days !== undefined && typeof days !== 'number') {
    return c.json({ error: '`offset.days` must be a number' }, 400)
  }
  if (hours !== undefined && typeof hours !== 'number') {
    return c.json({ error: '`offset.hours` must be a number' }, 400)
  }
  if (minutes !== undefined && typeof minutes !== 'number') {
    return c.json({ error: '`offset.minutes` must be a number' }, 400)
  }
  if (typeof days === 'number' && !Number.isFinite(days)) {
    return c.json({ error: '`offset.days` must be a finite number' }, 400)
  }
  if (typeof hours === 'number' && !Number.isFinite(hours)) {
    return c.json({ error: '`offset.hours` must be a finite number' }, 400)
  }
  if (typeof minutes === 'number' && !Number.isFinite(minutes)) {
    return c.json({ error: '`offset.minutes` must be a finite number' }, 400)
  }

  const parsed = DateTime.fromISO(datetime, { setZone: true })
  if (!parsed.isValid) {
    return c.json({ error: 'Invalid datetime' }, 400)
  }

  const totalMinutes =
    (typeof days === 'number' ? Math.abs(days) * 24 * 60 : 0) +
    (typeof hours === 'number' ? Math.abs(hours) * 60 : 0) +
    (typeof minutes === 'number' ? Math.abs(minutes) : 0)
  if (totalMinutes > 366 * 24 * 60) {
    return c.json({ error: 'Offset magnitude cannot exceed 366 days' }, 400)
  }
  if (
    (typeof days === 'number' ? days : 0) === 0 &&
    (typeof hours === 'number' ? hours : 0) === 0 &&
    (typeof minutes === 'number' ? minutes : 0) === 0
  ) {
    return c.json({ error: 'Offset must change the datetime' }, 400)
  }

  const result = parsed.plus({
    days: typeof days === 'number' ? days : 0,
    hours: typeof hours === 'number' ? hours : 0,
    minutes: typeof minutes === 'number' ? minutes : 0,
  })

  return c.json({
    input: datetime,
    offset: {
      ...(typeof days === 'number' ? { days } : {}),
      ...(typeof hours === 'number' ? { hours } : {}),
      ...(typeof minutes === 'number' ? { minutes } : {}),
    },
    result: result.toUTC().toISO(),
  })
})

export default app
