import { afterEach, describe, expect, test } from 'bun:test'
import { loadConfig } from '../src/config.ts'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('loadConfig', () => {
  test('returns defaults when env vars are absent', () => {
    delete process.env.PORT
    delete process.env.MC_BASE_URL

    expect(loadConfig()).toEqual({
      port: 3000,
      mcBaseUrl: 'https://api.maintenanceconnection.com/v8',
    })
  })

  test('normalizes configured values', () => {
    process.env.PORT = '4312'
    process.env.MC_BASE_URL = 'https://example.mc.test/v8/'

    expect(loadConfig()).toEqual({
      port: 4312,
      mcBaseUrl: 'https://example.mc.test/v8',
    })
  })
})
