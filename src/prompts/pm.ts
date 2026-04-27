import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

interface RepairCenterArgs {
  repair_center_id?: string
  repair_center_name?: string
}

interface PmArgs extends RepairCenterArgs {
  asset_name?: string
}

const repairCenterArgsSchema = {
  repair_center_id: z
    .string()
    .optional()
    .describe('Exact repair center ID to scope the analysis to, such as M.'),
  repair_center_name: z
    .string()
    .optional()
    .describe('Exact repair center name to resolve case-insensitively before scoping the analysis.'),
}

const assetNameArgSchema = {
  asset_name: z
    .string()
    .optional()
    .describe('Asset name or partial name to resolve before focusing the analysis on one asset.'),
}

export function register(server: McpServer): void {
  server.registerPrompt(
    'mc_pm_compliance_review',
    {
      title: 'PM compliance review',
      description:
        'Review PM work order status to understand whether scheduled preventive maintenance is being completed on time or falling behind.',
      argsSchema: {
        ...repairCenterArgsSchema,
        ...assetNameArgSchema,
      },
    },
    (args: PmArgs) => {
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
                  'Read mc://context/labors before summarizing assignees or technician references.',
                  'Read mc://context/asset-locations before translating asset parent/location references.',
                ]),
                buildRepairCenterInstructions(args),
                buildAssetResolutionInstructions(assetName),
                assetName
                  ? `Give me a PM compliance review focused only on the resolved asset matching "${assetName}".

Step 1: Resolve the target asset first. If multiple assets plausibly match, stop and ask the user to clarify which asset they mean.

Step 2: Fetch PM-type work orders associated with that asset. Use the resolved asset's exact identifiers and do not invent unsupported asset filter paths.

Step 3: Tally those PM work orders by status: ISSUED, CLOSED, REQUESTED, CANCELED.

Step 4: For open PMs tied to that asset, identify the oldest ones and explain how long they have been open.

Summarize:
- Total PM work orders for the resolved asset and the status breakdown
- How many PMs are currently open for that asset, and how old is the oldest?
- Any warning signs that PM work for this asset is slipping

Close with a plain-language compliance assessment for this specific asset.`
                  : `Give me a PM compliance review — how well is scheduled preventive maintenance being completed?

Step 1: Fetch all PM-type work orders, capturing Status and DateOpened for each. Tally by status: ISSUED, CLOSED, REQUESTED, CANCELED.

Step 2: Fetch the 10 oldest open PMs, sorted by date opened. How long have they been open? Long-open PMs may signal overdue work.

Step 3: Fetch the 20 most recently closed PMs. What assets were maintained?

Summarize:
- Total PM work orders and status breakdown (as percentages)
- How many PMs are currently open, and how old is the oldest?
- Any patterns in which assets generate the most PMs?
- Plain-language compliance assessment: is PM work staying current or building up a backlog?`,
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
    'mc_inspection_summary',
    {
      title: 'Inspection summary',
      description:
        'Summarize open and recent inspection work orders to understand the state of scheduled inspections.',
      argsSchema: {
        ...repairCenterArgsSchema,
      },
    },
    (args: RepairCenterArgs) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are a maintenance operations assistant with access to live Maintenance Connection data.',
              buildContextInstructions([
                'Read mc://context/time before querying tools so relative dates are anchored correctly.',
                'Read mc://context/labors before summarizing assignees or technician references.',
                'Read mc://context/asset-locations before translating asset parent/location references.',
              ]),
              buildRepairCenterInstructions(args),
              `Give me a summary of inspection work orders.

Step 1: Fetch all open inspection work orders, sorted by priority.

Step 2: Fetch the 20 most recently closed inspection work orders.

For open inspections, summarize:
- Total count and priority breakdown
- How many are unassigned (IsAssigned eq false)?
- Which assets appear most frequently?
- Oldest open inspections (by DateOpened) — flag anything open more than 30 days

For recently closed, summarize:
- Count closed recently and which assets were inspected

Close with a plain-language assessment: are inspections being kept current, or is there a backlog building?`,
            ]
              .filter(Boolean)
              .join('\n\n'),
          },
        },
      ],
    }),
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

function buildRepairCenterInstructions(args: RepairCenterArgs): string | undefined {
  const repairCenterId = cleanArg(args.repair_center_id)
  const repairCenterName = cleanArg(args.repair_center_name)

  if (repairCenterId && repairCenterName) {
    throw new Error(
      'Provide only one repair center input. Use either repair_center_id or repair_center_name.',
    )
  }

  if (repairCenterId) {
    return `Scope all relevant work-order queries to repair center ID "${repairCenterId}" using the filter RepairCenterID eq "${repairCenterId}". Do not use RepairCenterRef navigation paths in filters.`
  }

  if (repairCenterName) {
    return `Resolve the repair center before the main analysis:
- Fetch a small sample of work orders or assets that include RepairCenterRef values.
- Build a distinct list of repair centers using each record's RepairCenterRef.ID and RepairCenterRef.Name.
- Compare names after trimming whitespace and converting to lowercase.
- If zero exact matches are found for "${repairCenterName}", stop and say the repair center name could not be resolved.
- If more than one exact match is found for "${repairCenterName}", stop and say duplicate repair centers were found and the request is ambiguous.
- Once exactly one repair center is resolved, use its ID and scope all subsequent work-order queries with RepairCenterID eq "{resolvedID}".
- Do not use RepairCenterRef/PK or RepairCenterRef/ID navigation filters.`
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
- Once one asset is resolved, use that asset's exact PK, ID, and Name to keep the rest of the analysis focused on it.`
}
