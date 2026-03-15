import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '../mc-client.js'
import { odataShape } from '../shared/odata.js'
import { toToolText, toToolError } from '../shared/response.js'
import type { McApiResponse, PurchaseOrderSummary } from '../shared/types.js'

export function register(server: McpServer, client: McClient): void {
  server.tool(
    'mc_list_purchase_orders',
    'List purchase orders from Maintenance Connection. Supports OData filtering, sorting, and pagination. Use $filter to narrow by status, vendor, date, or any PO field.',
    { ...odataShape },
    async (input) => {
      try {
        const data = await client.get<McApiResponse<PurchaseOrderSummary>>('/purchaseorders', {
          params: input,
        })
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )

  server.tool(
    'mc_get_purchase_order',
    'Get full details for a single purchase order by its primary key (PK).',
    {
      pk: z.number().int().positive().describe('The purchase order primary key (PK integer)'),
    },
    async ({ pk }) => {
      try {
        const data = await client.get<PurchaseOrderSummary>(`/purchaseorders/${pk}`)
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )
}
