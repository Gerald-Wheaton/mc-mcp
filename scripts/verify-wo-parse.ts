// fallow-ignore-file unused-file
/**
 * Verify WorkOrderSummarySchema parse() against a live sample of all types
 * Run: bun --env-file=.env run scripts/verify-wo-parse.ts
 */

import { loadConfig } from '../src/config.js'
import { McClient } from '../src/mc-client.js'
import { WorkOrderSummarySchema, McApiResponseSchema } from '../src/shared/types.js'

const client = new McClient(loadConfig())
const ListSchema = McApiResponseSchema(WorkOrderSummarySchema)

async function get(path: string, params: Record<string, string | number> = {}) {
  return client.get<any>(path, { params })
}

let passed = 0
let failed = 0

for (const type of ['CM', 'IN', 'PM', 'SR', 'CAP', 'ADMN', 'FO', 'PC']) {
  const raw = await get('/workorders', { $filter: `Type eq "${type}"`, $top: 5 })
  if (raw.Total === 0) { console.log(`  ${type}: no records, skipping`); continue }
  const result = ListSchema.safeParse(raw)
  if (result.success) {
    console.log(`  ${type}: ✓ parse OK (${result.data.Results.length} records)`)
    passed++
  } else {
    console.log(`  ${type}: ✗ FAILED`)
    console.log(result.error.format())
    failed++
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
