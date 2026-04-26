import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { McApiError } from '../src/mc-client.ts'
import { FakeMcClient } from './helpers/fake-mc-client.ts'
import { createMcpHarness } from './helpers/mcp-harness.ts'

describe('tool handlers', () => {
  let fakeClient: FakeMcClient
  let harness: Awaited<ReturnType<typeof createMcpHarness>>

  beforeEach(async () => {
    fakeClient = new FakeMcClient()
    harness = await createMcpHarness(fakeClient as never)
  })

  afterEach(async () => {
    await harness.close()
  })

  test('mc_ping confirms connectivity with a minimal work order query', async () => {
    fakeClient.whenGet('/workorders', { Results: [], Total: 0 })

    const result = await harness.client.callTool({ name: 'mc_ping', arguments: {} })

    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'MC API is reachable and credentials are valid.',
    })
    expect(fakeClient.getCalls).toEqual([
      {
        path: '/workorders',
        params: { $top: 1 },
      },
    ])
  })

  test('mc_list_work_orders forwards OData params and returns parsed payloads', async () => {
    fakeClient.whenGet('/workorders', {
      Results: [
        {
          PK: 1001,
          ID: 'WO-1001',
          Reason: 'Replace failed blower motor',
          IsOpen: true,
          TypeDetails: { Value: 'CM', Description: 'Corrective Maintenance' },
          StatusDetails: { Value: 'ISSUED', Description: 'Issued' },
        },
      ],
      Total: 1,
    })

    const result = await harness.client.callTool({
      name: 'mc_list_work_orders',
      arguments: {
        $filter: 'IsOpen eq true',
        $top: 1,
      },
    })

    const text = expectText(result)
    const parsed = JSON.parse(text)

    expect(parsed.Total).toBe(1)
    expect(parsed.Results[0].ID).toBe('WO-1001')
    expect(fakeClient.getCalls.at(-1)).toEqual({
      path: '/workorders',
      params: { $filter: 'IsOpen eq true', $top: 1 },
    })
  })

  test('mc_get_asset uses the PK-specific endpoint', async () => {
    fakeClient.whenGet('/Assets/12', {
      Results: [
        {
          PK: 12,
          ID: 'AHU-12',
          Name: 'Air Handler 12',
          IsLocation: false,
          IsUp: true,
        },
      ],
      Total: 1,
    })

    const result = await harness.client.callTool({
      name: 'mc_get_asset',
      arguments: { pk: 12 },
    })

    expect(JSON.parse(expectText(result)).Results[0].Name).toBe('Air Handler 12')
    expect(fakeClient.getCalls.at(-1)).toEqual({
      path: '/Assets/12',
      params: undefined,
    })
  })

  test('mc_list_parts returns parsed part data', async () => {
    fakeClient.whenGet('/Parts', {
      Results: [
        {
          PK: 3001,
          ID: 'PT-3001',
          Name: 'Control Board',
          Active: true,
          IssueUnitCost: 89.5,
        },
      ],
      Total: 1,
    })

    const result = await harness.client.callTool({
      name: 'mc_list_parts',
      arguments: {
        $filter: 'Active eq true',
      },
    })

    expect(JSON.parse(expectText(result)).Results[0].Name).toBe('Control Board')
    expect(fakeClient.getCalls.at(-1)).toEqual({
      path: '/Parts',
      params: { $filter: 'Active eq true' },
    })
  })

  test('mc_list_purchase_orders and mc_list_po_line_items hit the expected endpoints', async () => {
    fakeClient.whenGet('/purchaseorders', {
      Results: [
        {
          PK: 4001,
          ID: 'PO-4001',
          IsOpen: true,
          Total: 1240.12,
          StatusDetails: { Value: 'ISSUED', Description: 'Issued' },
        },
      ],
      Total: 1,
    })
    fakeClient.whenGet('/PurchaseOrderLineItems', {
      Results: [
        {
          PK: 5001,
          PurchaseOrderPK: 4001,
          LineItemNo: 1,
          OrderUnitQty: 2,
          LineItemTotal: 1240.12,
          PartRef: { PK: 3001, ID: 'PT-3001', Name: 'Control Board', Uuid: null },
        },
      ],
      Total: 1,
    })

    const poResult = await harness.client.callTool({
      name: 'mc_list_purchase_orders',
      arguments: {
        $filter: 'IsOpen eq true',
      },
    })
    const lineItemResult = await harness.client.callTool({
      name: 'mc_list_po_line_items',
      arguments: {
        $filter: 'PurchaseOrderPK eq 4001',
      },
    })

    expect(JSON.parse(expectText(poResult)).Results[0].ID).toBe('PO-4001')
    expect(JSON.parse(expectText(lineItemResult)).Results[0].PurchaseOrderPK).toBe(4001)
    expect(fakeClient.getCalls.slice(-2)).toEqual([
      {
        path: '/purchaseorders',
        params: { $filter: 'IsOpen eq true' },
      },
      {
        path: '/PurchaseOrderLineItems',
        params: { $filter: 'PurchaseOrderPK eq 4001' },
      },
    ])
  })

  test('tool handlers convert MC API errors into MCP-friendly error results', async () => {
    fakeClient.whenGet('/workorders', () => {
      throw new McApiError(401, '/workorders', 'Unauthorized')
    })

    const result = await harness.client.callTool({
      name: 'mc_list_work_orders',
      arguments: {},
    })

    expect(result.isError).toBe(true)
    expect(expectText(result)).toContain('MC credentials rejected')
  })
})

function expectText(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0]
  expect(first?.type).toBe('text')
  expect(typeof first?.text).toBe('string')
  return first?.text as string
}
