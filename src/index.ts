import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from './config.js'
import { McClient } from './mc-client.js'
import { register as registerPing } from './tools/ping.js'
import { register as registerWorkOrders } from './tools/work-orders.js'
import { register as registerAssets } from './tools/assets.js'
import { register as registerParts } from './tools/parts.js'
import { register as registerPurchaseOrders } from './tools/purchase-orders.js'

const config = loadConfig()
const client = new McClient(config)

const server = new McpServer({
  name: 'mc-mcp',
  version: '0.1.0',
})

// Register tool domains — add new domains here as one import + one line
registerPing(server, client)
registerWorkOrders(server, client)
registerAssets(server, client)
registerParts(server, client)
registerPurchaseOrders(server, client)

await server.connect(new StdioServerTransport())
