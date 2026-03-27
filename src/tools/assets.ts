import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { odataShape } from '@/shared/odata.js'
import { toToolText, toToolError } from '@/shared/response.js'
import { AssetSummarySchema, McApiResponseSchema } from '@/shared/types.js'

const AssetListSchema = McApiResponseSchema(AssetSummarySchema)

export function register(server: McpServer, client: McClient): void {
  server.registerTool(
    'mc_list_assets',
    {
      description:
        'List assets (equipment and facilities) from Maintenance Connection. 33,639 total records in a hierarchy. Use IsLocation eq false to return equipment only. Use AssetLevel eq 2 for campus-level nodes. String filters require double quotes: ID eq "AC001/001", Name eq "Air Compressor". Boolean filters: IsLocation eq false, IsUp eq true.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const raw = await client.get('/Assets', { params: input })
        const data = AssetListSchema.parse(raw)
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )

  server.registerTool(
    'mc_get_asset',
    {
      description: 'Get full details for a single asset by its primary key (PK).',
      inputSchema: {
        pk: z.number().int().positive().describe('The asset primary key (PK integer)'),
      },
    },
    async ({ pk }) => {
      try {
        const raw = await client.get(`/Assets/${pk}`)
        const data = AssetListSchema.parse(raw)
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )
}
