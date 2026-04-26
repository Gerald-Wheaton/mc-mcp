import { describe, expect, test } from 'bun:test'
import { loadConfig } from '../src/config.ts'
import { McClient } from '../src/mc-client.ts'

const runLive = process.env.MC_LIVE_TESTS === 'true'
const basicAuth = process.env.MC_BASIC_AUTH_ENCODED

const live = runLive && basicAuth ? test : test.skip

describe('live MC smoke tests', () => {
  live('connects to core endpoints with real credentials', async () => {
    const config = loadConfig()
    const client = new McClient({
      baseUrl: config.mcBaseUrl,
      basicAuth: basicAuth as string,
      timeoutMs: 30_000,
    })

    const [workOrders, assets, parts, purchaseOrders] = await Promise.all([
      client.get<{ Total: number; Results: unknown[] }>('/workorders', { params: { $top: 1 } }),
      client.get<{ Total: number; Results: unknown[] }>('/Assets', { params: { $top: 1 } }),
      client.get<{ Total: number; Results: unknown[] }>('/Parts', { params: { $top: 1 } }),
      client.get<{ Total: number; Results: unknown[] }>('/purchaseorders', { params: { $top: 1 } }),
    ])

    expect(workOrders.Total).toBeGreaterThanOrEqual(0)
    expect(assets.Total).toBeGreaterThanOrEqual(0)
    expect(parts.Total).toBeGreaterThanOrEqual(0)
    expect(purchaseOrders.Total).toBeGreaterThanOrEqual(0)
  })

  live('reads slower context endpoints directly through the MC client', async () => {
    const config = loadConfig()
    const client = new McClient({
      baseUrl: config.mcBaseUrl,
      basicAuth: basicAuth as string,
      timeoutMs: 30_000,
    })

    const [labors, lookupTables] = await Promise.all([
      client.getAllPages<{ Total: number; Results: unknown[] }>('/Labors', {
        params: { $top: 5, $orderby: 'Name asc' },
      }),
      client.getAllPages<{ Total: number; Results: unknown[] }>('/LookupTables', {
        params: { $top: 5, $orderby: 'LookupTableID asc' },
      }),
    ])

    expect(Array.isArray(labors.Results)).toBe(true)
    expect(Array.isArray(lookupTables.Results)).toBe(true)
  })
})
