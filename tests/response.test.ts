// fallow-ignore-file unused-file
import { describe, expect, test } from 'bun:test'
import { McApiError, McTimeoutError } from '../src/mc-client.ts'
import { toToolError, toListToolText } from '../src/shared/response.ts'

describe('toListToolText', () => {
  test('includes nextSkip when more pages remain', () => {
    const data = { Results: [{ id: 1 }, { id: 2 }], Total: 10 }
    const result = toListToolText(data, 0)
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed._pagination).toEqual({ total: 10, returned: 2, nextSkip: 2 })
  })

  test('omits nextSkip on the last page', () => {
    const data = { Results: [{ id: 9 }, { id: 10 }], Total: 10 }
    const result = toListToolText(data, 8)
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed._pagination).toEqual({ total: 10, returned: 2 })
    expect(parsed._pagination.nextSkip).toBeUndefined()
  })

  test('omits nextSkip when exactly all records fit in one page', () => {
    const data = { Results: [{ id: 1 }], Total: 1 }
    const result = toListToolText(data, 0)
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed._pagination).toEqual({ total: 1, returned: 1 })
    expect(parsed._pagination.nextSkip).toBeUndefined()
  })

  test('sets fetchedAll and cappedAt when result count equals the cap', () => {
    const results = Array.from({ length: 2000 }, (_, i) => ({ id: i }))
    const data = { Results: results, Total: 33639 }
    const result = toListToolText(data, 0, { fetchedAll: true, cappedAt: 2000 })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed._pagination.fetchedAll).toBe(true)
    expect(parsed._pagination.cappedAt).toBe(2000)
    expect(parsed._pagination.nextSkip).toBeUndefined()
  })

  test('sets fetchedAll without cappedAt when results are below the cap', () => {
    const data = { Results: [{ id: 1 }], Total: 1 }
    const result = toListToolText(data, 0, { fetchedAll: true, cappedAt: 2000 })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed._pagination.fetchedAll).toBe(true)
    expect(parsed._pagination.cappedAt).toBeUndefined()
  })

  test('passes through Results and Total at the top level', () => {
    const data = { Results: [{ id: 1 }], Total: 5 }
    const result = toListToolText(data, 0)
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.Results).toEqual([{ id: 1 }])
    expect(parsed.Total).toBe(5)
  })
})

describe('toToolError', () => {
  test('formats timeout errors with remediation guidance', () => {
    expect(toToolError(new McTimeoutError('/Assets', 30_000))).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error: MC API request timed out after 30000ms on /Assets — try narrowing your filter or reducing $top',
        },
      ],
      isError: true,
    })
  })

  test('formats 401 responses with credential guidance', () => {
    expect(toToolError(new McApiError(401, '/workorders', 'Unauthorized'))).toEqual({
      content: [
        {
          type: 'text',
          text: 'Error: MC credentials rejected — verify your X-MC-Basic-Auth header is correctly base64-encoded (CONNECTION_KEY:API_KEY)',
        },
      ],
      isError: true,
    })
  })

  test('formats generic errors', () => {
    expect(toToolError(new Error('boom'))).toEqual({
      content: [{ type: 'text', text: 'Error: boom' }],
      isError: true,
    })
  })
})
