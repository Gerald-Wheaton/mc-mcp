import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { toToolText, toToolError } from '@/shared/response.js'

export function register(server: McpServer, client: McClient): void {
  server.registerTool(
    'mc_ping',
    {
      description:
        'Check connectivity and authentication to the Maintenance Connection API. Returns a success message if the API is reachable and credentials are valid.',
    },
    async () => {
      try {
        // No dedicated health endpoint — a minimal workorders query confirms both
        // connectivity and auth without pulling meaningful data
        await client.get('/workorders', { params: { $top: 1 } })
        return toToolText('MC API is reachable and credentials are valid.')
      } catch (err) {
        return toToolError(err)
      }
    },
  )
}
