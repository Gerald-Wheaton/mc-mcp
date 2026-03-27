import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { odataShape } from '@/shared/odata.js'
import { toToolText, toToolError } from '@/shared/response.js'
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
        'List purchase orders from Maintenance Connection. 74 total records. ' +
        'Status codes: ISSUED (54), REQUESTED (16), CANCELED (2), CLOSED (2). ' +
        'Useful boolean filters: IsOpen eq true (71/74), IsPartsOrdered eq true (55/74). ' +
        'Priority is always "2=Normal" for this customer — not a useful filter. ' +
        'Key cost fields: Total, Subtotal, FreightCharge, TaxAmount, Discount. ' +
        'Key refs: VendorRef, RequesterRef, BuyerRef, DepartmentRef. ' +
        'ShippingInfo and BillingInfo contain address/freight details (mostly null). ' +
        'SubStatusDetails can carry integration codes (e.g. "UB"=Updated with Banner PO). ' +
        'String filters use double quotes: Status eq "ISSUED", VendorRef/Name eq "North Point Toyota". ' +
        'NOTE: Status filter uses "Status" not "StatusDetails/Value" for POs. ' +
        'NOTE: Line items are a separate resource — use mc_list_po_line_items to get parts ordered on a PO.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const raw = await client.get('/purchaseorders', { params: input })
        const data = PurchaseOrderListSchema.parse(raw)
        return toToolText(data)
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
        'List purchase order line items from Maintenance Connection. 159 total records across 74 POs (~2 per PO on average). ' +
        'Each line item is one part/item ordered on a PO, with quantities ordered, received, backordered, and canceled. ' +
        'Key filter: PurchaseOrderPK eq {pk} — returns all lines for a specific PO. ' +
        'Also filterable by PartRef/PK to find all POs that ordered a specific part. ' +
        'Key fields: PartRef, OrderUnitQty, OrderUnitQtyReceived, OrderUnitQtyBackOrdered, OrderUnitPrice, LineItemTotal, WorkOrderRef, AssetRef. ' +
        'String filters use double quotes. Filter on PurchaseOrderPK (integer) does not need quotes: PurchaseOrderPK eq 1000.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const raw = await client.get('/PurchaseOrderLineItems', { params: input })
        const data = PurchaseOrderLineItemListSchema.parse(raw)
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )
}
