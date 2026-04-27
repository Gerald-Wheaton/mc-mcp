import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { odataShape, FETCH_ALL_CAP } from '@/shared/odata.js'
import { toToolText, toListToolText, toToolError } from '@/shared/response.js'
import { AssetSummarySchema, McApiResponseSchema } from '@/shared/types.js'

const AssetListSchema = McApiResponseSchema(AssetSummarySchema)

const DEFAULT_TOP = 100

export function register(server: McpServer, client: McClient): void {
  server.registerTool(
    'mc_list_assets',
    {
      description:
        'List assets (equipment and facilities) from Maintenance Connection. Assets exist in a hierarchy. Filter to equipment only using IsLocation, or filter by hierarchy level using AssetLevel (2 = campus-level nodes). Filterable fields: ID, Name, IsLocation, IsUp, AssetLevel. ' +
        'Default returns up to 100 records — narrow results before fetching more.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const { $fetchAll, ...params } = input
        if ($fetchAll) {
          const raw = await client.getAllPages('/Assets', { params: { ...params, $top: FETCH_ALL_CAP } })
          const data = AssetListSchema.parse(raw)
          return toListToolText(data, 0, { fetchedAll: true, cappedAt: FETCH_ALL_CAP })
        }
        if (params.$top === undefined) {
          params.$top = DEFAULT_TOP
        }
        const raw = await client.get('/Assets', { params })
        const data = AssetListSchema.parse(raw)
        return toListToolText(data, params.$skip ?? 0)
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
