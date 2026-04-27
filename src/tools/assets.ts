import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { odataShape } from '@/shared/odata.js'
import { toToolText, toListToolText, toToolError } from '@/shared/response.js'
import { AssetSummarySchema, McApiResponseSchema } from '@/shared/types.js'

const AssetListSchema = McApiResponseSchema(AssetSummarySchema)

export function register(server: McpServer, client: McClient): void {
  server.registerTool(
    'mc_list_assets',
    {
      description:
        'List assets (equipment and facilities) from Maintenance Connection. Assets exist in a hierarchy. Filter to equipment only using IsLocation, or filter by hierarchy level using AssetLevel (2 = campus-level nodes). Filterable fields: ID, Name, IsLocation, IsUp, AssetLevel.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const raw = await client.get('/Assets', { params: input })
        const data = AssetListSchema.parse(raw)
        return toListToolText(data, input.$skip ?? 0)
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
