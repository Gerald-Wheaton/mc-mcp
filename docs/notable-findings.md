# MC-MCP Notable Findings

Research findings confirmed against live prod data for a TEST client. Update here when new exploration is completed.

---

## Auth

- **Auth is confirmed (2026-03-25).** MC uses HTTP Basic auth: `Authorization: Basic base64(CONNECTION_KEY:API_KEY)`. The connection key identifies the tenant (maps to the `Container_Resource` table); the API key authenticates the caller. Store the pre-encoded value in `MC_BASIC_AUTH_ENCODED`. DEV and PROD have separate connection keys.
- **DEV connection key is unverified.** Prod works. DEV returns 500 `ContainerResource was not found` — either the key is wrong, the base URL differs, or DEV is not provisioned. Needs follow-up with MC team.

---

## OData Filtering (confirmed 2026-03-25, corrected 2026-03-26)

The MC API's OData implementation has a quirk — **single-quoted string literals do not work**. The parser strips single quotes and treats the bare value as a property name (e.g. `Type eq 'CM'` fails with "CM is not a valid filter property on a WorkOrder").

**The fix: use double quotes instead of single quotes for string values.**

```
Type eq "CM"                          ✓  returns 77 WOs
Reason eq "Air Compressor (AC001/001)"  ✓  returns 1 WO
ID eq "1499"                          ✓  returns 1 WO
Type eq 'CM'                          ✗  parse error
```

This means **full string filtering is available**, just with double quotes. Confirmed working filter patterns:

- String equality: `Type eq "CM"`, `ID eq "1499"`, `Reason eq "some reason"`
- Boolean fields: `IsOpen eq true`, `IsAssigned eq false`, `IsApproved eq true`
- Null checks: `Type ne null`

**Critical convention:** All string values in `$filter` expressions must use double quotes (`"`), never single quotes (`'`). This applies everywhere — tool descriptions, LLM guidance, and any code that constructs filter strings.

---

## Work Order Types (confirmed across all 645 records, 2026-03-26)

All "task" entities are Work Orders filtered by `Type`. Confirmed codes in this customer's data:

| Code   | Description            | Count | PMRef present? | Customer concept   |
| ------ | ---------------------- | ----- | -------------- | ------------------ |
| `PM`   | Preventive Maintenance | 299   | Yes            | PMs                |
| `IN`   | Inspection             | 228   | No             | Inspections        |
| `CM`   | Corrective Maintenance | 77    | No             | Work Orders        |
| `CAP`  | Capital Project        | 29    | No             | Capital projects   |
| `SR`   | Service Request        | 5     | No             | Work Requests      |
| `ADMN` | Administration         | 3     | No             | Admin tasks        |
| `FO`   | Follow-up              | 2     | No             | Follow-up WOs      |
| `PC`   | Part Checkout          | 2     | No             | Internal/inventory |

- Filter pattern: `$filter=Type eq "CM"` (double quotes required)
- PM alternative filter: `$filter=PMRef ne null` (equivalent to `Type eq "PM"` for this customer)
- There is **no standalone PM, Inspection, or Work Request endpoint** — always filter WorkOrders

---

## Work Order Status, Priority, and Boolean Filters (confirmed 2026-03-26)

**Status codes** (confirmed across all 645 records):

- `ISSUED` (531), `CLOSED` (86), `REQUESTED` (26), `CANCELED` (2)

**Priority codes:**

- `0` = Emergency (Immediate Response) — 3 records
- `2` = Normal (1-3 Days Response) — 348 records
- `3` = Low (>3 Days response) — 294 records

**Useful boolean filters** (non-trivial distribution):

- `IsOpen eq true` — 557 open, 88 closed
- `IsAssigned eq true` — 263 assigned, 382 unassigned
- `IsPartsReserved eq true` — 381 reserved, 264 not
- `IsFollowupWork eq true` — 7 follow-up WOs

**Constant for this customer** (but keep in schema — other clients may use them):

- `IsApproved` — always true; `HasWarranty`, `IsChargeable`, `IsFailedWorkOrder`, `IsLockoutTagout`, `IsShutdownRequired` — always false
- These fields are retained in the Zod schema and tool output. Before a second client is onboarded, ask them whether any of these are actively used — they represent MC features (warranty tracking, lockout/tagout safety, chargebacks) that some customers enable.

---

## Assets (confirmed against live prod API, 2026-03-25)

- Total assets: **33,639**
- Asset tree is hierarchical — `AssetLevel` indicates depth (1 = root/university, 2 = campuses, deeper = buildings/equipment)
- `TypeDetails.Value = "L"` means Location (not equipment) — filter with `$filter=IsLocation eq false` to target equipment only
- Same `ValueDescription` and `EntityRef` patterns as Work Orders
- Key fields for LLM use: `Name`, `ID`, `IsLocation`, `IsUp`, `AssetLevel`, `TypeDetails`, `ClassificationRef`, `ParentRef`, `LastMaintained`

---

## Parts (confirmed against all 3305 live records, 2026-03-26)

- Total parts: **3,305**
- **Quantity fields not on Parts endpoint** — `QuantityOnHand`, `QuantityOnOrder`, `QuantityReserved`, `ReorderLevel`, `ReorderQuantity` are absent from `/Parts` responses; they live in the `PartLocations` endpoint
- **IssueUnitsDetails codes**: E=Each (1 record); 3304 null — nearly unused in this customer's data
- **CostRuleDetails codes**: S=Standard Cost (156), AVG=Average Cost (2); 3147 null
- **OrderUnitsDetails / WarrantyFromDetails**: all null in this customer's data — keep in schema for other clients
- **Useful boolean filters**: `Active eq true` (3300), `DirectIssue eq true` (3185), `AvailableToRequester eq true` (3180)
- **Constant for this customer** (keep in schema): `Hazardous` always false, `RotatingPart` always false, `WarrantyDays` always 0/null
- Key fields for LLM: `Name`, `ID`, `InternalPartNumber`, `PartDescription`, `IssueUnitCost`, `LastOrderUnitPrice`, `LastOrdered`, `LastIssued`, `CategoryRef`, `ClassificationRef`, `LastIssuedWOID`, `LastOrderedPOID`

---

## Purchase Orders (confirmed against all 74 live records, 2026-03-26)

- Total POs: **74**
- **Status codes**: ISSUED(54), REQUESTED(16), CANCELED(2), CLOSED(2)
- **Status filter path**: `Status eq "ISSUED"` — NOT `StatusDetails/Value eq "ISSUED"` (that path returns a 400 error for POs)
- **Line items**: available at two endpoints — `/purchaseorders/{pk}/lineitems` (by PO) and `/purchaseorderlineitems` (root, 159 total); a separate `mc_list_po_line_items` tool is needed to expose these
- **Budget is nullable**: 24/74 records have `Budget=null` — schema uses `z.number().nullable()`
- **SubStatusDetails carries ERP codes**: value `"UB"` = "Updated with Banner PO" — this customer integrates MC with Banner ERP for PO numbers
- **Priority always "2=Normal"** for all 74 records — not a useful filter for this customer
- **Useful boolean filters**: `IsOpen eq true` (71/74), `IsPartsOrdered eq true` (55/74)
- **ShippingInfo / BillingInfo**: complex nested objects (address, freight terms, tracking) — stored as `z.unknown()` in schema since values are mostly null in this customer's data
- Key fields for LLM: `ID`, `Description`, `VendorRef`, `Total`, `OrderDate`, `StatusDetails`, `IsOpen`, `IsPartsOrdered`, `InvoiceNumber`

---

## Repair Centers (confirmed 2026-03-30, prompt scoping implemented 2026-04-22)

- `RepairCenterRef` is populated on Work Orders and Assets for this client, and partially populated on Purchase Orders.
- Confirmed working flat filters: `RepairCenterPK eq 1`, `RepairCenterID eq "M"`
- Confirmed failing navigation filters: `RepairCenterRef/PK eq 1`, `RepairCenterRef/ID eq "M"`
- Prompt templates now support repair center scoping by either:
  - exact `repair_center_id`, or
  - case-insensitive exact `repair_center_name`, resolved from sampled `RepairCenterRef` values before converting to `RepairCenterID`
- Ambiguous duplicate repair center names are treated as an error; prompts instruct the model to stop and report the ambiguity rather than guess.

---

## Live Data Snapshot (prod, 2026-03-26)

- Total work orders: **645** (PM×299, IN×228, CM×77, CAP×29, SR×5, ADMN×3, FO×2, PC×2)
- Total assets: **33,639** (mix of locations and equipment across hierarchical tree)
- Total parts: **3,305**
- Total purchase orders: **74**
