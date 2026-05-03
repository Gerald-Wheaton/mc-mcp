import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { odataShape, FETCH_ALL_CAP } from '@/shared/odata.js'
import { toToolText, toListToolText, toToolError } from '@/shared/response.js'
import { PartSummarySchema, McApiResponseSchema } from '@/shared/types.js'

const PartListSchema = McApiResponseSchema(PartSummarySchema)

const DEFAULT_TOP = 200

export function register(server: McpServer, client: McClient): void {
  server.registerTool(
    'mc_list_parts',
    {
      description:
        'List part master records from Maintenance Connection. Best for catalog reviews, requester availability, pricing, category coverage, and slow-moving inventory analysis.',
      inputSchema: { ...odataShape },
    },
    async (input) => {
      try {
        const { $fetchAll, ...params } = input
        if ($fetchAll) {
          const raw = await client.getAllPages('/Parts', { params: { ...params, $top: FETCH_ALL_CAP } })
          const data = PartListSchema.parse(raw)
          return toListToolText(data, 0, { fetchedAll: true, cappedAt: FETCH_ALL_CAP })
        }
        if (params.$top === undefined) {
          params.$top = DEFAULT_TOP
        }
        const raw = await client.get('/Parts', { params })
        const data = PartListSchema.parse(raw)
        return toListToolText(data, params.$skip ?? 0)
      } catch (err) {
        return toToolError(err)
      }
    },
  )

  server.registerTool(
    'mc_get_part',
    {
      description: 'Get full details for one part using its internal Maintenance Connection record number.',
      inputSchema: {
        pk: z.number().int().positive().describe('Internal Maintenance Connection record number for the part.'),
      },
    },
    async ({ pk }) => {
      try {
        const raw = await client.get(`/Parts/${pk}`)
        const data = PartListSchema.parse(raw)
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )
}
