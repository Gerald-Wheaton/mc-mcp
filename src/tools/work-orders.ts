import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '../mc-client.js'
import { odataShape } from '../shared/odata.js'
import { toToolText, toToolError } from '../shared/response.js'
import type { McApiResponse, WorkOrderSummary } from '../shared/types.js'

export function register(server: McpServer, client: McClient): void {
  server.tool(
    'mc_list_work_orders',
    'List work orders from Maintenance Connection. Supports OData filtering, sorting, and pagination. Use $filter to narrow by status, asset, date range, or any WO field.',
    { ...odataShape },
    async (input) => {
      try {
        const data = await client.get<McApiResponse<WorkOrderSummary>>('/workorders', {
          params: input,
        })
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )

  server.tool(
    'mc_get_work_order',
    'Get full details for a single work order by its primary key (PK).',
    {
      pk: z.number().int().positive().describe('The work order primary key (PK integer)'),
    },
    async ({ pk }) => {
      try {
        const data = await client.get<WorkOrderSummary>(`/workorders/${pk}`)
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )
}
