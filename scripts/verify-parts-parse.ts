// fallow-ignore-file unused-file
/**
 * Verify PartSummarySchema parse() against a live sample
 * Run: bun --env-file=.env run scripts/verify-parts-parse.ts
 */

import { loadConfig } from '../src/config.js'
import { McClient } from '../src/mc-client.js'
import { PartSummarySchema, McApiResponseSchema } from '../src/shared/types.js'

const client = new McClient(loadConfig())
const ListSchema = McApiResponseSchema(PartSummarySchema)

async function get(path: string, params: Record<string, string | number> = {}) {
  return client.get<any>(path, { params })
}

// Test list endpoint with 50 records
const raw = await get('/Parts', { $top: 50 })
const list = ListSchema.safeParse(raw)
console.log(`List parse (50 records): ${list.success ? '✓ OK' : '✗ FAILED'}`)
if (!list.success) console.log(list.error.format())

// Test single record fetch
const pk = raw.Results[0]?.PK
const rawSingle = await get(`/Parts/${pk}`)
const single = ListSchema.safeParse(rawSingle)
console.log(`Single record parse (PK=${pk}): ${single.success ? '✓ OK' : '✗ FAILED'}`)
if (!single.success) console.log(single.error.format())

// Test with Active eq false (edge case)
const rawInactive = await get('/Parts', { $filter: 'Active eq false', $top: 5 })
const inactive = ListSchema.safeParse(rawInactive)
console.log(`Inactive parts parse (${rawInactive.Total} total, fetched ${rawInactive.Results.length}): ${inactive.success ? '✓ OK' : '✗ FAILED'}`)
if (!inactive.success) console.log(inactive.error.format())
