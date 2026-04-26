import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { McApiError, McClient, McTimeoutError } from '../src/mc-client.ts'

describe('McClient', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = originalFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('returns parsed JSON for successful GET requests', async () => {
    let requestedUrl = ''
    let authHeader = ''

    globalThis.fetch = (async (input, init) => {
      requestedUrl = String(input)
      authHeader = (init?.headers as Record<string, string>).Authorization
      return new Response(JSON.stringify({ Results: [], Total: 0 }), { status: 200 })
    }) as typeof fetch

    const client = new McClient({
      baseUrl: 'https://example.mc.test/v8',
      basicAuth: 'encoded-creds',
    })

    await expect(client.get('/workorders', { params: { $top: 1, $filter: 'IsOpen eq true' } })).resolves.toEqual({
      Results: [],
      Total: 0,
    })

    expect(requestedUrl).toBe('https://example.mc.test/v8/workorders?%24top=1&%24filter=IsOpen+eq+true')
    expect(authHeader).toBe('Basic encoded-creds')
  })

  test('throws McApiError for non-success responses', async () => {
    globalThis.fetch = (async () =>
      new Response('denied', {
        status: 401,
      })) as typeof fetch

    const client = new McClient({
      baseUrl: 'https://example.mc.test/v8',
      basicAuth: 'encoded-creds',
    })

    await expect(client.get('/workorders')).rejects.toEqual(
      expect.objectContaining({
        status: 401,
        path: '/workorders',
        body: 'denied',
      }),
    )
  })

  test('turns aborted requests into McTimeoutError', async () => {
    globalThis.fetch = ((_, init) =>
      new Promise((_, reject) => {
        const signal = init?.signal as AbortSignal | undefined
        signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })) as typeof fetch

    const client = new McClient({
      baseUrl: 'https://example.mc.test/v8',
      basicAuth: 'encoded-creds',
      timeoutMs: 5,
    })

    await expect(client.get('/Assets')).rejects.toBeInstanceOf(McTimeoutError)
  })

  test('pages through large collection responses', async () => {
    const requestedUrls: string[] = []

    globalThis.fetch = (async (input) => {
      const url = new URL(String(input))
      requestedUrls.push(url.toString())

      const top = Number(url.searchParams.get('$top'))
      const skip = Number(url.searchParams.get('$skip'))
      const total = 520
      const start = skip
      const end = Math.min(skip + top, total)
      const Results = Array.from({ length: end - start }, (_, index) => ({
        PK: start + index + 1,
      }))

      return new Response(JSON.stringify({ Results, Total: total }), { status: 200 })
    }) as typeof fetch

    const client = new McClient({
      baseUrl: 'https://example.mc.test/v8',
      basicAuth: 'encoded-creds',
    })

    const response = await client.getAllPages<{ PK: number }>('/Assets', {
      params: { $top: 520, $orderby: 'Name asc' },
    })

    expect(response.Total).toBe(520)
    expect(response.Results).toHaveLength(520)
    expect(response.Results.at(0)?.PK).toBe(1)
    expect(response.Results.at(-1)?.PK).toBe(520)
    expect(requestedUrls).toEqual([
      'https://example.mc.test/v8/Assets?%24top=500&%24orderby=Name+asc&%24skip=0',
      'https://example.mc.test/v8/Assets?%24top=20&%24orderby=Name+asc&%24skip=500',
    ])
  })

  test('reuses cached and in-flight values', async () => {
    const client = new McClient({
      baseUrl: 'https://example.mc.test/v8',
      basicAuth: 'encoded-creds',
    })

    let calls = 0
    const loader = async () => {
      calls += 1
      await Bun.sleep(10)
      return { call: calls }
    }

    const [first, second] = await Promise.all([
      client.getCached('context:summary', 1_000, loader),
      client.getCached('context:summary', 1_000, loader),
    ])
    const third = await client.getCached('context:summary', 1_000, loader)

    expect(first).toEqual({ call: 1 })
    expect(second).toEqual({ call: 1 })
    expect(third).toEqual({ call: 1 })
    expect(calls).toBe(1)
  })

  test('surfaces concrete McApiError metadata', () => {
    const error = new McApiError(500, '/Parts', 'broken')

    expect(error.message).toContain('MC API error 500 on /Parts')
  })
})
