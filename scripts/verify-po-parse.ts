/**
 * Verify PurchaseOrderSummarySchema parse() against live samples
 * Run: bun --env-file=.env run scripts/verify-po-parse.ts
 */

import { loadConfig } from '../src/config.js'
import { McClient } from '../src/mc-client.js'
import { PurchaseOrderSummarySchema, McApiResponseSchema } from '../src/shared/types.js'

const client = new McClient(loadConfig())
const ListSchema = McApiResponseSchema(PurchaseOrderSummarySchema)

async function get(path: string, params: Record<string, string | number> = {}) {
  return client.get<any>(path, { params })
}

// All 74 POs
const raw = await get('/purchaseorders', { $top: 100 })
const all = ListSchema.safeParse(raw)
console.log(`All POs (${raw.Total} records): ${all.success ? '✓ OK' : '✗ FAILED'}`)
if (!all.success) console.log(all.error.format())

// Single record
const pk = raw.Results[0]?.PK
const rawSingle = await get(`/purchaseorders/${pk}`)
const single = ListSchema.safeParse(rawSingle)
console.log(`Single PO (PK=${pk}): ${single.success ? '✓ OK' : '✗ FAILED'}`)
if (!single.success) console.log(single.error.format())

// ISSUED filter
const rawIssued = await get('/purchaseorders', { $filter: 'Status eq "ISSUED"', $top: 10 })
const issued = ListSchema.safeParse(rawIssued)
console.log(`Status=ISSUED filter (${rawIssued.Total} total): ${issued.success ? '✓ OK' : '✗ FAILED'}`)
if (!issued.success) console.log(issued.error.format())
