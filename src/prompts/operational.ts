import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  buildRepairCenterInstructions,
  repairCenterArgsSchema,
  type RepairCenterArgs,
} from './repair-center.js'
import {
  buildContextInstructions,
  buildPromptText,
  cleanArg,
  CONTEXT_INSTRUCTIONS,
} from './shared.js'

interface BacklogArgs extends RepairCenterArgs {
  type?: string
}

const workOrderTypeArgSchema = {
  type: z
    .string()
    .optional()
    .describe('Optional work order type code to focus on, such as CM, PM, IN, SR, CAP, ADMN, FO, or PC.'),
}

export function register(server: McpServer): void {
  server.prompt(
    'mc_daily_maintenance_review',
    "Get a summary of today's maintenance activity — open high-priority work orders, recently completed work, and anything that needs immediate attention.",
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
                CONTEXT_INSTRUCTIONS.assetLocations,
              ]),
              buildRepairCenterInstructions({
                args,
                scopeLabel: 'all relevant work-order queries',
                resolutionSampleLabel: 'work orders or assets',
              }),
              `Give me a daily maintenance review. Cover the following:

1. **Emergency and high-priority open work orders** — fetch open work orders with priority 0 ("Emergency / Immediate Response"). List each one with its ID, reason/description, asset, and how long it has been open.

2. **Unassigned open work orders** — fetch open work orders that are not yet assigned. How many are there? Break them down by work order type.

3. **Recently closed work orders** — fetch recently closed work orders. How many were closed? Any notable patterns in the mix of work types or assets involved?

4. **Follow-up work orders** — fetch any open work orders of type FO (follow-up). These signal unresolved issues that needed a second pass.

Summarize your findings in plain language a maintenance manager would understand. Flag anything that looks urgent or out of the ordinary.`,
            ]),
          },
        },
      ],
    }),
  )

  server.prompt(
    'mc_open_work_order_backlog',
    'Analyze the full backlog of open work orders by type and priority to understand where effort is concentrated.',
    {
      ...repairCenterArgsSchema,
      ...workOrderTypeArgSchema,
    },
    (args: BacklogArgs) => {
      const scopedType = cleanArg(args.type)

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
                ]),
                buildRepairCenterInstructions({
                  args,
                  scopeLabel: 'all relevant work-order queries',
                  resolutionSampleLabel: 'work orders or assets',
                }),
                buildTypeInstructions(scopedType),
                scopedType
                  ? `Pull the open ${scopedType} work order backlog and analyze it.

Focus only on open work orders of type "${scopedType}".

Summarize:
- How many open work orders of this type exist?
- What is the priority distribution (0=Emergency, 2=Normal, 3=Low)?
- How many are unassigned?
- Are any notably old based on when they were opened?
- Which assets or locations appear most often?

Close with a one-paragraph executive summary about whether this specific backlog looks healthy or needs attention.`
                  : `Pull the full open work order backlog and analyze it. Walk through each work order type by fetching open work and separating it into the types present in the data.

For each type present in the data:
- How many open work orders exist?
- What is the priority distribution (0=Emergency, 2=Normal, 3=Low)?
- How many are unassigned?
- Are any overdue or notably old based on when they were opened?

After the per-type breakdown, give me a one-paragraph executive summary: where is the backlog concentrated, and what should the team focus on first?`,
              ]),
            },
          },
        ],
      }
    },
  )

  server.prompt(
    'mc_unassigned_work_orders',
    'Show all open work orders that have not been assigned to a technician, sorted by priority.',
    {
      ...repairCenterArgsSchema,
      ...workOrderTypeArgSchema,
    },
    (args: BacklogArgs) => {
      const scopedType = cleanArg(args.type)

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
                  CONTEXT_INSTRUCTIONS.assetLocations,
                ]),
                buildRepairCenterInstructions({
                  args,
                  scopeLabel: 'all relevant work-order queries',
                  resolutionSampleLabel: 'work orders or assets',
                }),
                buildTypeInstructions(scopedType),
                scopedType
                  ? `Fetch open, unassigned work orders of type "${scopedType}", sorted by priority (lowest number = highest urgency).

List each work order with:
- ID and reason/description
- Priority (0=Emergency, 2=Normal, 3=Low)
- Asset name and location (if available)
- Date opened

Group the results by priority. For any Priority 0 items, call them out explicitly at the top of your response.

Finish with a concise summary of how many unassigned "${scopedType}" work orders exist and whether they appear manageable or risky.`
                  : `Fetch all open, unassigned work orders, sorted by priority.

List each work order with:
- ID and reason/description
- Type (CM, PM, IN, SR, etc.)
- Priority (0=Emergency, 2=Normal, 3=Low)
- Asset name and location (if available)
- Date opened

Group the results by priority. For any Priority 0 items, call them out explicitly at the top of your response because they need immediate attention.

Finish with a count summary: how many unassigned WOs by type and priority.`,
              ]),
            },
          },
        ],
      }
    },
  )

  server.prompt(
    'mc_emergency_work_orders',
    'Surface all open emergency (Priority 0) work orders that require immediate response.',
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
                CONTEXT_INSTRUCTIONS.assetLocations,
              ]),
              buildRepairCenterInstructions({
                args,
                scopeLabel: 'all relevant work-order queries',
                resolutionSampleLabel: 'work orders or assets',
              }),
              `Fetch all open work orders at Priority 0 (Emergency / Immediate Response).

For each one, tell me:
- Work order ID and reason/description
- Type (CM, IN, SR, etc.)
- Asset involved (name, ID, location if available)
- Date opened — how many days has this been open?
- Whether it is assigned (IsAssigned) and to whom if that field is populated

If there are no open emergency work orders, say so clearly — that is a good sign worth noting.

Close with a plain-language assessment: is the emergency situation under control, or are there items that have been sitting open too long?`,
            ]),
          },
        },
      ],
    }),
  )
}

function buildTypeInstructions(workOrderType?: string): string | undefined {
  if (!workOrderType) {
    return undefined
  }

  return `Focus only on work orders of type "${workOrderType}". Do not broaden the analysis to other work order types unless you first explain why the scope could not be applied.`
}
