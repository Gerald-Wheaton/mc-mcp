import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  buildRepairCenterInstructions,
  repairCenterArgsSchema,
  type RepairCenterArgs,
} from './repair-center.js'
import {
  buildAssetResolutionInstructions,
  buildContextInstructions,
  buildPromptText,
  cleanArg,
  CONTEXT_INSTRUCTIONS,
} from './shared.js'

interface PmArgs extends RepairCenterArgs {
  asset_name?: string
}

const assetNameArgSchema = {
  asset_name: z
    .string()
    .optional()
    .describe('Asset name or partial name to resolve before focusing the analysis on one asset.'),
}

export function register(server: McpServer): void {
  server.prompt(
    'mc_pm_compliance_review',
    'Review PM work order status to understand whether scheduled preventive maintenance is being completed on time or falling behind.',
    {
      ...repairCenterArgsSchema,
      ...assetNameArgSchema,
    },
    (args: PmArgs) => {
      const assetName = cleanArg(args.asset_name)

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: buildPromptText([
                buildContextInstructions([
                  CONTEXT_INSTRUCTIONS.time,
                  CONTEXT_INSTRUCTIONS.labors,
                  CONTEXT_INSTRUCTIONS.assetLocationsBefore,
                ]),
                buildRepairCenterInstructions({
                  args,
                  scopeLabel: 'all relevant work-order queries',
                  resolutionSampleLabel: 'work orders or assets',
                }),
                buildAssetResolutionInstructions(assetName),
                assetName
                  ? `Give me a PM compliance review focused only on the resolved asset matching "${assetName}".

Step 1: Resolve the target asset first. If multiple assets plausibly match, stop and ask the user to clarify which asset they mean.

Step 2: Fetch PM-type work orders associated with that asset. Keep the scope tightly focused on the resolved asset and do not guess if the results cannot be narrowed reliably.

Step 3: Tally those PM work orders by status: ISSUED, CLOSED, REQUESTED, CANCELED.

Step 4: For open PMs tied to that asset, identify the oldest ones and explain how long they have been open.

Summarize:
- Total PM work orders for the resolved asset and the status breakdown
- How many PMs are currently open for that asset, and how old is the oldest?
- Any warning signs that PM work for this asset is slipping

Close with a plain-language compliance assessment for this specific asset.`
                  : `Give me a PM compliance review — how well is scheduled preventive maintenance being completed?

Step 1: Fetch all PM-type work orders, capturing status and opened date for each. Tally them by status.

Step 2: Fetch the 10 oldest open PMs, sorted by opened date. How long have they been open? Long-open PMs may signal overdue work.

Step 3: Fetch the 20 most recently closed PMs. What assets were maintained?

Summarize:
- Total PM work orders and status breakdown (as percentages)
- How many PMs are currently open, and how old is the oldest?
- Any patterns in which assets generate the most PMs?
- Plain-language compliance assessment: is PM work staying current or building up a backlog?`,
              ]),
            },
          },
        ],
      }
    },
  )

  server.prompt(
    'mc_inspection_summary',
    'Summarize open and recent inspection work orders to understand the state of scheduled inspections.',
    {
      ...repairCenterArgsSchema,
    },
    (args: RepairCenterArgs) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: buildPromptText([
              buildContextInstructions([
                CONTEXT_INSTRUCTIONS.time,
                CONTEXT_INSTRUCTIONS.labors,
                CONTEXT_INSTRUCTIONS.assetLocationsBefore,
              ]),
              buildRepairCenterInstructions({
                args,
                scopeLabel: 'all relevant work-order queries',
                resolutionSampleLabel: 'work orders or assets',
              }),
              `Give me a summary of inspection work orders.

Step 1: Fetch all open inspection work orders, sorted by priority.

Step 2: Fetch the 20 most recently closed inspection work orders.

For open inspections, summarize:
- Total count and priority breakdown
- How many are unassigned?
- Which assets appear most frequently?
- Oldest open inspections by opened date — flag anything open more than 30 days

For recently closed, summarize:
- Count closed recently and which assets were inspected

Close with a plain-language assessment: are inspections being kept current, or is there a backlog building?`,
            ]),
          },
        },
      ],
    }),
  )
}
