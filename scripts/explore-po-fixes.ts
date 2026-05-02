import { loadConfig } from '../src/config.js'
import { McClient } from '../src/mc-client.js'

const client = new McClient(loadConfig())
async function get(path: string, params: Record<string, string | number> = {}) {
  return client.get<any>(path, { params })
}

// Check Budget values across all POs
const all = await get('/purchaseorders', { $top: 100 })
const budgetTypes = new Set<string>()
for (const po of all.Results) {
  budgetTypes.add(po.Budget === null ? 'null' : typeof po.Budget)
}
console.log('Budget value types:', [...budgetTypes])
const nullBudgets = all.Results.filter((po: any) => po.Budget === null).length
console.log(`Budget null count: ${nullBudgets}/${all.Total}`)

// Try alternate status filter paths
for (const filter of [
  'Status eq "ISSUED"',
  'StatusDetails/Value eq "ISSUED"',
]) {
  try {
    const res = await get('/purchaseorders', { $filter: filter, $top: 1 })
    console.log(`$filter=${filter}: OK (Total=${res.Total})`)
  } catch (err: any) {
    console.log(`$filter=${filter}: FAILED — ${err.message.slice(0, 80)}`)
  }
}
