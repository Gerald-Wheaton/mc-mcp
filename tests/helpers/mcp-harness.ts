import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McClient } from '../../src/mc-client.ts'
import { buildMcpServer } from '../../src/server.ts'

export async function createMcpHarness(
  clientImplementation: McClient = new McClient({
    baseUrl: 'https://example.mc.test/v8',
    basicAuth: 'test-basic-auth',
  }),
) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  // Do not pre-set clientSide.sessionId: the SDK client treats a transport with a
  // sessionId as a reconnect and skips the initialize handshake, which would leave
  // server-delivered instructions and capabilities unpopulated in these tests.
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
