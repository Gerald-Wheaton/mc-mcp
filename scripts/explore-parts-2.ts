// fallow-ignore-file unused-file
/**
 * Phase 2.5 — Parts follow-up: IssueUnits/CostRule codes across full dataset
 * Run: bun --env-file=.env run scripts/explore-parts-2.ts
 */

import { loadConfig } from '../src/config.js'
import { McClient } from '../src/mc-client.js'

const client = new McClient(loadConfig())
async function get(path: string, params: Record<string, string | number> = {}) {
  return client.get<any>(path, { params })
}

// Fetch all 3305 in pages of 500
console.log('Fetching all parts in pages of 500...')
const all: any[] = []
let skip = 0
while (true) {
  const res = await get('/Parts', { $top: 500, $skip: skip })
  all.push(...res.Results)
  console.log(`  fetched ${all.length}/${res.Total}`)
  if (all.length >= res.Total) break
  skip += 500
}

// IssueUnitsDetails
console.log('\n=== IssueUnitsDetails CODES (all 3305) ===')
const issueUnits = new Map<string, { count: number; desc: string }>()
for (const p of all) {
  const code = p.IssueUnitsDetails?.Value ?? '(null)'
  const desc = p.IssueUnitsDetails?.Description ?? ''
  const cur = issueUnits.get(code) ?? { count: 0, desc }
  issueUnits.set(code, { count: cur.count + 1, desc })
}
for (const [code, { count, desc }] of [...issueUnits.entries()].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  "${code}": ${count}  (${desc})`)
}

// CostRuleDetails
console.log('\n=== CostRuleDetails CODES (all 3305) ===')
const costRules = new Map<string, { count: number; desc: string }>()
for (const p of all) {
  const code = p.CostRuleDetails?.Value ?? '(null)'
  const desc = p.CostRuleDetails?.Description ?? ''
  const cur = costRules.get(code) ?? { count: 0, desc }
  costRules.set(code, { count: cur.count + 1, desc })
}
for (const [code, { count, desc }] of [...costRules.entries()].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  "${code}": ${count}  (${desc})`)
}

// WarrantyFromDetails
console.log('\n=== WarrantyFromDetails CODES (all 3305) ===')
const warranty = new Map<string, { count: number; desc: string }>()
for (const p of all) {
  const code = p.WarrantyFromDetails?.Value ?? '(null)'
  const desc = p.WarrantyFromDetails?.Description ?? ''
  const cur = warranty.get(code) ?? { count: 0, desc }
  warranty.set(code, { count: cur.count + 1, desc })
}
for (const [code, { count, desc }] of [...warranty.entries()].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  "${code}": ${count}  (${desc})`)
}

// OrderUnitsDetails
console.log('\n=== OrderUnitsDetails CODES (all 3305) ===')
const orderUnits = new Map<string, { count: number; desc: string }>()
for (const p of all) {
  const code = p.OrderUnitsDetails?.Value ?? '(null)'
  const desc = p.OrderUnitsDetails?.Description ?? ''
  const cur = orderUnits.get(code) ?? { count: 0, desc }
  orderUnits.set(code, { count: cur.count + 1, desc })
}
for (const [code, { count, desc }] of [...orderUnits.entries()].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  "${code}": ${count}  (${desc})`)
}

// AvailableToRequester
const atr = all.filter(p => p.AvailableToRequester === true).length
console.log(`\n=== AvailableToRequester: true=${atr}, false=${all.length - atr} ===`)

// RotatingPart
const rot = all.filter(p => p.RotatingPart === true).length
console.log(`=== RotatingPart: true=${rot}, false=${all.length - rot} ===`)

// WarrantyDays non-null
const wd = all.filter(p => p.WarrantyDays != null && p.WarrantyDays > 0).length
console.log(`=== WarrantyDays > 0: ${wd} ===`)

console.log('\nDone.')
