// fallow-ignore-file unused-file
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createMcpHarness } from './helpers/mcp-harness.ts'
import { parseJsonBody, routeHttpRequest } from '../src/server.ts'

describe('server request routing', () => {
  test('allows the health check without credentials', () => {
    expect(
      routeHttpRequest({
        url: '/health',
        method: 'GET',
        hasCredentials: false,
        sessionExists: false,
      }),
    ).toEqual({ action: 'health' })
  })

  test('rejects unauthorized MCP requests', () => {
    expect(
      routeHttpRequest({
        url: '/mcp',
        method: 'POST',
        hasCredentials: false,
        sessionExists: false,
      }),
    ).toEqual({
      action: 'unauthorized',
      status: 401,
      body: { error: 'Unauthorized' },
    })
  })

  test('rejects GET requests without a session id', () => {
    expect(
      routeHttpRequest({
        url: '/mcp',
        method: 'GET',
        hasCredentials: true,
        sessionExists: false,
      }),
    ).toEqual({
      action: 'missing-session',
      status: 400,
      body: { error: 'Missing Mcp-Session-Id' },
    })
  })

  test('rejects unknown sessions', () => {
    expect(
      routeHttpRequest({
        url: '/mcp',
        method: 'POST',
        hasCredentials: true,
        sessionId: 'missing',
        sessionExists: false,
      }),
    ).toEqual({
      action: 'session-not-found',
      status: 404,
      body: { error: 'Session not found' },
    })
  })

  test('parses JSON request bodies and rejects invalid JSON', () => {
    expect(parseJsonBody('{"ok":true}')).toEqual({ ok: true })
    expect(parseJsonBody('')).toBeUndefined()
    expect(() => parseJsonBody('{')).toThrow('Invalid JSON body')
  })
})

describe('MCP integration contract', () => {
  let harness: Awaited<ReturnType<typeof createMcpHarness>>

  beforeEach(async () => {
    harness = await createMcpHarness()
  })

  afterEach(async () => {
    await harness.close()
  })

  test('exposes tools, prompts, and resources over MCP initialize', async () => {
    const tools = await harness.client.listTools()
    const prompts = await harness.client.listPrompts()
    const resources = await harness.client.listResources()

    expect(tools.tools.map((tool) => tool.name)).toEqual([
      'mc_ping',
      'mc_list_datasets',
      'mc_list_work_orders',
      'mc_get_work_order',
      'mc_list_assets',
      'mc_get_asset',
      'mc_list_parts',
      'mc_get_part',
      'mc_list_purchase_orders',
      'mc_get_purchase_order',
      'mc_list_po_line_items',
    ])
    expect(prompts.prompts).toHaveLength(14)
    expect(resources.resources.map((resource) => resource.uri)).toEqual([
      'mc://context/time',
      'mc://context/datasets',
      'mc://context/summary',
      'mc://context/labors',
      'mc://context/asset-locations',
      'mc://context/lookup-tables',
    ])
  })

  test('reads static resources and prompt templates through the MCP contract', async () => {
    const datasets = await harness.client.readResource({
      uri: 'mc://context/datasets',
    })
    const time = await harness.client.readResource({
      uri: 'mc://context/time',
    })
    const prompt = await harness.client.getPrompt({
      name: 'mc_asset_health_check',
      arguments: { asset_name: 'AHU-12' },
    })

    const datasetText = datasets.contents[0]?.text
    const timeText = time.contents[0]?.text
    const promptText = prompt.messages[0]?.content.type === 'text' ? prompt.messages[0].content.text : ''

    expect(datasetText).toBeTruthy()
    expect(JSON.parse(datasetText ?? '{}')).toEqual(
      expect.objectContaining({
        preferredInterface: 'mc://context/datasets',
      }),
    )
    expect(JSON.parse(timeText ?? '{}')).toEqual(
      expect.objectContaining({
        timezone: expect.any(String),
        today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    expect(promptText).toContain('Read mc://context/time before querying tools')
    expect(promptText).toContain('Resolve the target asset before the main analysis')
    expect(promptText).toContain('"AHU-12"')
  })

  test('fails fast on invalid prompt argument combinations', async () => {
    await expect(
      harness.client.getPrompt({
        name: 'mc_open_purchase_orders',
        arguments: {
          repair_center_id: 'M',
          repair_center_name: 'Main Campus',
        },
      }),
    ).rejects.toThrow('Provide only one repair center input')
  })
})
