import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { toToolText, toToolError } from '@/shared/response.js'

const PROBES = ['/workorders', '/Assets', '/Parts'] as const

export function register(server: McpServer, client: McClient): void {
  server.registerTool(
    'mc_ping',
    {
      description:
        'Check connectivity and authentication to the Maintenance Connection API. ' +
        'Probes /workorders, /Assets, and /Parts in parallel. ' +
        'Returns status: ok (all healthy), status: degraded (some failed), or an error (all failed).',
    },
    async () => {
      const results = await Promise.allSettled(
        PROBES.map(async (path) => {
          const start = Date.now()
          await client.get(path, { params: { $top: 1 } })
          return { ms: Date.now() - start }
        }),
      )

      const endpoints: Record<string, unknown> = {}
      let allFailed = true
      let anyFailed = false

      for (let i = 0; i < PROBES.length; i++) {
        const r = results[i]
        if (r.status === 'fulfilled') {
          endpoints[PROBES[i]] = { ok: true, ms: r.value.ms }
          allFailed = false
        } else {
          endpoints[PROBES[i]] = {
            ok: false,
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          }
          anyFailed = true
        }
      }

      if (allFailed) {
        return toToolError(new Error('MC API is unreachable — all endpoint probes failed'))
      }

      return toToolText({ status: anyFailed ? 'degraded' : 'ok', endpoints })
    },
  )
}
