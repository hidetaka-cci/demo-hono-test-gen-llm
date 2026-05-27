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
})

