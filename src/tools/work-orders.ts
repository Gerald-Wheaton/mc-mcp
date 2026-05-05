import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { odataShape, FETCH_ALL_CAP } from '@/shared/odata.js'
import { toToolText, toListToolText, toToolError } from '@/shared/response.js'
import { WorkOrderSummarySchema, McApiResponseSchema } from '@/shared/types.js'

const WorkOrderListSchema = McApiResponseSchema(WorkOrderSummarySchema)

export function register(server: McpServer, client: McClient): void {
  server.registerTool(
    'mc_list_work_orders',
    {
      description:
        'List work orders from Maintenance Connection. Useful for backlog, assignment, priority, status, repair-center, and asset-focused maintenance analysis.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const { $fetchAll, ...params } = input
        if ($fetchAll) {
          const raw = await client.getAllPages('/workorders', { params: { ...params, $top: FETCH_ALL_CAP } })
          const data = WorkOrderListSchema.parse(raw)
          return toListToolText(data, 0, { fetchedAll: true, cappedAt: FETCH_ALL_CAP })
        }
        const raw = await client.get('/workorders', { params })
        const data = WorkOrderListSchema.parse(raw)
        return toListToolText(data, params.$skip ?? 0)
      } catch (err) {
        return toToolError(err)
      }
    },
  )

  server.registerTool(
    'mc_get_work_order',
    {
      description: 'Get full details for one work order using its internal Maintenance Connection record number.',
      inputSchema: {
        pk: z.number().int().positive().describe('Internal Maintenance Connection record number for the work order.'),
      },
    },
    async ({ pk }) => {
      try {
        const raw = await client.get(`/workorders/${pk}`)
        const data = WorkOrderListSchema.parse(raw)
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )
}
