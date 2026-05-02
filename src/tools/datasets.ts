import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { toToolText } from '@/shared/response.js'
import { DATASETS } from '@/shared/datasets.js'

export function register(server: McpServer): void {
  server.registerTool(
    'mc_list_datasets',
    {
      description:
        'List all available Maintenance Connection data sets and the tools used to query them. ' +
        'Prefer the mc://context/datasets resource when the MCP client supports resources.',
    },
    async () => toToolText(DATASETS),
  )
}
