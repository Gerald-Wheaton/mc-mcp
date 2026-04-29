// fallow-ignore-file unused-file
/**
 * Phase 2.5 exploration script — Parts
 * Run: bun --env-file=.env run scripts/explore-parts.ts
 */

import { loadConfig } from '../src/config.js'
import { McClient } from '../src/mc-client.js'

const client = new McClient(loadConfig())
async function get(path: string, params: Record<string, string | number> = {}) {
  return client.get<any>(path, { params })
}

// ── 1. Total count ────────────────────────────────────────────────────────────
const meta = await get('/Parts', { $top: 1 })
console.log(`\n=== TOTAL PARTS: ${meta.Total} ===`)

// ── 2. Sample of 30 records — field survey ────────────────────────────────────
console.log('\n=== SAMPLE 30 — ALL FIELD KEYS ===')
const sample = await get('/Parts', { $top: 30 })
const allKeys = new Set<string>()
for (const p of sample.Results) Object.keys(p).forEach(k => allKeys.add(k))
console.log([...allKeys].sort().join(', '))

// ── 3. Single record by PK — full field set ───────────────────────────────────
const firstPk: number = sample.Results[0]?.PK
console.log(`\n=== SINGLE RECORD (PK=${firstPk}) ===`)
const single = await get(`/Parts/${firstPk}`)
console.log(JSON.stringify(single, null, 2))

// ── 4. Second single record for comparison ────────────────────────────────────
const secondPk: number = sample.Results[5]?.PK
const single2 = await get(`/Parts/${secondPk}`)
console.log(`\n=== SINGLE RECORD #2 (PK=${secondPk}) ===`)
console.log(JSON.stringify(single2, null, 2))

// ── 5. IssueUnitsDetails codes ────────────────────────────────────────────────
console.log('\n=== IssueUnitsDetails CODES ===')
const issueUnits = new Map<string, number>()
for (const p of sample.Results) {
  const code = p.IssueUnitsDetails?.Value ?? '(null)'
  issueUnits.set(code, (issueUnits.get(code) ?? 0) + 1)
}
for (const [code, count] of [...issueUnits.entries()].sort()) {
  const desc = sample.Results.find((p: any) => (p.IssueUnitsDetails?.Value ?? '(null)') === code)?.IssueUnitsDetails?.Description ?? ''
  console.log(`  "${code}": ${count}  (${desc})`)
}

// ── 6. CostRuleDetails codes ──────────────────────────────────────────────────
console.log('\n=== CostRuleDetails CODES ===')
const costRules = new Map<string, number>()
for (const p of sample.Results) {
  const code = p.CostRuleDetails?.Value ?? '(null)'
  costRules.set(code, (costRules.get(code) ?? 0) + 1)
}
for (const [code, count] of [...costRules.entries()].sort()) {
  const desc = sample.Results.find((p: any) => (p.CostRuleDetails?.Value ?? '(null)') === code)?.CostRuleDetails?.Description ?? ''
  console.log(`  "${code}": ${count}  (${desc})`)
}

// ── 7. Boolean filter smoke tests ────────────────────────────────────────────
console.log('\n=== BOOLEAN FILTER COUNTS ===')
for (const filter of [
  'Active eq true',
  'Active eq false',
  'DirectIssue eq true',
  'DirectIssue eq false',
  'Hazardous eq true',
  'Hazardous eq false',
]) {
  const res = await get('/Parts', { $filter: filter, $top: 1 })
  console.log(`  $filter=${filter}: ${res.Total}`)
}

// ── 8. Boolean field population across sample ─────────────────────────────────
console.log('\n=== BOOLEAN FIELD POPULATION (sample of 30) ===')
for (const field of ['Active', 'DirectIssue', 'Hazardous']) {
  const t = sample.Results.filter((p: any) => p[field] === true).length
  const f = sample.Results.filter((p: any) => p[field] === false).length
  const n = sample.Results.filter((p: any) => p[field] == null).length
  console.log(`  ${field}: true=${t}, false=${f}, null=${n}`)
}

// ── 9. Numeric field presence ─────────────────────────────────────────────────
console.log('\n=== NUMERIC FIELD PRESENCE (sample of 30) ===')
for (const field of ['IssueUnitCost', 'LastOrderUnitPrice', 'QuantityOnHand', 'QuantityOnOrder', 'QuantityReserved', 'ReorderLevel', 'ReorderQuantity']) {
  const present = sample.Results.filter((p: any) => p[field] != null).length
  console.log(`  ${field}: ${present}/30 non-null`)
}

console.log('\nDone.')
