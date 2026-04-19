import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { toToolText } from '@/shared/response.js'
import { DATASETS, DATASETS_TRANSITION_NOTE } from '@/shared/datasets.js'

export function register(server: McpServer): void {
  server.registerTool(
    'mc_list_datasets',
    {
      description:
        'List all available Maintenance Connection data sets and the tools used to query them. Transitional compatibility tool: prefer the mc://context/datasets resource when the MCP client supports resources. ' +
        DATASETS_TRANSITION_NOTE,
    },
    async () => toToolText(DATASETS),
  )
}
