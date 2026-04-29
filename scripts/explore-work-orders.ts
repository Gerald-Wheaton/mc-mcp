// fallow-ignore-file unused-file
/**
 * Phase 2.5 exploration script — Work Orders
 * Run: bun --env-file=.env run scripts/explore-work-orders.ts
 */

import { loadConfig } from '../src/config.js'
import { McClient } from '../src/mc-client.js'

const client = new McClient(loadConfig())

async function get(path: string, params: Record<string, string | number> = {}) {
  return client.get<any>(path, { params })
}

// ── 1. Totals by type ────────────────────────────────────────────────────────
console.log('\n=== TOTALS BY TYPE ===')
const allTotal = await get('/workorders', { $top: 1 })
console.log(`  ALL: ${allTotal.Total}`)
for (const type of ['CM', 'PM', 'SR', 'PC']) {
  const res = await get('/workorders', { $filter: `Type eq "${type}"`, $top: 1 })
  console.log(`  ${type}: ${res.Total}`)
}

// ── 2. All status codes in use ───────────────────────────────────────────────
console.log('\n=== STATUS CODES (all WOs, $top=200) ===')
const allWOs = await get('/workorders', { $top: 200 })
const statuses = new Map<string, number>()
for (const wo of allWOs.Results) {
  const code = wo.StatusDetails?.Value ?? '(null)'
  statuses.set(code, (statuses.get(code) ?? 0) + 1)
}
for (const [code, count] of [...statuses.entries()].sort()) {
  console.log(`  ${code}: ${count}`)
}

// ── 3. Sample CM work order — field survey ───────────────────────────────────
console.log('\n=== SAMPLE CM WORK ORDER (full fields) ===')
const cms = await get('/workorders', { $filter: 'Type eq "CM"', $top: 1 })
const cmPk: number = cms.Results[0]?.PK
console.log('List record keys:', Object.keys(cms.Results[0] ?? {}).sort().join(', '))

if (cmPk) {
  const single = await get(`/workorders/${cmPk}`)
  console.log('\nSingle record keys:', Object.keys(single.Results?.[0] ?? single).sort().join(', '))
  console.log('\nFull record:')
  console.log(JSON.stringify(single, null, 2))
}

// ── 4. Sample PM work order ──────────────────────────────────────────────────
console.log('\n=== SAMPLE PM WORK ORDER (list keys) ===')
const pms = await get('/workorders', { $filter: 'Type eq "PM"', $top: 1 })
console.log('Keys:', Object.keys(pms.Results[0] ?? {}).sort().join(', '))
console.log('Record:', JSON.stringify(pms.Results[0], null, 2))

// ── 5. Sample SR work order ──────────────────────────────────────────────────
console.log('\n=== SAMPLE SR WORK ORDER (list keys) ===')
const srs = await get('/workorders', { $filter: 'Type eq "SR"', $top: 1 })
console.log('Keys:', Object.keys(srs.Results[0] ?? {}).sort().join(', '))
console.log('Record:', JSON.stringify(srs.Results[0], null, 2))

// ── 6. Boolean filter smoke tests ───────────────────────────────────────────
console.log('\n=== BOOLEAN FILTER COUNTS ===')
for (const filter of [
  'IsOpen eq true',
  'IsOpen eq false',
  'IsApproved eq true',
  'IsApproved eq false',
  'IsAssigned eq true',
  'IsAssigned eq false',
]) {
  const res = await get('/workorders', { $filter: filter, $top: 1 })
  console.log(`  $filter=${filter}: ${res.Total}`)
}

// ── 7. Priority codes in use ─────────────────────────────────────────────────
console.log('\n=== PRIORITY CODES ===')
const priorities = new Map<string, number>()
for (const wo of allWOs.Results) {
  const code = wo.PriorityDetails?.Value ?? '(null)'
  priorities.set(code, (priorities.get(code) ?? 0) + 1)
}
for (const [code, count] of [...priorities.entries()].sort()) {
  console.log(`  ${code}: ${count}`)
}

console.log('\nDone.')
