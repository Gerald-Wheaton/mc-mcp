import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '../mc-client.js'
import { odataShape } from '../shared/odata.js'
import { toToolText, toToolError } from '../shared/response.js'
import type { McApiResponse, PartSummary } from '../shared/types.js'

export function register(server: McpServer, client: McClient): void {
  server.tool(
    'mc_list_parts',
    'List parts (inventory items) from Maintenance Connection. Supports OData filtering, sorting, and pagination. Use $filter to narrow by status, category, vendor, or any part field.',
    { ...odataShape },
    async (input) => {
      try {
        const data = await client.get<McApiResponse<PartSummary>>('/Parts', {
          params: input,
        })
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )

  server.tool(
    'mc_get_part',
    'Get full details for a single part by its primary key (PK).',
    {
      pk: z.number().int().positive().describe('The part primary key (PK integer)'),
    },
    async ({ pk }) => {
      try {
        const data = await client.get<PartSummary>(`/Parts/${pk}`)
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )
}
