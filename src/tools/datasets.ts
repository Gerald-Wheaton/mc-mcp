import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { toToolText } from '@/shared/response.js'
import { DATASETS } from '@/shared/datasets.js'

export function register(server: McpServer): void {
  server.registerTool(
    'mc_list_datasets',
    {
      description:
        'List the main Maintenance Connection data groups available through this server and the tools used to explore each one.',
    },
    async () => toToolText(DATASETS),
  )
}
