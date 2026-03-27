import { z } from 'zod';
import { odataShape } from '@/shared/odata.js';
import { toToolText, toToolError } from '@/shared/response.js';
export function register(server, client) {
    server.registerTool('mc_list_parts', {
        description: 'List parts (inventory items) from Maintenance Connection. Supports OData filtering, sorting, and pagination. Use $filter to narrow by status, category, vendor, or any part field.',
        inputSchema: { ...odataShape },
    }, async (input) => {
        try {
            // TODO: replace with PartListSchema.parse() once confirmed against live API
            const data = await client.get('/Parts', { params: input });
            return toToolText(data);
        }
        catch (err) {
            return toToolError(err);
        }
    });
    server.registerTool('mc_get_part', {
        description: 'Get full details for a single part by its primary key (PK).',
        inputSchema: {
            pk: z.number().int().positive().describe('The part primary key (PK integer)'),
        },
    }, async ({ pk }) => {
        try {
            // TODO: replace with PartListSchema.parse() once confirmed against live API
            const data = await client.get(`/Parts/${pk}`);
            return toToolText(data);
        }
        catch (err) {
            return toToolError(err);
        }
    });
}
