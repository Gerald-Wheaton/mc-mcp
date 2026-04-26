import { describe, expect, test } from 'bun:test'
import { McApiError, McTimeoutError } from '../src/mc-client.ts'
import { toToolError } from '../src/shared/response.ts'

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
