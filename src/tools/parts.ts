import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { odataShape, FETCH_ALL_CAP } from '@/shared/odata.js'
import { toToolText, toListToolText, toToolError } from '@/shared/response.js'
import { PartSummarySchema, McApiResponseSchema } from '@/shared/types.js'

const PartListSchema = McApiResponseSchema(PartSummarySchema)

const DEFAULT_TOP = 200

export function register(server: McpServer, client: McClient): void {
  server.registerTool(
    'mc_list_parts',
    {
      description:
        'List parts (inventory items) from Maintenance Connection. ' +
        'Filterable boolean fields: Active, DirectIssue, AvailableToRequester. ' +
        'CostRuleDetails.Value codes: S=Standard Cost, AVG=Average Cost. ' +
        'IssueUnitsDetails.Value: E=Each. ' +
        'IMPORTANT: Quantity-on-hand, on-order, reserved, and reorder fields are NOT on this endpoint — use PartLocations for stock levels. ' +
        'Key fields: Name, ID, InternalPartNumber, PartDescription, IssueUnitCost, LastOrderUnitPrice, LastOrdered, LastIssued, CategoryRef, ClassificationRef. ' +
        'Default returns up to 200 records — add filters to narrow results, or fetch the full catalog.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const { $fetchAll, ...params } = input
        if ($fetchAll) {
          const raw = await client.getAllPages('/Parts', { params: { ...params, $top: FETCH_ALL_CAP } })
          const data = PartListSchema.parse(raw)
          return toListToolText(data, 0, { fetchedAll: true, cappedAt: FETCH_ALL_CAP })
        }
        if (params.$top === undefined) {
          params.$top = DEFAULT_TOP
        }
        const raw = await client.get('/Parts', { params })
        const data = PartListSchema.parse(raw)
        return toListToolText(data, params.$skip ?? 0)
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
