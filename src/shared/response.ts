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

export function toListToolText(
  data: { Results: unknown[]; Total: number },
  skip: number,
  opts?: { fetchedAll?: boolean; cappedAt?: number },
): ToolResult {
  const returned = data.Results.length
  const nextSkip = skip + returned

  const pagination: {
    total: number
    returned: number
    nextSkip?: number
    fetchedAll?: boolean
    cappedAt?: number
  } = {
    total: data.Total,
    returned,
  }

  if (opts?.fetchedAll) {
    pagination.fetchedAll = true
    if (opts.cappedAt !== undefined && data.Results.length >= opts.cappedAt) {
      pagination.cappedAt = opts.cappedAt
    }
  } else if (nextSkip < data.Total) {
    pagination.nextSkip = nextSkip
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ Results: data.Results, Total: data.Total, _pagination: pagination }, null, 2),
      },
    ],
  }
}

export function toToolError(err: unknown): ToolResult {
  if (!(err instanceof McApiError && err.status < 500)) {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.error(`[tool] error: ${detail}`)
  }

  let message: string
  if (err instanceof McTimeoutError) {
    message = `${err.message} — try narrowing the request or asking for fewer records`
  } else if (err instanceof McApiError && err.status === 401) {
    message =
      'MC credentials rejected — verify the Maintenance Connection connection key and API key configured for this session'
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
