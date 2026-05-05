import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { odataShape, FETCH_ALL_CAP } from '@/shared/odata.js'
import { toToolText, toListToolText, toToolError } from '@/shared/response.js'
import {
  PurchaseOrderSummarySchema,
  PurchaseOrderLineItemSummarySchema,
  McApiResponseSchema,
} from '@/shared/types.js'

const PurchaseOrderListSchema = McApiResponseSchema(PurchaseOrderSummarySchema)
const PurchaseOrderLineItemListSchema = McApiResponseSchema(PurchaseOrderLineItemSummarySchema)

export function register(server: McpServer, client: McClient): void {
  server.registerTool(
    'mc_list_purchase_orders',
    {
      description:
        'List purchase orders from Maintenance Connection. Useful for open commitments, approval-pipeline reviews, vendor activity, and purchase-order aging analysis.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const { $fetchAll, ...params } = input
        if ($fetchAll) {
          const raw = await client.getAllPages('/purchaseorders', { params: { ...params, $top: FETCH_ALL_CAP } })
          const data = PurchaseOrderListSchema.parse(raw)
          return toListToolText(data, 0, { fetchedAll: true, cappedAt: FETCH_ALL_CAP })
        }
        const raw = await client.get('/purchaseorders', { params })
        const data = PurchaseOrderListSchema.parse(raw)
        return toListToolText(data, params.$skip ?? 0)
      } catch (err) {
        return toToolError(err)
      }
    },
  )

  server.registerTool(
    'mc_get_purchase_order',
    {
      description: 'Get full details for one purchase order using its internal Maintenance Connection record number.',
      inputSchema: {
        pk: z.number().int().positive().describe('Internal Maintenance Connection record number for the purchase order.'),
      },
    },
    async ({ pk }) => {
      try {
        const raw = await client.get(`/purchaseorders/${pk}`)
        const data = PurchaseOrderListSchema.parse(raw)
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )

  server.registerTool(
    'mc_list_po_line_items',
    {
      description:
        'List purchase-order line items from Maintenance Connection so you can see what was ordered, how much was ordered, and what has already been received or backordered.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const { $fetchAll, ...params } = input
        if ($fetchAll) {
          const raw = await client.getAllPages('/PurchaseOrderLineItems', { params: { ...params, $top: FETCH_ALL_CAP } })
          const data = PurchaseOrderLineItemListSchema.parse(raw)
          return toListToolText(data, 0, { fetchedAll: true, cappedAt: FETCH_ALL_CAP })
        }
        const raw = await client.get('/PurchaseOrderLineItems', { params })
        const data = PurchaseOrderLineItemListSchema.parse(raw)
        return toListToolText(data, params.$skip ?? 0)
      } catch (err) {
        return toToolError(err)
      }
    },
  )
}
