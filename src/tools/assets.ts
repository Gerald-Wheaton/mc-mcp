import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '../mc-client.js'
import { odataShape } from '../shared/odata.js'
import { toToolText, toToolError } from '../shared/response.js'
import type { McApiResponse, AssetSummary } from '../shared/types.js'

export function register(server: McpServer, client: McClient): void {
  server.tool(
    'mc_list_assets',
    'List assets (equipment and facilities) from Maintenance Connection. Supports OData filtering, sorting, and pagination. Use $filter to narrow by status, classification, location, or any asset field.',
    { ...odataShape },
    async (input) => {
      try {
        const data = await client.get<McApiResponse<AssetSummary>>('/Assets', {
          params: input,
        })
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )

  server.tool(
    'mc_get_asset',
    'Get full details for a single asset by its primary key (PK).',
    {
      pk: z.number().int().positive().describe('The asset primary key (PK integer)'),
    },
    async ({ pk }) => {
      try {
        const data = await client.get<AssetSummary>(`/Assets/${pk}`)
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )
}
