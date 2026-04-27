import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { odataShape } from '@/shared/odata.js'
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
        'List purchase orders from Maintenance Connection. ' +
        'Status codes: ISSUED, REQUESTED, CANCELED, CLOSED. ' +
        'Filterable boolean fields: IsOpen, IsPartsOrdered. ' +
        'Key cost fields: Total, Subtotal, FreightCharge, TaxAmount, Discount. ' +
        'Key refs: VendorRef, RequesterRef, BuyerRef, DepartmentRef. ' +
        'ShippingInfo and BillingInfo contain address/freight details (mostly null). ' +
        'SubStatusDetails can carry integration codes (e.g. "UB"=Updated with Banner PO). ' +
        'NOTE: Filter by status using the Status field (not StatusDetails/Value) — values: ISSUED, REQUESTED, CANCELED, CLOSED. ' +
        'NOTE: Line items are a separate resource — use mc_list_po_line_items to get parts ordered on a PO.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const raw = await client.get('/purchaseorders', { params: input })
        const data = PurchaseOrderListSchema.parse(raw)
        return toListToolText(data, input.$skip ?? 0)
      } catch (err) {
        return toToolError(err)
      }
    },
  )

  server.registerTool(
    'mc_get_purchase_order',
    {
      description: 'Get full details for a single purchase order by its primary key (PK).',
      inputSchema: {
        pk: z.number().int().positive().describe('The purchase order primary key (PK integer)'),
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
        'List purchase order line items from Maintenance Connection. ' +
        'Each line item is one part/item ordered on a PO, with quantities ordered, received, backordered, and canceled. ' +
        'Filter by PurchaseOrderPK to get all line items for a specific PO. ' +
        'Also filterable by PartRef/PK to find all POs that ordered a specific part. ' +
        'Key fields: PartRef, OrderUnitQty, OrderUnitQtyReceived, OrderUnitQtyBackOrdered, OrderUnitPrice, LineItemTotal, WorkOrderRef, AssetRef.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const raw = await client.get('/PurchaseOrderLineItems', { params: input })
        const data = PurchaseOrderLineItemListSchema.parse(raw)
        return toListToolText(data, input.$skip ?? 0)
      } catch (err) {
        return toToolError(err)
      }
    },
  )
}
