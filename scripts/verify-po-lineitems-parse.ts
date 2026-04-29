// fallow-ignore-file unused-file
/**
 * Verify PurchaseOrderLineItemSummarySchema parse() against live data
 * Run: bun --env-file=.env run scripts/verify-po-lineitems-parse.ts
 */

import { loadConfig } from '../src/config.js'
import { McClient } from '../src/mc-client.js'
import { PurchaseOrderLineItemSummarySchema, McApiResponseSchema } from '../src/shared/types.js'

const client = new McClient(loadConfig())
const ListSchema = McApiResponseSchema(PurchaseOrderLineItemSummarySchema)

async function get(path: string, params: Record<string, string | number> = {}) {
  return client.get<any>(path, { params })
}

// All 159 line items
const raw = await get('/PurchaseOrderLineItems', { $top: 200 })
const all = ListSchema.safeParse(raw)
console.log(`All line items (${raw.Total} total): ${all.success ? '✓ OK' : '✗ FAILED'}`)
if (!all.success) console.log(all.error.format())

// Filter by PurchaseOrderPK
const rawFiltered = await get('/PurchaseOrderLineItems', { $filter: 'PurchaseOrderPK eq 1000' })
const filtered = ListSchema.safeParse(rawFiltered)
console.log(`Filter PurchaseOrderPK=1000 (${rawFiltered.Total} lines): ${filtered.success ? '✓ OK' : '✗ FAILED'}`)
if (!filtered.success) console.log(filtered.error.format())
