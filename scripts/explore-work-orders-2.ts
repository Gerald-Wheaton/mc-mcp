// fallow-ignore-file unused-file
/**
 * Phase 2.5 — Work Orders follow-up: find all type codes and complete status codes
 * Run: bun --env-file=.env run scripts/explore-work-orders-2.ts
 */

import { loadConfig } from '../src/config.js'
import { McClient } from '../src/mc-client.js'

const client = new McClient(loadConfig())
async function get(path: string, params: Record<string, string | number> = {}) {
  return client.get<any>(path, { params })
}

// ── Collect all 645 records in pages of 200 ──────────────────────────────────
console.log('Fetching all WOs in pages...')
const allResults: any[] = []
let skip = 0
while (true) {
  const res = await get('/workorders', { $top: 200, $skip: skip })
  allResults.push(...res.Results)
  if (allResults.length >= res.Total) break
  skip += 200
}
console.log(`Fetched ${allResults.length} records\n`)

// ── Type codes ────────────────────────────────────────────────────────────────
console.log('=== ALL TYPE CODES ===')
const types = new Map<string, number>()
for (const wo of allResults) {
  const code = wo.TypeDetails?.Value ?? '(null)'
  types.set(code, (types.get(code) ?? 0) + 1)
}
for (const [code, count] of [...types.entries()].sort((a, b) => b[1] - a[1])) {
  const desc = allResults.find(w => (w.TypeDetails?.Value ?? '(null)') === code)?.TypeDetails?.Description ?? ''
  console.log(`  ${code}: ${count}  (${desc})`)
}

// ── Status codes ──────────────────────────────────────────────────────────────
console.log('\n=== ALL STATUS CODES ===')
const statuses = new Map<string, number>()
for (const wo of allResults) {
  const code = wo.StatusDetails?.Value ?? '(null)'
  statuses.set(code, (statuses.get(code) ?? 0) + 1)
}
for (const [code, count] of [...statuses.entries()].sort((a, b) => b[1] - a[1])) {
  const desc = allResults.find(w => (w.StatusDetails?.Value ?? '(null)') === code)?.StatusDetails?.Description ?? ''
  console.log(`  ${code}: ${count}  (${desc})`)
}

// ── Priority codes ────────────────────────────────────────────────────────────
console.log('\n=== ALL PRIORITY CODES ===')
const priorities = new Map<string, number>()
for (const wo of allResults) {
  const code = wo.PriorityDetails?.Value ?? '(null)'
  priorities.set(code, (priorities.get(code) ?? 0) + 1)
}
for (const [code, count] of [...priorities.entries()].sort((a, b) => b[1] - a[1])) {
  const desc = allResults.find(w => (w.PriorityDetails?.Value ?? '(null)') === code)?.PriorityDetails?.Description ?? ''
  console.log(`  ${code}: ${count}  (${desc})`)
}

// ── Auth status codes ─────────────────────────────────────────────────────────
console.log('\n=== ALL AUTH STATUS CODES ===')
const authStatuses = new Map<string, number>()
for (const wo of allResults) {
  const code = wo.AuthStatusDetails?.Value ?? '(null)'
  authStatuses.set(code, (authStatuses.get(code) ?? 0) + 1)
}
for (const [code, count] of [...authStatuses.entries()].sort((a, b) => b[1] - a[1])) {
  const desc = allResults.find(w => (w.AuthStatusDetails?.Value ?? '(null)') === code)?.AuthStatusDetails?.Description ?? ''
  console.log(`  ${code}: ${count}  (${desc})`)
}

// ── Boolean field survey ──────────────────────────────────────────────────────
console.log('\n=== BOOLEAN FIELD POPULATION ===')
const boolFields = [
  'IsOpen', 'IsApproved', 'IsAssigned', 'IsPartsReserved',
  'HasWarranty', 'IsChargeable', 'IsFollowupWork', 'IsFailedWorkOrder',
  'IsLockoutTagout', 'IsShutdownRequired',
]
for (const field of boolFields) {
  const trueCount = allResults.filter(w => w[field] === true).length
  const falseCount = allResults.filter(w => w[field] === false).length
  const nullCount = allResults.filter(w => w[field] == null).length
  console.log(`  ${field}: true=${trueCount}, false=${falseCount}, null=${nullCount}`)
}

console.log('\nDone.')
