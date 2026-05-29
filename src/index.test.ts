import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import app from './index'

describe('API', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('GET /now returns current time as ISO string', async () => {
    vi.setSystemTime(new Date('2026-05-27T12:34:56.789Z'))

    const res = await app.request('http://localhost/now')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type') ?? '').toContain('application/json')

    const body = await res.json()
    expect(body).toEqual({ now: '2026-05-27T12:34:56.789Z' })
  })

  it('GET /today returns today and remaining days in year', async () => {
    // 2026 is not a leap year. Day-of-year for May 27 is 147 => remaining days after today: 365-147 = 218
    vi.setSystemTime(new Date('2026-05-27T00:00:00.000Z'))

    const res = await app.request('http://localhost/today')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type') ?? '').toContain('application/json')

    const body = await res.json()
    expect(body).toEqual({ date: '2026-05-27', daysRemainingInYear: 218 })
  })

  it('POST /convert-timezone/:tz converts datetime into requested timezone', async () => {
    const res = await app.request('http://localhost/convert-timezone/Asia%2FTokyo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ datetime: '2026-05-27T00:00:00.000Z' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type') ?? '').toContain('application/json')

    const body = await res.json()
    expect(body.timezone).toBe('Asia/Tokyo')
    expect(body.input).toBe('2026-05-27T00:00:00.000Z')
    expect(body.converted).toBe('2026-05-27T09:00:00.000+09:00')
  })

  it('POST /convert-timezone/:tz returns 400 for invalid input', async () => {
    const res = await app.request('http://localhost/convert-timezone/Asia%2FTokyo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ datetime: 'not-a-date' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('GET / returns Hello Hono!', async () => {
    const res = await app.request('http://localhost/')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type') ?? '').toContain('text/plain')
    expect(await res.text()).toBe('Hello Hono!')
  })

  it('POST /convert-timezone/:tz returns 400 for invalid JSON body', async () => {
    const res = await app.request('http://localhost/convert-timezone/Asia%2FTokyo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'Invalid JSON body' })
  })

  it('POST /convert-timezone/:tz returns 400 when datetime is missing', async () => {
    const res = await app.request('http://localhost/convert-timezone/Asia%2FTokyo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: '`datetime` must be an ISO string' })
  })

  it('POST /convert-timezone/:tz returns 400 when datetime is not a string', async () => {
    const res = await app.request('http://localhost/convert-timezone/Asia%2FTokyo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ datetime: 12345 }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: '`datetime` must be an ISO string' })
  })

  it('POST /offset-datetime applies day hour minute offset to ISO datetime', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datetime: '2026-05-27T00:00:00.000Z',
        offset: { days: 1, hours: 2, minutes: 30 },
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      input: '2026-05-27T00:00:00.000Z',
      offset: { days: 1, hours: 2, minutes: 30 },
      result: '2026-05-28T02:30:00.000Z',
    })
  })

  it('POST /business-days counts weekdays between two dates', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: '2026-05-01', end: '2026-05-27' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      start: '2026-05-01',
      end: '2026-05-27',
      businessDays: 19,
      totalDays: 27,
    })
  })

  it('POST /convert-timezone/:tz returns 400 for invalid timezone', async () => {
    const res = await app.request('http://localhost/convert-timezone/Not%2FA%2FTimezone', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ datetime: '2026-05-27T00:00:00.000Z' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'Invalid timezone' })
  })

  it('POST /business-days returns 400 for invalid JSON body', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' })
  })

  it('POST /business-days returns 400 when body is not an object', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(42),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Request body must be a JSON object' })
  })

  it('POST /business-days returns 400 when start is missing', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ end: '2026-05-27' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`start` is required' })
  })

  it('POST /business-days returns 400 when end is before start', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: '2026-05-27', end: '2026-05-01' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`end` must be on or after `start`' })
  })

  it('POST /business-days returns 400 when range exceeds 366 days', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: '2020-01-01', end: '2021-02-01' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Date range cannot exceed 366 days' })
  })

  it('POST /business-days returns 400 when span is 367 days', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: '2024-01-01', end: '2025-01-02' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Date range cannot exceed 366 days' })
  })

  it('POST /business-days accepts a range of exactly 366 span days', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: '2024-01-01', end: '2025-01-01' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      start: '2024-01-01',
      end: '2025-01-01',
      businessDays: 263,
      totalDays: 367,
    })
  })

  it('POST /business-days returns 400 for dates outside allowed years', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: '1850-01-01', end: '1850-01-31' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Dates must be between years 1900 and 2100',
    })
  })

  it('POST /offset-datetime returns 400 for invalid JSON body', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' })
  })

  it('POST /offset-datetime returns 400 when offset is missing', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ datetime: '2026-05-27T00:00:00.000Z' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`offset` is required' })
  })

  it('POST /offset-datetime returns 400 when offset has no numeric fields', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datetime: '2026-05-27T00:00:00.000Z',
        offset: {},
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: '`offset` must include at least one numeric field',
    })
  })

  it('POST /offset-datetime returns 400 when offset magnitude exceeds 366 days', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datetime: '2026-05-27T00:00:00.000Z',
        offset: { days: 400 },
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Offset magnitude cannot exceed 366 days',
    })
  })

  it('POST /offset-datetime returns 400 when offset span is 367 days', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datetime: '2026-05-27T00:00:00.000Z',
        offset: { days: 367 },
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Offset magnitude cannot exceed 366 days',
    })
  })

  it('POST /offset-datetime accepts an offset of exactly 366 days', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datetime: '2026-05-27T00:00:00.000Z',
        offset: { days: 366 },
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      input: '2026-05-27T00:00:00.000Z',
      offset: { days: 366 },
      result: '2027-05-28T00:00:00.000Z',
    })
  })

  it('POST /offset-datetime returns 400 when offset does not change datetime', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datetime: '2026-05-27T00:00:00.000Z',
        offset: { days: 0, hours: 0, minutes: 0 },
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Offset must change the datetime' })
  })

  it('POST /business-days returns 400 when end is missing', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: '2026-05-01' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`end` is required' })
  })

  it('POST /business-days returns 400 when start is not a string', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: 1, end: '2026-05-27' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`start` must be an ISO string' })
  })

  it('POST /business-days returns 400 when end is not a string', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: '2026-05-01', end: false }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`end` must be an ISO string' })
  })

  it('POST /business-days returns 400 when start or end is empty', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: '   ', end: '2026-05-27' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`start` and `end` cannot be empty' })
  })

  it('POST /business-days returns 400 when end is whitespace only', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: '2026-05-01', end: '   ' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`start` and `end` cannot be empty' })
  })

  it('POST /business-days returns 400 for invalid start date', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: 'not-a-date', end: '2026-05-27' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid start date' })
  })

  it('POST /business-days returns 400 for invalid end date', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: '2026-05-01', end: 'bad-end' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid end date' })
  })

  it('POST /offset-datetime returns 400 when body is not an object', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(null),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Request body must be a JSON object' })
  })

  it('POST /offset-datetime returns 400 when datetime is missing', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ offset: { days: 1 } }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`datetime` is required' })
  })

  it('POST /offset-datetime returns 400 when datetime is not a string', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ datetime: 123, offset: { days: 1 } }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`datetime` must be an ISO string' })
  })

  it('POST /offset-datetime returns 400 when datetime is empty', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ datetime: '   ', offset: { days: 1 } }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`datetime` cannot be empty' })
  })

  it('POST /offset-datetime returns 400 when offset is not an object', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datetime: '2026-05-27T00:00:00.000Z',
        offset: 'bad',
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`offset` must be an object' })
  })

  it('POST /offset-datetime returns 400 when offset field types are invalid', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datetime: '2026-05-27T00:00:00.000Z',
        offset: { days: '1', hours: 2 },
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`offset.days` must be a number' })
  })

  it('POST /offset-datetime returns 400 when offset values are not finite', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"datetime":"2026-05-27T00:00:00.000Z","offset":{"hours":1e309}}',
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`offset.hours` must be a finite number' })
  })

  it('POST /offset-datetime returns 400 for invalid datetime', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datetime: 'not-a-datetime',
        offset: { days: 1 },
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid datetime' })
  })

  it('POST /offset-datetime returns 400 when offset.hours is not a number', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datetime: '2026-05-27T00:00:00.000Z',
        offset: { days: 1, hours: '2' },
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`offset.hours` must be a number' })
  })

  it('POST /offset-datetime returns 400 when offset.minutes is not a number', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datetime: '2026-05-27T00:00:00.000Z',
        offset: { days: 1, minutes: '30' },
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`offset.minutes` must be a number' })
  })

  it('POST /offset-datetime returns 400 when offset.days is not finite', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"datetime":"2026-05-27T00:00:00.000Z","offset":{"days":1e309}}',
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`offset.days` must be a finite number' })
  })

  it('POST /offset-datetime returns 400 when offset.minutes is not finite', async () => {
    const res = await app.request('http://localhost/offset-datetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"datetime":"2026-05-27T00:00:00.000Z","offset":{"days":1,"minutes":1e309}}',
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '`offset.minutes` must be a finite number' })
  })

  it('POST /business-days returns 400 when end year is after 2100', async () => {
    const res = await app.request('http://localhost/business-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: '2100-01-01', end: '2101-01-01' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Dates must be between years 1900 and 2100',
    })
  })
})

