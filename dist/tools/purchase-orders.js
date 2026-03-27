import { z } from 'zod';
import { odataShape } from '@/shared/odata.js';
import { toToolText, toToolError } from '@/shared/response.js';
export function register(server, client) {
    server.registerTool('mc_list_purchase_orders', {
        description: 'List purchase orders from Maintenance Connection. Supports OData filtering, sorting, and pagination. Use $filter to narrow by status, vendor, date, or any PO field.',
        inputSchema: { ...odataShape },
    }, async (input) => {
        try {
            // TODO: replace with PurchaseOrderListSchema.parse() once confirmed against live API
            const data = await client.get('/purchaseorders', { params: input });
            return toToolText(data);
        }
        catch (err) {
            return toToolError(err);
        }
    });
    server.registerTool('mc_get_purchase_order', {
        description: 'Get full details for a single purchase order by its primary key (PK).',
        inputSchema: {
            pk: z.number().int().positive().describe('The purchase order primary key (PK integer)'),
        },
    }, async ({ pk }) => {
        try {
            // TODO: replace with PurchaseOrderListSchema.parse() once confirmed against live API
            const data = await client.get(`/purchaseorders/${pk}`);
            return toToolText(data);
        }
        catch (err) {
            return toToolError(err);
        }
    });
}
