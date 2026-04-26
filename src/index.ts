import { loadConfig } from '@/config.js'
import { createHttpServer } from '@/server.js'

const config = loadConfig()
const httpServer = createHttpServer(config)

httpServer.listen(config.port, () => {
  console.log(`mc-mcp listening on port ${config.port}`)
})
