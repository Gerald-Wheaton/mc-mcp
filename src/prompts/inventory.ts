import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function register(server: McpServer): void {
  server.registerPrompt(
    'mc_reserved_parts_audit',
    {
      title: 'Reserved parts audit',
      description:
        'Show all open work orders with parts reserved and surface which parts are tied up, to help identify inventory bottlenecks.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

A "reserved parts" situation means a work order has parts allocated to it but the work may not yet be complete. I want to audit what is currently reserved.

Step 1: Fetch all open work orders with parts reserved:
  $filter=IsOpen eq true and IsPartsReserved eq true

For each work order, capture: ID, reason/description, type, priority, asset (AssetRef), and date opened.

Step 2: For each unique part referenced (PartRef) across those work orders, fetch the part record using mc_get_part to get: Name, ID, InternalPartNumber, IssueUnitCost, and Active status.

Step 3: Summarize:
- How many open work orders have parts reserved?
- Which parts appear most frequently across multiple WOs?
- Are any reserved parts inactive (Active eq false) — that could be a data quality issue?
- Which work orders have been open the longest with parts still reserved — these may represent stalled work?

Close with a plain-language assessment of whether the reserved parts situation looks healthy or whether action is needed.`,
          },
        },
      ],
    }),
  )

  server.registerPrompt(
    'mc_inventory_audit',
    {
      title: 'Inventory audit',
      description:
        'Get a high-level overview of the parts catalog — active vs inactive parts, cost rule distribution, and general inventory health.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

Give me a high-level inventory audit of the parts catalog.

Step 1: Fetch a broad sample of parts (use $top=100, no filter) to understand the general shape of the catalog — field population, cost data, category distribution.

Step 2: Fetch active parts only ($filter=Active eq true) and note the total count from the response envelope.

Step 3: Fetch inactive parts ($filter=Active eq false) and note the count.

Step 4: Fetch parts available to requesters ($filter=AvailableToRequester eq true) — these are parts end users can request directly.

Summarize:
- Total parts in the catalog (active + inactive)
- What percentage are active?
- How many are available to requesters?
- From the sample: what categories appear most? Are cost fields (IssueUnitCost, LastOrderUnitPrice) well-populated or mostly null?
- Any data quality flags — parts with no description, no category, or zero cost?

Keep the summary concise — this is an orientation, not an exhaustive ledger.`,
          },
        },
      ],
    }),
  )

  server.registerPrompt(
    'mc_slow_moving_parts',
    {
      title: 'Slow-moving parts',
      description:
        'Identify parts that have not been issued or ordered recently — candidates for reorder review or catalog cleanup.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

I want to find parts that haven't been moving — not issued recently, not ordered recently. These are candidates for reorder policy review or catalog cleanup.

Step 1: Fetch active parts, ordered by LastIssued ascending (oldest first):
  $filter=Active eq true
  $orderby=LastIssued asc
  $top=50

Step 2: Fetch active parts ordered by LastOrdered ascending:
  $filter=Active eq true
  $orderby=LastOrdered asc
  $top=50

For parts appearing in both lists (slow on both issuing and ordering), highlight them — these are the strongest candidates for review.

For each highlighted part include: Name, ID, InternalPartNumber, LastIssued, LastOrdered, IssueUnitCost.

Close with a plain-language summary: how many parts appear genuinely slow-moving, and does the catalog seem well-maintained or overdue for a cleanup pass?`,
          },
        },
      ],
    }),
  )
}
