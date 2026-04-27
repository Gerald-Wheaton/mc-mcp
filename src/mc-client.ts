const MAX_PAGE_SIZE = 500

type McRequestParamValue = string | number | undefined

export interface McRequestOptions {
  params?: Record<string, McRequestParamValue>
}

export interface McCollectionResponse<T> {
  Results: T[]
  Total: number
}

interface CacheEntry {
  value?: unknown
  expiresAt: number
  inFlight?: Promise<unknown>
}

interface McClientConfig {
  baseUrl: string
  basicAuth: string
  timeoutMs?: number   // default 30000
  maxRetries?: number  // default 2
  retryDelayMs?: number // default 300
}

export class McClient {
  private baseUrl: string
  private basicAuth: string
  private timeoutMs: number
  private maxRetries: number
  private retryDelayMs: number
  private cache = new Map<string, CacheEntry>()

  constructor(config: McClientConfig) {
    this.baseUrl = config.baseUrl
    this.basicAuth = config.basicAuth
    this.timeoutMs = config.timeoutMs ?? 30_000
    this.maxRetries = config.maxRetries ?? 2
    this.retryDelayMs = config.retryDelayMs ?? 300
  }

  private async fetchOnce<T>(url: URL, path: string): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    const start = Date.now()

    try {
      const response = await fetch(url.toString(), {
        headers: this.buildHeaders(),
        signal: controller.signal,
      })
      console.log(`[mc] GET ${path} → ${response.status} in ${Date.now() - start}ms`)
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new McApiError(response.status, path, body)
      }
      return response.json() as Promise<T>
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.error(`[mc] GET ${path} → TIMEOUT after ${this.timeoutMs}ms`)
        throw new McTimeoutError(path, this.timeoutMs)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  async get<T>(path: string, options: McRequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options)
    let lastError: unknown

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelayMs * 2 ** (attempt - 1)
        console.warn(`[mc] GET ${path} → retry ${attempt}/${this.maxRetries} after ${delay}ms`)
        await new Promise((r) => setTimeout(r, delay))
      }
      try {
        return await this.fetchOnce<T>(url, path)
      } catch (err) {
        lastError = err
        if (err instanceof McTimeoutError) throw err
        if (err instanceof McApiError && err.status < 500) throw err
        if (attempt < this.maxRetries) continue
      }
    }

    throw lastError
  }

  async getCached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const now = Date.now()
    const entry = this.cache.get(key)

    if (entry?.inFlight) {
      console.log(`[mc] CACHE join ${key}`)
      return entry.inFlight as Promise<T>
    }

    if (entry && entry.expiresAt > now) {
      console.log(`[mc] CACHE hit ${key} (${Math.round((entry.expiresAt - now) / 1000)}s remaining)`)
      return entry.value as T
    }

    if (entry) {
      this.cache.delete(key)
    }

    console.log(`[mc] CACHE miss ${key} — fetching`)
    const inFlight = loader()
      .then((value) => {
        this.cache.set(key, {
          value,
          expiresAt: Date.now() + Math.max(0, ttlMs),
        })
        console.log(`[mc] CACHE stored ${key} (ttl ${Math.round(Math.max(0, ttlMs) / 1000)}s)`)
        return value
      })
      .catch((error) => {
        this.cache.delete(key)
        throw error
      })

    this.cache.set(key, {
      expiresAt: now,
      inFlight,
    })

    return inFlight
  }

  async getAllPages<T>(
    path: string,
    options: McRequestOptions = {},
  ): Promise<McCollectionResponse<T>> {
    const startingSkip = this.readNumericParam(options.params?.$skip) ?? 0
    const requestedTop = this.readNumericParam(options.params?.$top)
    const results: T[] = []
    let total = 0
    let skip = startingSkip

    while (true) {
      const remaining = requestedTop === undefined ? MAX_PAGE_SIZE : requestedTop - results.length

      if (remaining <= 0) {
        break
      }

      const pageSize = Math.min(MAX_PAGE_SIZE, remaining)
      const page = await this.get<McCollectionResponse<T>>(path, {
        ...options,
        params: {
          ...options.params,
          $top: pageSize,
          $skip: skip,
        },
      })

      total = page.Total
      results.push(...page.Results)
      skip += page.Results.length

      if (
        page.Results.length === 0 ||
        page.Results.length < pageSize ||
        skip >= page.Total ||
        (requestedTop !== undefined && results.length >= requestedTop)
      ) {
        break
      }
    }

    return {
      Results: results,
      Total: total,
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Basic ${this.basicAuth}`,
      Accept: 'application/json',
    }
  }

  private buildUrl(path: string, options: McRequestOptions): URL {
    const url = new URL(`${this.baseUrl}${path}`)

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    return url
  }

  private readNumericParam(value: McRequestParamValue): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }

    return undefined
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

export class McTimeoutError extends Error {
  constructor(
    public readonly path: string,
    public readonly timeoutMs: number,
  ) {
    super(`MC API request timed out after ${timeoutMs}ms on ${path}`)
  }
}
