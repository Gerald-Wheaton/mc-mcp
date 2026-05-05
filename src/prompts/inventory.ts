import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

interface ReservedPartsArgs {
  repair_center_id?: string
  repair_center_name?: string
  asset_name?: string
}

interface CategoryArgs {
  category?: string
}

const reservedPartsArgsSchema = {
  repair_center_id: z
    .string()
    .optional()
    .describe('Exact repair center ID to scope the work-order side of the audit to, such as M.'),
  repair_center_name: z
    .string()
    .optional()
    .describe(
      'Exact repair center name to resolve case-insensitively before scoping the work-order side of the audit.',
    ),
  asset_name: z
    .string()
    .optional()
    .describe('Asset name or partial name to resolve before focusing the audit on one asset.'),
}

const categoryArgSchema = {
  category: z
    .string()
    .optional()
    .describe('Category name to focus the parts analysis on after resolving the category from live data.'),
}

export function register(server: McpServer): void {
  server.registerPrompt(
    'mc_reserved_parts_audit',
    {
      title: 'Reserved parts audit',
      description:
        'Show all open work orders with parts reserved and surface which parts are tied up, to help identify inventory bottlenecks.',
      argsSchema: {
        ...reservedPartsArgsSchema,
      },
    },
    (args: ReservedPartsArgs) => {
      const assetName = cleanArg(args.asset_name)

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                'You are a maintenance operations assistant with access to live Maintenance Connection data.',
                buildContextInstructions([
                  'Read mc://context/time before querying tools so relative dates are anchored correctly.',
                  'Read mc://context/labors before summarizing assignees or technician references on work orders.',
                  'Read mc://context/lookup-tables when you need lookup-backed labels or codes during the audit.',
                ]),
                buildRepairCenterInstructions(args),
                buildAssetResolutionInstructions(assetName),
                assetName
                  ? `A "reserved parts" situation means a work order has parts allocated to it but the work may not yet be complete. I want to audit reserved parts only for the resolved asset matching "${assetName}".

Step 1: Resolve the target asset first. If multiple assets plausibly match, stop and ask the user to clarify which asset they mean.

Step 2: Fetch open work orders with reserved parts for that resolved asset. Apply any repair-center scope only on the work-order queries, not on the part lookups.

Step 3: For each unique part referenced across those work orders, fetch the part record using mc_get_part to gather its name, ID, internal part number, unit cost, and whether it is marked active.

Summarize:
- How many open work orders for this asset have parts reserved?
- Which parts are reserved most often for this asset?
- Are any reserved parts inactive?
- Which reserved-part work orders for this asset have been open the longest?

Close with a plain-language assessment of whether this asset's reserved-parts situation looks healthy or stalled.`
                  : `A "reserved parts" situation means a work order has parts allocated to it but the work may not yet be complete. I want to audit what is currently reserved.

Step 1: Fetch open work orders that have parts reserved.

For each work order, capture: ID, reason/description, type, priority, linked asset, and date opened.

Step 2: For each unique part tied to those work orders, fetch the part record using mc_get_part to gather its name, ID, internal part number, unit cost, and whether it is marked active.

Step 3: Summarize:
- How many open work orders have parts reserved?
- Which parts appear most frequently across multiple WOs?
- Are any reserved parts marked inactive — that could be a data quality issue?
- Which work orders have been open the longest with parts still reserved — these may represent stalled work?

Close with a plain-language assessment of whether the reserved parts situation looks healthy or whether action is needed.`,
              ]
                .filter(Boolean)
                .join('\n\n'),
            },
          },
        ],
      }
    },
  )

  server.registerPrompt(
    'mc_inventory_audit',
    {
      title: 'Inventory audit',
      description:
        'Get a high-level overview of the parts catalog — active vs inactive parts, cost rule distribution, and general inventory health.',
      argsSchema: {
        ...categoryArgSchema,
      },
    },
    (args: CategoryArgs) => {
      const category = cleanArg(args.category)

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                'You are a maintenance operations assistant with access to live Maintenance Connection data.',
                buildContextInstructions([
                  'Read mc://context/time before querying tools so relative dates are anchored correctly.',
                  'Read mc://context/lookup-tables before resolving any category or other lookup-backed value.',
                ]),
                buildCategoryInstructions(category),
                category
                  ? `Give me a high-level inventory audit focused only on parts in the resolved category "${category}".

First resolve the category from live lookup-table data or observed category values in part records. If the category cannot be resolved uniquely, stop and tell the user.

After the category is resolved, focus the audit only on parts in that category. If the results cannot be narrowed reliably, say so briefly and keep the scope in your analysis rather than guessing.

Summarize:
- Total parts in this category
- Active vs inactive split
- How many are available to requesters
- Whether cost fields and descriptions are generally well-populated
- Any data quality flags or cleanup opportunities

Keep the summary concise and specific to the chosen category.`
                  : `Give me a high-level inventory audit of the parts catalog.

Step 1: Fetch a broad sample of up to 100 parts to understand the general shape of the catalog — field population, cost data, category distribution.

Step 2: Fetch active parts only and note the total count from the response envelope.

Step 3: Fetch inactive parts only and note the count.

Step 4: Fetch parts available to requesters — these are parts end users can request directly.

Summarize:
- Total parts in the catalog (active + inactive)
- What percentage are active?
- How many are available to requesters?
- From the sample: what categories appear most? Are unit-cost and last-purchase-price fields well-populated or mostly empty?
- Any data quality flags — parts with no description, no category, or zero cost?

Keep the summary concise — this is an orientation, not an exhaustive ledger.`,
              ]
                .filter(Boolean)
                .join('\n\n'),
            },
          },
        ],
      }
    },
  )

  server.registerPrompt(
    'mc_slow_moving_parts',
    {
      title: 'Slow-moving parts',
      description:
        'Identify parts that have not been issued or ordered recently — candidates for reorder review or catalog cleanup.',
      argsSchema: {
        ...categoryArgSchema,
      },
    },
    (args: CategoryArgs) => {
      const category = cleanArg(args.category)

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                'You are a maintenance operations assistant with access to live Maintenance Connection data.',
                buildContextInstructions([
                  'Read mc://context/time before querying tools so relative dates are anchored correctly.',
                  'Read mc://context/lookup-tables before resolving any category or other lookup-backed value.',
                ]),
                buildCategoryInstructions(category),
                category
                  ? `I want to find slow-moving parts only within the resolved category "${category}".

First resolve the category from live lookup-table data or observed category values in part records. If the category cannot be resolved uniquely, stop and tell the user.

Then focus only on parts in that category. If the results cannot be narrowed reliably, say so briefly and keep the scope in your analysis rather than guessing.

Within that category:
- Identify parts with the oldest last-issued dates
- Identify parts with the oldest last-ordered dates
- Highlight parts that appear slow on both dimensions
- Include each part's name, ID, internal part number, last-issued date, last-ordered date, and unit cost

Close with a plain-language summary of whether this category looks well-managed or overdue for cleanup.`
                  : `I want to find parts that haven't been moving — not issued recently, not ordered recently. These are candidates for reorder policy review or catalog cleanup.

Step 1: Fetch active parts sorted by oldest last-issued date first (up to 50 records).

Step 2: Fetch active parts sorted by oldest last-ordered date first (up to 50 records).

For parts appearing in both lists (slow on both issuing and ordering), highlight them — these are the strongest candidates for review.

For each highlighted part include its name, ID, internal part number, last-issued date, last-ordered date, and unit cost.

Close with a plain-language summary: how many parts appear genuinely slow-moving, and does the catalog seem well-maintained or overdue for a cleanup pass?`,
              ]
                .filter(Boolean)
                .join('\n\n'),
            },
          },
        ],
      }
    },
  )
}

function cleanArg(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function buildContextInstructions(lines: string[]): string {
  return `Before querying tools:
${lines.map((line) => `- ${line}`).join('\n')}`
}

function buildRepairCenterInstructions(args: ReservedPartsArgs): string | undefined {
  const repairCenterId = cleanArg(args.repair_center_id)
  const repairCenterName = cleanArg(args.repair_center_name)

  if (repairCenterId && repairCenterName) {
    throw new Error(
      'Provide only one repair center input. Use either repair_center_id or repair_center_name.',
    )
  }

  if (repairCenterId) {
    return `Keep the work-order side of this audit limited to repair center ID "${repairCenterId}". Do not apply that repair-center scope to the part lookups. If the scope cannot be applied confidently, stop and explain the limitation instead of guessing.`
  }

  if (repairCenterName) {
    return `Resolve the repair center before the main analysis:
- Fetch a small sample of work orders or assets that include repair center information.
- Build a distinct list of repair centers using the IDs and names returned in those records.
- Compare names after trimming whitespace and converting to lowercase.
- If zero exact matches are found for "${repairCenterName}", stop and say the repair center name could not be resolved.
- If more than one exact match is found for "${repairCenterName}", stop and say duplicate repair centers were found and the request is ambiguous.
- Once exactly one repair center is resolved, keep subsequent work-order queries limited to that repair center.
- Do not apply the repair-center scope to the part lookups, and do not broaden the request if the repair center cannot be pinned down.`
  }

  return undefined
}

function buildAssetResolutionInstructions(assetName?: string): string | undefined {
  if (!assetName) {
    return undefined
  }

  return `Resolve the target asset before the main analysis:
- Use mc_list_assets to find candidates whose IDs or names match "${assetName}".
- Prefer an exact match when one exists.
- If multiple assets plausibly match, stop and ask the user to clarify which asset they want.
- Once one asset is resolved, use that asset's returned identifiers and name to keep the rest of the analysis focused on it.`
}

function buildCategoryInstructions(category?: string): string | undefined {
  if (!category) {
    return undefined
  }

  return `Resolve the category before the main analysis:
- Use mc://context/lookup-tables and observed category values in live part data to find the exact category that matches "${category}".
- Compare category names after trimming whitespace and converting to lowercase.
- If zero exact matches are found, stop and say the category could not be resolved.
- If more than one exact match is found, stop and say the category is ambiguous.
- Once resolved, keep the remainder of the analysis focused on that category. If the results cannot be narrowed reliably, say so briefly and keep the scope in your reasoning instead of guessing.`
}
