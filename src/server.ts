import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { ServerConfig } from '@/config.js'
import { McClient } from '@/mc-client.js'
import { register as registerContextResources } from '@/resources/context.js'
import { register as registerPing } from '@/tools/ping.js'
import { register as registerDatasets } from '@/tools/datasets.js'
import { register as registerWorkOrders } from '@/tools/work-orders.js'
import { register as registerAssets } from '@/tools/assets.js'
import { register as registerParts } from '@/tools/parts.js'
import { register as registerPurchaseOrders } from '@/tools/purchase-orders.js'
import { register as registerOperationalPrompts } from '@/prompts/operational.js'
import { register as registerAssetPrompts } from '@/prompts/assets.js'
import { register as registerInventoryPrompts } from '@/prompts/inventory.js'
import { register as registerPmPrompts } from '@/prompts/pm.js'
import { register as registerProcurementPrompts } from '@/prompts/procurement.js'

interface Session {
  server: McpServer
  transport: StreamableHTTPServerTransport
}

export interface HttpRequestRoute {
  action:
    | 'health'
    | 'not-found'
    | 'method-not-allowed'
    | 'unauthorized'
    | 'missing-session'
    | 'session-not-found'
    | 'create-session'
    | 'reuse-session'
  status?: number
  body?: { error: string }
}

export function createHttpServer(config: ServerConfig): Server {
  const sessions = new Map<string, Session>()

  function createSession(mcBasicAuth: string): StreamableHTTPServerTransport {
    const client = new McClient({ baseUrl: config.mcBaseUrl, basicAuth: mcBasicAuth })
    const server = buildMcpServer(client)

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { server, transport })
      },
    })
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId)
    }

    server.connect(transport)
    return transport
  }

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? ''
    const method = req.method ?? ''

    const start = Date.now()
    res.on('finish', () => {
      const sid = (req.headers['mcp-session-id'] as string | undefined)?.slice(0, 8) ?? 'new'
      console.log(
        `[http] ${method} ${url} session=${sid} → ${res.statusCode} in ${Date.now() - start}ms`,
      )
    })

    const route = routeHttpRequest({
      url,
      method,
      hasCredentials: Boolean(req.headers['x-mc-basic-auth']),
      sessionId: req.headers['mcp-session-id'] as string | undefined,
      sessionExists: (req.headers['mcp-session-id'] as string | undefined)
        ? sessions.has(req.headers['mcp-session-id'] as string)
        : false,
    })

    if (route.action === 'health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
      return
    }

    if (route.action === 'unauthorized') {
      resolve401(res)
      return
    }

    if (route.status) {
      res.writeHead(route.status, route.body ? { 'Content-Type': 'application/json' } : undefined)
      res.end(route.body ? JSON.stringify(route.body) : undefined)
      return
    }

    let parsedBody: unknown
    if (method === 'POST') {
      const raw = await readBody(req)
      try {
        parsedBody = parseJsonBody(raw)
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid JSON body' }))
        return
      }
    }

    const mcBasicAuth = req.headers['x-mc-basic-auth'] as string
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    const transport =
      route.action === 'reuse-session'
        ? sessions.get(sessionId as string)?.transport
        : createSession(mcBasicAuth)

    if (!transport) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Session not found' }))
      return
    }

    await transport.handleRequest(req, res, parsedBody)
  })
}

export function buildMcpServer(client: McClient): McpServer {
  const server = new McpServer(
    { name: 'mc-mcp', version: '0.1.0' },
    {
      instructions:
        'This is an MCP server connected to Maintenance Connection, a CMMS — use it to answer questions about assets, work orders, PMs, parts, and purchase orders.',
    },
  )

  registerContextResources(server, client)
  registerPing(server, client)
  registerDatasets(server)
  registerWorkOrders(server, client)
  registerAssets(server, client)
  registerParts(server, client)
  registerPurchaseOrders(server, client)
  registerOperationalPrompts(server)
  registerAssetPrompts(server)
  registerInventoryPrompts(server)
  registerPmPrompts(server)
  registerProcurementPrompts(server)

  return server
}

export function routeHttpRequest(input: {
  url: string
  method: string
  hasCredentials: boolean
  sessionId?: string
  sessionExists: boolean
}): HttpRequestRoute {
  if (input.url === '/health' && input.method === 'GET') {
    return { action: 'health' }
  }

  if (input.url !== '/mcp') {
    return { action: 'not-found', status: 404 }
  }

  if (input.method !== 'POST' && input.method !== 'GET' && input.method !== 'DELETE') {
    return { action: 'method-not-allowed', status: 405 }
  }

  if (!input.hasCredentials) {
    return { action: 'unauthorized', status: 401, body: { error: 'Unauthorized' } }
  }

  if (input.sessionId) {
    if (!input.sessionExists) {
      return { action: 'session-not-found', status: 404, body: { error: 'Session not found' } }
    }
    return { action: 'reuse-session' }
  }

  if (input.method !== 'POST') {
    return { action: 'missing-session', status: 400, body: { error: 'Missing Mcp-Session-Id' } }
  }

  return { action: 'create-session' }
}

export function parseJsonBody(raw: string): unknown {
  if (!raw) {
    return undefined
  }

  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON body')
  }
}

function resolve401(res: ServerResponse): void {
  res.writeHead(401, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Unauthorized' }))
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}
