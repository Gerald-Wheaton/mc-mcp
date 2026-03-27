import { z } from 'zod';
import { odataShape } from '@/shared/odata.js';
import { toToolText, toToolError } from '@/shared/response.js';
import { AssetSummarySchema, McApiResponseSchema } from '@/shared/types.js';
const AssetListSchema = McApiResponseSchema(AssetSummarySchema);
export function register(server, client) {
    server.registerTool('mc_list_assets', {
        description: 'List assets (equipment and facilities) from Maintenance Connection. Supports OData filtering, sorting, and pagination. Use $filter to narrow by status, classification, location, or any asset field.',
        inputSchema: { ...odataShape },
    }, async (input) => {
        try {
            const raw = await client.get('/Assets', { params: input });
            const data = AssetListSchema.parse(raw);
            return toToolText(data);
        }
        catch (err) {
            return toToolError(err);
        }
    });
    server.registerTool('mc_get_asset', {
        description: 'Get full details for a single asset by its primary key (PK).',
        inputSchema: {
            pk: z.number().int().positive().describe('The asset primary key (PK integer)'),
        },
    }, async ({ pk }) => {
        try {
            const raw = await client.get(`/Assets/${pk}`);
            const data = AssetListSchema.parse(raw);
            return toToolText(data);
        }
        catch (err) {
            return toToolError(err);
        }
    });
}
