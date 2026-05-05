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
        'List assets from Maintenance Connection, including both equipment and structural location records. Useful for hierarchy, equipment health, and site-orientation analysis.',
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
      description: 'Get full details for one asset using its internal Maintenance Connection record number.',
      inputSchema: {
        pk: z.number().int().positive().describe('Internal Maintenance Connection record number for the asset.'),
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
