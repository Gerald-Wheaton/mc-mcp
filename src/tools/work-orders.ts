import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { odataShape } from '@/shared/odata.js'
import { toToolText, toToolError } from '@/shared/response.js'
import { WorkOrderSummarySchema, McApiResponseSchema } from '@/shared/types.js'

const WorkOrderListSchema = McApiResponseSchema(WorkOrderSummarySchema)

export function register(server: McpServer, client: McClient): void {
  server.registerTool(
    'mc_list_work_orders',
    {
      description:
        'List work orders from Maintenance Connection. 645 total records. ' +
        'Type codes (filter: Type eq "CM"): CM=Corrective Maintenance (77), IN=Inspection (228), PM=Preventive Maintenance (299), SR=Service Request (5), CAP=Capital Project (29), ADMN=Administration (3), FO=Follow-up (2), PC=Part Checkout (2). ' +
        'Status codes: ISSUED (531), CLOSED (86), REQUESTED (26), CANCELED (2). ' +
        'Priority codes: 0=Emergency, 2=Normal, 3=Low. ' +
        'Useful boolean filters: IsOpen eq true (557), IsAssigned eq true (263), IsPartsReserved eq true (381), IsFollowupWork eq true (7). ' +
        'String filters use double quotes: Type eq "CM", StatusDetails/Value eq "CLOSED". ' +
        'PM records have PMRef populated; non-PMs have PMRef=null.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const raw = await client.get('/workorders', { params: input })
        const data = WorkOrderListSchema.parse(raw)
        return toToolText(data)
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
