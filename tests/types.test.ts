import { describe, expect, test } from 'bun:test'
import {
  AssetSummarySchema,
  EntityRefSchema,
  McApiResponseSchema,
  PartSummarySchema,
  PurchaseOrderLineItemSummarySchema,
  PurchaseOrderSummarySchema,
  WorkOrderSummarySchema,
} from '../src/shared/types.ts'

describe('shared schemas', () => {
  test('allows entity refs with nullable names', () => {
    expect(
      EntityRefSchema.parse({
        PK: 42,
        ID: 'WO-42',
        Name: null,
        Uuid: null,
      }),
    ).toEqual({
      PK: 42,
      ID: 'WO-42',
      Name: null,
      Uuid: null,
    })
  })

  test('parses representative work order response payloads', () => {
    const schema = McApiResponseSchema(WorkOrderSummarySchema)

    const parsed = schema.parse({
      Results: [
        {
          PK: 1001,
          ID: 'WO-1001',
          Reason: 'Replace failed blower motor',
          Instructions: null,
          TargetDate: '2026-04-20',
          IsOpen: true,
          IsAssigned: false,
          IsPartsReserved: true,
          IsFollowupWork: false,
          TypeDetails: { Value: 'CM', Description: 'Corrective Maintenance' },
          StatusDetails: { Value: 'ISSUED', Description: 'Issued' },
          PriorityDetails: { Value: '0', Description: 'Emergency' },
          AssetRef: { PK: 12, ID: 'AHU-12', Name: 'Air Handler 12', Uuid: null },
          RepairCenterRef: { PK: 4, ID: 'M', Name: 'Main Campus', Uuid: null },
          RequesterName: 'Alex',
          RequesterEmail: null,
        },
      ],
      Total: 1,
    })

    expect(parsed.Total).toBe(1)
    expect(parsed.Results[0]?.TypeDetails?.Value).toBe('CM')
  })

  test('parses representative asset payloads', () => {
    const parsed = AssetSummarySchema.parse({
      PK: 2001,
      ID: 'BLDG-01',
      Name: 'Operations Building',
      IsLocation: true,
      IsUp: true,
      AssetLevel: 2,
      LastMaintained: null,
      ClassificationRef: { PK: 11, ID: 'SITE', Name: 'Site', Uuid: null },
      ParentRef: null,
    })

    expect(parsed.Name).toBe('Operations Building')
    expect(parsed.IsLocation).toBe(true)
  })

  test('parses representative part payloads', () => {
    const parsed = PartSummarySchema.parse({
      PK: 3001,
      ID: 'PT-3001',
      Name: 'Control Board',
      PartDescription: 'Main control board',
      Active: true,
      DirectIssue: true,
      AvailableToRequester: false,
      IssueUnitCost: 89.5,
      LastOrderUnitPrice: null,
      CostRuleDetails: { Value: 'S', Description: 'Standard Cost' },
      CategoryRef: { PK: 55, ID: 'ELEC', Name: 'Electrical', Uuid: null },
    })

    expect(parsed.Name).toBe('Control Board')
    expect(parsed.CostRuleDetails?.Value).toBe('S')
  })

  test('parses representative purchase order payloads', () => {
    const parsed = PurchaseOrderSummarySchema.parse({
      PK: 4001,
      ID: 'PO-4001',
      Description: 'Emergency motor replacement',
      OrderDate: '2026-04-10',
      IsOpen: true,
      IsPartsOrdered: true,
      Total: 1240.12,
      Budget: null,
      StatusDetails: { Value: 'ISSUED', Description: 'Issued' },
      VendorRef: { PK: 88, ID: 'V-88', Name: 'North Point Toyota', Uuid: null },
      ShippingInfo: null,
      BillingInfo: null,
    })

    expect(parsed.Total).toBe(1240.12)
    expect(parsed.VendorRef?.Name).toBe('North Point Toyota')
  })

  test('parses representative purchase order line item payloads', () => {
    const parsed = PurchaseOrderLineItemSummarySchema.parse({
      PK: 5001,
      PurchaseOrderPK: 4001,
      LineItemNo: 1,
      OrderUnitQty: 2,
      OrderUnitQtyReceived: 1,
      OrderUnitQtyBackOrdered: 1,
      OrderUnitPrice: 620.06,
      LineItemTotal: 1240.12,
      DirectIssue: false,
      PartRef: { PK: 3001, ID: 'PT-3001', Name: 'Control Board', Uuid: null },
      WorkOrderRef: { PK: 1001, ID: 'WO-1001', Name: null, Uuid: null },
      OrderUnitsDetails: { Value: '', Description: '' },
    })

    expect(parsed.WorkOrderRef?.Name).toBeNull()
    expect(parsed.OrderUnitQtyBackOrdered).toBe(1)
  })
})
