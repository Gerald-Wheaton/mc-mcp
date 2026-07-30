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

interface AssetHealthArgs extends RepairCenterArgs {
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
    'mc_asset_health_check',
    'Identify which equipment assets have the most active open work orders — a proxy for assets under stress or nearing failure.',
    {
      ...repairCenterArgsSchema,
      ...assetNameArgSchema,
    },
    (args: AssetHealthArgs) => {
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
                  CONTEXT_INSTRUCTIONS.assetLocations,
                ]),
                buildRepairCenterInstructions({
                  args,
                  scopeLabel: 'all relevant asset and work-order queries',
                  resolutionSampleLabel: 'work orders or assets',
                }),
                buildAssetResolutionInstructions(assetName),
                assetName
                  ? `I want an asset-specific health check for the resolved asset matching "${assetName}".

Step 1: Resolve the target asset first. If multiple assets plausibly match, stop and ask the user to clarify which asset they mean.

Step 2: Pull open corrective maintenance work tied to that resolved asset. Keep the scope tightly focused on the resolved asset and do not guess if the results cannot be narrowed reliably.

Step 3: Fetch the full asset record using mc_get_asset to gather context such as whether it is currently up, when it was last maintained, where it sits in the hierarchy, its classification, and its parent location.

Summarize:
- Asset name and ID
- Whether the asset is currently up
- Last maintained date
- Count and age of open corrective work orders for this asset
- Any warning signs from the asset's open work history or condition

Close with a plain-language assessment of whether this specific asset looks healthy, stressed, or in need of follow-up.`
                  : `I want to understand which equipment assets are generating the most maintenance activity right now.

Step 1: Fetch open corrective maintenance work orders. Collect the linked asset from each record.

Step 2: Tally open CM work orders per asset. Which assets appear most frequently?

Step 3: For the top 5 assets by open CM count, fetch the full asset record using mc_get_asset to gather additional context such as whether the asset is currently operational, when it was last maintained, how deep it is in the hierarchy, its classification, and its parent location.

Present a ranked list of the top assets by open CM work order count. For each asset, include:
- Asset name and ID
- Number of open CMs
- Is the asset currently up?
- Last maintained date
- Location / parent asset

Close with a plain-language assessment: which assets look like they may need proactive attention or investigation?`,
              ]),
            },
          },
        ],
      }
    },
  )

  server.prompt(
    'mc_location_equipment_breakdown',
    'Summarize the asset hierarchy — how many location nodes vs equipment records exist, and what does the top of the tree look like.',
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
                CONTEXT_INSTRUCTIONS.assetLocations,
              ]),
              buildRepairCenterInstructions({
                args,
                scopeLabel: 'all relevant asset and work-order queries',
                resolutionSampleLabel: 'work orders or assets',
              }),
              `Help me understand the shape of the asset hierarchy in this system.

Step 1: Fetch assets at the top of the hierarchy — root and campus/site-level nodes. List their names and IDs.

Step 2: Fetch a sample of up to 20 equipment assets (non-location nodes) to show what the leaf-level records look like — include each asset's name, ID, classification, and parent location.

Step 3: Get a count of location-only assets and a count of equipment assets (inspect Total in each response).

Summarize:
- How many total assets are in the system (locations + equipment combined)?
- How many are pure location/structural nodes vs actual equipment?
- What does the top of the tree look like (site/campus names)?
- What types of equipment are represented in the sample?

This gives a quick orientation to the facility structure for someone new to this account.`,
            ]),
          },
        },
      ],
    }),
  )
}
