import { Hono } from 'hono'
import { DateTime } from 'luxon'

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

export default app
