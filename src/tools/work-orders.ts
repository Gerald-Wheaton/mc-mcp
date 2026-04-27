import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { odataShape } from '@/shared/odata.js'
import { toToolText, toListToolText, toToolError } from '@/shared/response.js'
import { WorkOrderSummarySchema, McApiResponseSchema } from '@/shared/types.js'

const WorkOrderListSchema = McApiResponseSchema(WorkOrderSummarySchema)

export function register(server: McpServer, client: McClient): void {
  server.registerTool(
    'mc_list_work_orders',
    {
      description:
        'List work orders from Maintenance Connection. ' +
        'Type codes: CM=Corrective Maintenance, IN=Inspection, PM=Preventive Maintenance, SR=Service Request, CAP=Capital Project, ADMN=Administration, FO=Follow-up, PC=Part Checkout. ' +
        'Status codes: ISSUED, CLOSED, REQUESTED, CANCELED. ' +
        'Priority codes: 0=Emergency, 2=Normal, 3=Low. ' +
        'Filterable boolean fields: IsOpen, IsAssigned, IsPartsReserved, IsFollowupWork. ' +
        'PM records have PMRef populated; non-PMs have PMRef=null.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const raw = await client.get('/workorders', { params: input })
        const data = WorkOrderListSchema.parse(raw)
        return toListToolText(data, input.$skip ?? 0)
      } catch (err) {
        return toToolError(err)
      }
    },
  )

  server.registerTool(
    'mc_get_work_order',
    {
      description: 'Get full details for a single work order by its primary key (PK).',
      inputSchema: {
        pk: z.number().int().positive().describe('The work order primary key (PK integer)'),
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
