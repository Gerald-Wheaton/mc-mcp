// fallow-ignore-file unused-file
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { McApiError } from '../src/mc-client.ts'
import { FakeMcClient } from './helpers/fake-mc-client.ts'
import { createMcpHarness } from './helpers/mcp-harness.ts'

describe('dynamic context resources', () => {
  let fakeClient: FakeMcClient
  let harness: Awaited<ReturnType<typeof createMcpHarness>>

  beforeEach(async () => {
    fakeClient = new FakeMcClient()
    harness = await createMcpHarness(fakeClient as never)
  })

  afterEach(async () => {
    await harness.close()
  })

  test('summary resource aggregates counts and uses cached results', async () => {
    fakeClient.whenGet('/workorders', { Results: [], Total: 645 })
    fakeClient.whenGet('/Assets', (params) => {
      const filter = params?.$filter
      if (filter === 'IsLocation eq true') {
        return { Results: [], Total: 1200 }
      }
      if (filter === 'IsLocation eq false') {
        return { Results: [], Total: 32439 }
      }
      return { Results: [], Total: 33639 }
    })
    fakeClient.whenGet('/Parts', { Results: [], Total: 3305 })
    fakeClient.whenGet('/purchaseorders', { Results: [], Total: 74 })
    fakeClient.whenGet('/PurchaseOrderLineItems', { Results: [], Total: 159 })

    const first = await harness.client.readResource({ uri: 'mc://context/summary' })
    const second = await harness.client.readResource({ uri: 'mc://context/summary' })

    const parsed = JSON.parse(expectResourceText(first))

    expect(parsed.counts).toEqual({
      workOrders: 645,
      assets: {
        total: 33639,
        locations: 1200,
        equipment: 32439,
      },
      parts: 3305,
      purchaseOrders: 74,
      purchaseOrderLineItems: 159,
    })
    expect(fakeClient.getCalls).toHaveLength(7)
    expect(fakeClient.getCachedCalls.filter((call) => call.key === 'context:summary')).toHaveLength(2)
    expect(expectResourceText(second)).toBe(expectResourceText(first))
  })

  test('labors resource normalizes nullable fields and active counts', async () => {
    fakeClient.whenGetAllPages('/Labors', {
      Results: [
        {
          PK: 1,
          ID: 'TECH-1',
          Name: 'Alex Rivera',
          Active: true,
          Initials: 'AR',
          RepairCenterRef: { PK: 9, ID: 'M', Name: 'Main Campus', Uuid: null },
        },
        {
          PK: 2,
          ID: 'TECH-2',
          Name: 'Jordan Lee',
          Active: false,
        },
        {
          PK: 3,
          ID: 'TECH-3',
          Name: 'Casey Hall',
        },
      ],
      Total: 3,
    })

    const result = await harness.client.readResource({ uri: 'mc://context/labors' })
    const parsed = JSON.parse(expectResourceText(result))

    expect(parsed.total).toBe(3)
    expect(parsed.activeCount).toBe(2)
    expect(parsed.inactiveCount).toBe(1)
    expect(parsed.labors[1]).toEqual({
      PK: 2,
      ID: 'TECH-2',
      Name: 'Jordan Lee',
      Active: false,
      Initials: null,
      RepairCenterRef: null,
      ShopRef: null,
    })
  })

  test('asset locations resource computes asset-level counts and caches page loads', async () => {
    fakeClient.whenGetAllPages('/Assets', {
      Results: [
        {
          PK: 10,
          ID: 'SITE-1',
          Name: 'Main Campus',
          IsLocation: true,
          AssetLevel: 1,
          ParentRef: null,
        },
        {
          PK: 11,
          ID: 'BLDG-1',
          Name: 'Operations Building',
          IsLocation: true,
          AssetLevel: 2,
          ParentRef: { PK: 10, ID: 'SITE-1', Name: 'Main Campus', Uuid: null },
        },
        {
          PK: 12,
          ID: 'FLR-1',
          Name: 'First Floor',
          IsLocation: true,
          AssetLevel: 3,
          ParentRef: { PK: 11, ID: 'BLDG-1', Name: 'Operations Building', Uuid: null },
        },
      ],
      Total: 3,
    })

    const first = await harness.client.readResource({ uri: 'mc://context/asset-locations' })
    await harness.client.readResource({ uri: 'mc://context/asset-locations' })
    const parsed = JSON.parse(expectResourceText(first))

    expect(parsed.assetLevels).toEqual([
      { assetLevel: 1, count: 1 },
      { assetLevel: 2, count: 1 },
      { assetLevel: 3, count: 1 },
    ])
    expect(fakeClient.getAllPagesCalls).toEqual([
      {
        path: '/Assets',
        params: {
          $filter: 'IsLocation eq true',
          $orderby: 'Name asc',
        },
      },
    ])
  })

  test('lookup tables resource sorts and groups values', async () => {
    fakeClient.whenGetAllPages('/LookupTables', {
      Results: [
        {
          LookupTableID: 'WORK_ORDER_STATUS',
          Description: 'Work order statuses',
          Enabled: true,
          Internal: true,
        },
        {
          LookupTableID: 'CATEGORY',
          Description: 'Part categories',
          Enabled: true,
          Internal: false,
        },
      ],
      Total: 2,
    })
    fakeClient.whenGetAllPages('/LookupTableValues', {
      Results: [
        {
          LookupTableID: 'CATEGORY',
          CodeName: 'ELEC',
          CodeDesc: 'Electrical',
          AvailableToRequester: true,
        },
        {
          LookupTableID: 'WORK_ORDER_STATUS',
          CodeName: 'ISSUED',
          CodeDesc: 'Issued',
          SystemCode: true,
        },
        {
          LookupTableID: 'CATEGORY',
          CodeName: 'HVAC',
          CodeDesc: 'HVAC',
        },
      ],
      Total: 3,
    })

    const result = await harness.client.readResource({ uri: 'mc://context/lookup-tables' })
    const parsed = JSON.parse(expectResourceText(result))

    expect(parsed.totalTables).toBe(2)
    expect(parsed.totalValues).toBe(3)
    expect(parsed.tables.map((table: { lookupTableID: string }) => table.lookupTableID)).toEqual([
      'CATEGORY',
      'WORK_ORDER_STATUS',
    ])
    expect(parsed.tables[0].values.map((value: { codeName: string }) => value.codeName)).toEqual([
      'ELEC',
      'HVAC',
    ])
  })

  test('resource failures are converted into readable MCP errors', async () => {
    fakeClient.whenGetAllPages('/Labors', () => {
      throw new McApiError(500, '/Labors', 'bad gateway')
    })

    await expect(
      harness.client.readResource({ uri: 'mc://context/labors' }),
    ).rejects.toThrow('MC API error 500: bad gateway')
  })
})

function expectResourceText(result: { contents: Array<{ text?: string }> }): string {
  const text = result.contents[0]?.text
  expect(typeof text).toBe('string')
  return text as string
}
