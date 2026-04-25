import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { loadConfig } from '@/config.js'
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

// This repo uses NodeNext ESM. Local import specifiers intentionally end in
// `.js` even though the source files are `.ts`, because the emitted runtime
// files in `dist/` are JavaScript.

interface Session {
  server: McpServer
  transport: StreamableHTTPServerTransport
}

const config = loadConfig()
const sessions = new Map<string, Session>()

function createSession(mcBasicAuth: string): StreamableHTTPServerTransport {
  const client = new McClient({ baseUrl: config.mcBaseUrl, basicAuth: mcBasicAuth })
  const server = new McpServer({ name: 'mc-mcp', version: '0.1.0' })

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

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, { server, transport })
    },
    onsessionclosed: (id) => {
      sessions.delete(id)
    },
  })

  server.connect(transport)
  return transport
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

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url ?? ''
  const method = req.method ?? ''

  // Health check — no auth required
  if (url === '/health' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  // Only handle /mcp routes
  if (url !== '/mcp') {
    res.writeHead(404)
    res.end()
    return
  }

  if (method !== 'POST' && method !== 'GET' && method !== 'DELETE') {
    res.writeHead(405)
    res.end()
    return
  }

  // Require MC credentials on every request
  const mcBasicAuth = req.headers['x-mc-basic-auth'] as string | undefined
  if (!mcBasicAuth) {
    resolve401(res)
    return
  }

  // Route to existing session or create a new one
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  let transport: StreamableHTTPServerTransport | undefined

  if (sessionId) {
    transport = sessions.get(sessionId)?.transport
    if (!transport) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Session not found' }))
      return
    }
  } else {
    if (method !== 'POST') {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing Mcp-Session-Id' }))
      return
    }
    transport = createSession(mcBasicAuth)
  }

  // Parse body for POST requests
  let parsedBody: unknown
  if (method === 'POST') {
    const raw = await readBody(req)
    try {
      parsedBody = raw ? JSON.parse(raw) : undefined
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON body' }))
      return
    }
  }

  await transport.handleRequest(req, res, parsedBody)
})

httpServer.listen(config.port, () => {
  console.log(`mc-mcp listening on port ${config.port}`)
})
