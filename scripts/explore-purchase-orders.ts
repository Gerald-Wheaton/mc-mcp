// fallow-ignore-file unused-file
/**
 * Phase 2.5 exploration script — Purchase Orders
 * Run: bun --env-file=.env run scripts/explore-purchase-orders.ts
 */

import { loadConfig } from '../src/config.js'
import { McClient } from '../src/mc-client.js'

const client = new McClient(loadConfig())
async function get(path: string, params: Record<string, string | number> = {}) {
  return client.get<any>(path, { params })
}

// ── 1. Total count ────────────────────────────────────────────────────────────
const meta = await get('/purchaseorders', { $top: 1 })
console.log(`\n=== TOTAL PURCHASE ORDERS: ${meta.Total} ===`)

// ── 2. All records — field survey + status/priority codes ─────────────────────
console.log('\nFetching all POs...')
const all: any[] = []
let skip = 0
while (true) {
  const res = await get('/purchaseorders', { $top: 100, $skip: skip })
  all.push(...res.Results)
  if (all.length >= res.Total) break
  skip += 100
}
console.log(`Fetched ${all.length} records`)

// All field keys
const allKeys = new Set<string>()
for (const po of all) Object.keys(po).forEach(k => allKeys.add(k))
console.log('\n=== ALL FIELD KEYS ===')
console.log([...allKeys].sort().join(', '))

// ── 3. Status codes ───────────────────────────────────────────────────────────
console.log('\n=== STATUS CODES ===')
const statuses = new Map<string, { count: number; desc: string }>()
for (const po of all) {
  const code = po.StatusDetails?.Value ?? '(null)'
  const desc = po.StatusDetails?.Description ?? ''
  const cur = statuses.get(code) ?? { count: 0, desc }
  statuses.set(code, { count: cur.count + 1, desc })
}
for (const [code, { count, desc }] of [...statuses.entries()].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  "${code}": ${count}  (${desc})`)
}

// ── 4. Priority codes ─────────────────────────────────────────────────────────
console.log('\n=== PRIORITY CODES ===')
const priorities = new Map<string, { count: number; desc: string }>()
for (const po of all) {
  const code = po.PriorityDetails?.Value ?? '(null)'
  const desc = po.PriorityDetails?.Description ?? ''
  const cur = priorities.get(code) ?? { count: 0, desc }
  priorities.set(code, { count: cur.count + 1, desc })
}
for (const [code, { count, desc }] of [...priorities.entries()].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  "${code}": ${count}  (${desc})`)
}

// ── 5. Boolean field population ───────────────────────────────────────────────
console.log('\n=== BOOLEAN FIELD POPULATION (all records) ===')
const boolFields = ['IsOpen', 'IsApproved', 'IsPartsOrdered']
for (const field of boolFields) {
  const t = all.filter(po => po[field] === true).length
  const f = all.filter(po => po[field] === false).length
  const n = all.filter(po => po[field] == null).length
  console.log(`  ${field}: true=${t}, false=${f}, null=${n}`)
}

// ── 6. Single PO by PK — full field set ──────────────────────────────────────
const firstPk: number = all[0]?.PK
console.log(`\n=== SINGLE RECORD (PK=${firstPk}) ===`)
const single = await get(`/purchaseorders/${firstPk}`)
console.log(JSON.stringify(single, null, 2))

// A second one for variation
const secondPk: number = all[10]?.PK
console.log(`\n=== SINGLE RECORD #2 (PK=${secondPk}) ===`)
const single2 = await get(`/purchaseorders/${secondPk}`)
console.log(JSON.stringify(single2, null, 2))

// ── 7. Line items — does the endpoint exist? ──────────────────────────────────
console.log(`\n=== LINE ITEMS ENDPOINT TEST (PO PK=${firstPk}) ===`)
try {
  const lineItems = await get(`/purchaseorders/${firstPk}/lineitems`)
  console.log(`Status: OK — Total=${lineItems.Total}`)
  if (lineItems.Results?.length) {
    console.log('Line item keys:', Object.keys(lineItems.Results[0]).sort().join(', '))
    console.log('Sample:', JSON.stringify(lineItems.Results[0], null, 2))
  }
} catch (err: any) {
  console.log(`Error: ${err.message}`)
}

// Also try the PurchaseOrderLineItems root endpoint
console.log('\n=== ROOT LINE ITEMS ENDPOINT ===')
try {
  const rootLI = await get('/purchaseorderlineitems', { $top: 3 })
  console.log(`Status: OK — Total=${rootLI.Total}`)
  if (rootLI.Results?.length) {
    console.log('Keys:', Object.keys(rootLI.Results[0]).sort().join(', '))
    console.log('Sample:', JSON.stringify(rootLI.Results[0], null, 2))
  }
} catch (err: any) {
  console.log(`Error: ${err.message}`)
}

console.log('\nDone.')
