import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { odataShape } from '@/shared/odata.js'
import { toToolText, toToolError } from '@/shared/response.js'
import { PartSummarySchema, McApiResponseSchema } from '@/shared/types.js'

const PartListSchema = McApiResponseSchema(PartSummarySchema)

export function register(server: McpServer, client: McClient): void {
  server.registerTool(
    'mc_list_parts',
    {
      description:
        'List parts (inventory items) from Maintenance Connection. ' +
        'Useful boolean filters: Active eq true, DirectIssue eq true, AvailableToRequester eq true. ' +
        'CostRuleDetails.Value codes: S=Standard Cost, AVG=Average Cost. ' +
        'IssueUnitsDetails.Value: E=Each. ' +
        'IMPORTANT: Quantity-on-hand, on-order, reserved, and reorder fields are NOT on this endpoint — use PartLocations for stock levels. ' +
        'Key fields: Name, ID, InternalPartNumber, PartDescription, IssueUnitCost, LastOrderUnitPrice, LastOrdered, LastIssued, CategoryRef, ClassificationRef. ' +
        'String filters use double quotes: ID eq "9429994", Name eq "Control Board".',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const raw = await client.get('/Parts', { params: input })
        const data = PartListSchema.parse(raw)
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )

  server.registerTool(
    'mc_get_part',
    {
      description: 'Get full details for a single part by its primary key (PK).',
      inputSchema: {
        pk: z.number().int().positive().describe('The part primary key (PK integer)'),
      },
    },
    async ({ pk }) => {
      try {
        const raw = await client.get(`/Parts/${pk}`)
        const data = PartListSchema.parse(raw)
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )
}
