import type { McConfig } from './config.js'

export interface McRequestOptions {
  params?: Record<string, string | number | undefined>
}

export class McClient {
  private baseUrl: string
  private basicAuth: string

  constructor(config: McConfig) {
    this.baseUrl = config.baseUrl
    this.basicAuth = config.basicAuth
  }

  async get<T>(path: string, options: McRequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const response = await fetch(url.toString(), {
      headers: this.buildHeaders(),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new McApiError(response.status, path, body)
    }

    return response.json() as Promise<T>
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Basic ${this.basicAuth}`,
      Accept: 'application/json',
    }
  }
}

export class McApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: string,
  ) {
    super(`MC API error ${status} on ${path}: ${body}`)
  }
}
