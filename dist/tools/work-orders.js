import { z } from 'zod';
import { odataShape } from '@/shared/odata.js';
import { toToolText, toToolError } from '@/shared/response.js';
import { WorkOrderSummarySchema, McApiResponseSchema } from '@/shared/types.js';
const WorkOrderListSchema = McApiResponseSchema(WorkOrderSummarySchema);
export function register(server, client) {
    server.registerTool('mc_list_work_orders', {
        description: 'List work orders from Maintenance Connection. Each result includes TypeDetails.Value (CM=Corrective, PM=Preventive, SR=Service Request, PC=Part Checkout) and StatusDetails.Value. Supports OData boolean/null filters (e.g. IsOpen eq true, IsAssigned eq false) and pagination.',
        inputSchema: { ...odataShape },
    }, async (input) => {
        try {
            const raw = await client.get('/workorders', { params: input });
            const data = WorkOrderListSchema.parse(raw);
            return toToolText(data);
        }
        catch (err) {
            return toToolError(err);
        }
    });
    server.registerTool('mc_get_work_order', {
        description: 'Get full details for a single work order by its primary key (PK).',
        inputSchema: {
            pk: z.number().int().positive().describe('The work order primary key (PK integer)'),
        },
    }, async ({ pk }) => {
        try {
            const raw = await client.get(`/workorders/${pk}`);
            const data = WorkOrderListSchema.parse(raw);
            return toToolText(data);
        }
        catch (err) {
            return toToolError(err);
        }
    });
}
