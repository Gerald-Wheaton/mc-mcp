// fallow-ignore-file unused-file
type Params = Record<string, unknown> | undefined

interface GetCall {
  path: string
  params?: Params
}

interface GetAllPagesCall {
  path: string
  params?: Params
}

type CachedLoader<T> = () => Promise<T>

// fallow-ignore-next-line unused-export
export class FakeMcClient {
  readonly getCalls: GetCall[] = []
  readonly getAllPagesCalls: GetAllPagesCall[] = []
  readonly getCachedCalls: Array<{ key: string; ttlMs: number }> = []

  private readonly getHandlers = new Map<string, unknown | ((params?: Params) => unknown | Promise<unknown>)>()
  private readonly getAllPagesHandlers = new Map<
    string,
    unknown | ((params?: Params) => unknown | Promise<unknown>)
  >()
  private readonly cache = new Map<string, { expiresAt: number; value: unknown }>()

  whenGet(path: string, value: unknown | ((params?: Params) => unknown | Promise<unknown>)) {
    this.getHandlers.set(path, value)
  }

  whenGetAllPages(path: string, value: unknown | ((params?: Params) => unknown | Promise<unknown>)) {
    this.getAllPagesHandlers.set(path, value)
  }

  async get<T>(path: string, options: { params?: Params } = {}): Promise<T> {
    this.getCalls.push({ path, params: options.params })
    const handler = this.getHandlers.get(path)
    if (handler === undefined) {
      throw new Error(`Unhandled fake get for ${path}`)
    }

    return resolveHandler<T>(handler, options.params)
  }

  async getAllPages<T>(path: string, options: { params?: Params } = {}): Promise<T> {
    this.getAllPagesCalls.push({ path, params: options.params })
    const handler = this.getAllPagesHandlers.get(path)
    if (handler === undefined) {
      throw new Error(`Unhandled fake getAllPages for ${path}`)
    }

    return resolveHandler<T>(handler, options.params)
  }

  async getCached<T>(key: string, ttlMs: number, loader: CachedLoader<T>): Promise<T> {
    this.getCachedCalls.push({ key, ttlMs })
    const now = Date.now()
    const cached = this.cache.get(key)

    if (cached && cached.expiresAt > now) {
      return cached.value as T
    }

    const value = await loader()
    this.cache.set(key, {
      value,
      expiresAt: now + ttlMs,
    })
    return value
  }
}

async function resolveHandler<T>(
  handler: unknown | ((params?: Params) => unknown | Promise<unknown>),
  params?: Params,
): Promise<T> {
  if (typeof handler === 'function') {
    return (await handler(params)) as T
  }

  return handler as T
}
