import { McApiError, McTimeoutError } from '../mc-client.js'

export interface ToolResult {
  [key: string]: unknown
  content: [{ type: 'text'; text: string }]
  isError?: true
}

export function toToolText(data: unknown): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  }
}

export function toToolError(err: unknown): ToolResult {
  let message: string
  if (err instanceof McTimeoutError) {
    message = `${err.message} — try narrowing your filter or reducing $top`
  } else if (err instanceof McApiError && err.status === 401) {
    message = `MC credentials rejected — verify your X-MC-Basic-Auth header is correctly base64-encoded (CONNECTION_KEY:API_KEY)`
  } else if (err instanceof McApiError) {
    message = `MC API error ${err.status}: ${err.body || err.message}`
  } else if (err instanceof Error) {
    message = err.message
  } else {
    message = String(err)
  }

  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  }
}
