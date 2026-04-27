import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

interface RepairCenterArgs {
  repair_center_id?: string
  repair_center_name?: string
}

interface AssetHealthArgs extends RepairCenterArgs {
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
    'mc_asset_health_check',
    {
      title: 'Asset health check',
      description:
        'Identify which equipment assets have the most active open work orders — a proxy for assets under stress or nearing failure.',
      argsSchema: {
        ...repairCenterArgsSchema,
        ...assetNameArgSchema,
      },
    },
    (args: AssetHealthArgs) => {
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
                  'Read mc://context/asset-locations before translating asset parent/location references.',
                ]),
                buildRepairCenterInstructions(args),
                buildAssetResolutionInstructions(assetName),
                assetName
                  ? `I want an asset-specific health check for the resolved asset matching "${assetName}".

Step 1: Resolve the target asset first. If multiple assets plausibly match, stop and ask the user to clarify which asset they mean.

Step 2: Pull open corrective maintenance work tied to that resolved asset. Use the resolved asset's exact identifiers and do not invent unsupported asset filter paths.

Step 3: Fetch the full asset record using mc_get_asset to gather context such as IsUp, LastMaintained, AssetLevel, ClassificationRef, and ParentRef.

Summarize:
- Asset name and ID
- Whether the asset is currently up (IsUp)
- Last maintained date
- Count and age of open corrective work orders for this asset
- Any warning signs from the asset's open work history or condition

Close with a plain-language assessment of whether this specific asset looks healthy, stressed, or in need of follow-up.`
                  : `I want to understand which equipment assets are generating the most maintenance activity right now.

Step 1: Fetch open corrective maintenance work orders (Type eq "CM" and IsOpen eq true). Collect the AssetRef (PK and Name) from each record.

Step 2: Tally open CM work orders per asset. Which assets appear most frequently?

Step 3: For the top 5 assets by open CM count, fetch the full asset record using mc_get_asset to get additional context: IsUp (is the asset currently operational?), LastMaintained, AssetLevel, ClassificationRef, and ParentRef (location).

Present a ranked list of the top assets by open CM work order count. For each asset, include:
- Asset name and ID
- Number of open CMs
- Is the asset currently up (IsUp)?
- Last maintained date
- Location / parent asset

Close with a plain-language assessment: which assets look like they may need proactive attention or investigation?`,
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
    'mc_location_equipment_breakdown',
    {
      title: 'Location & equipment breakdown',
      description:
        'Summarize the asset hierarchy — how many location nodes vs equipment records exist, and what does the top of the tree look like.',
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
                'Read mc://context/asset-locations before translating asset parent/location references.',
              ]),
              buildRepairCenterInstructions(args),
              `Help me understand the shape of the asset hierarchy in this system.

Step 1: Fetch assets at the top of the hierarchy — root and campus/site-level nodes. List their names and IDs.

Step 2: Fetch a sample of up to 20 equipment assets (non-location nodes) to show what the leaf-level records look like — include Name, ID, ClassificationRef, and ParentRef.

Step 3: Get a count of location-only assets and a count of equipment assets (inspect Total in each response).

Summarize:
- How many total assets are in the system (locations + equipment combined)?
- How many are pure location/structural nodes vs actual equipment?
- What does the top of the tree look like (site/campus names)?
- What types of equipment are represented in the sample?

This gives a quick orientation to the facility structure for someone new to this account.`,
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
    return `Scope all relevant asset queries to repair center ID "${repairCenterId}" using the filter RepairCenterID eq "${repairCenterId}". Do not use RepairCenterRef navigation paths in filters.`
  }

  if (repairCenterName) {
    return `Resolve the repair center before the main analysis:
- Fetch a small sample of work orders or assets that include RepairCenterRef values.
- Build a distinct list of repair centers using each record's RepairCenterRef.ID and RepairCenterRef.Name.
- Compare names after trimming whitespace and converting to lowercase.
- If zero exact matches are found for "${repairCenterName}", stop and say the repair center name could not be resolved.
- If more than one exact match is found for "${repairCenterName}", stop and say duplicate repair centers were found and the request is ambiguous.
- Once exactly one repair center is resolved, use its ID and scope all subsequent asset queries with RepairCenterID eq "{resolvedID}".
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
