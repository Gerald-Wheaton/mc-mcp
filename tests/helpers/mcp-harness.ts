// fallow-ignore-file unused-file
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McClient } from '../../src/mc-client.ts'
import { buildMcpServer } from '../../src/server.ts'

// fallow-ignore-next-line unused-export
export async function createMcpHarness(
  clientImplementation: McClient = new McClient({
    baseUrl: 'https://example.mc.test/v8',
    basicAuth: 'test-basic-auth',
  }),
) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  clientSide.sessionId = 'test-session'
  serverSide.sessionId = 'test-session'

  const server = buildMcpServer(clientImplementation)
  const client = new Client({
    name: 'mc-mcp-test-client',
    version: '1.0.0',
  })

  await server.connect(serverSide)
  await client.connect(clientSide)

  return {
    client,
    async close() {
      await clientSide.close()
      await serverSide.close()
    },
  }
}
