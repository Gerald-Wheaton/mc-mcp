# MC-MCP: Maintenance Connection MCP Server

## Project Goal

Build a read-only MCP server that wraps the Accruent Maintenance Connection (MC) REST API, enabling LLM clients to reason about a customer's CMMS data. The target experience is conversational: customers ask "why" questions about their facilities data (work orders, assets, PMs, inventory, POs) and the LLM answers by querying live MC data.

Phase 1 (skeleton) is complete and auth is confirmed against live prod data. We are now in Phase 2 (data discovery layer).

## What MC Is

Maintenance Connection is a CMMS (Computerized Maintenance Management System). Customers use it to manage:

- **Assets** — equipment, facilities, and their specifications, images, documents, meter readings
- **Work Orders (WOs)** — reactive and planned maintenance tasks with labor, parts, and cost actuals/estimates
- **Preventive Maintenance (PMs)** — scheduled recurring maintenance
- **Parts / Inventory** — parts catalog, stock locations, transactions, vendor relationships
- **Purchase Orders (POs)** — procurement with line items, receipts, invoices, status updates
- **Labors** — technician/labor records
- **Companies / Vendors** — supplier and company data
- **Lookup Tables** — configurable dropdowns and classification data
- **Specifications** — asset attribute templates

## MC API Facts

- **Base path:** `https://api.maintenanceconnection.com/v8`
- **Spec format:** Swagger 2.0
- **Auth:** HTTP Basic — `Authorization: Basic base64(CONNECTION_KEY:API_KEY)`. Connection key is the username (identifies tenant); API key is the password. Store pre-encoded value in `MC_BASIC_AUTH_ENCODED`.
- **API map files** (pre-built from swagger, do not regenerate from swagger directly):
  - `api-docs/mc-normalized-api-map.json` — structured source of truth for all endpoints and schemas
  - `api-docs/mc-llm-api-chunks.json` — semantic retrieval layer for fuzzy endpoint discovery

## API Docs Skill

Use the **`maintenance-connection-api-rag` skill** (`.claude/skills/SKILL.md`) whenever you need to look up endpoint details, schemas, or parameters. The two-stage workflow is:

1. Search `mc-llm-api-chunks.json` for semantic/fuzzy discovery
2. Verify exact details in `mc-normalized-api-map.json`

Never answer API questions from the raw swagger file (`mc-api-swagger.json`) — use the pre-built artifacts under `api-docs/`.

### Key API resource families (tags)

| Tag                                                    | Description                    |
| ------------------------------------------------------ | ------------------------------ |
| Assets                                                 | Core asset CRUD                |
| AssetDocuments / AssetImages                           | Asset attachments              |
| AssetMeterHistory                                      | Meter readings over time       |
| AssetSpecifications                                    | Attribute values per asset     |
| WorkOrders                                             | WO CRUD                        |
| WorkOrderAssignments                                   | Who is assigned to a WO        |
| WorkOrderLaborCostActuals/Estimates                    | Labor cost tracking            |
| WorkOrderPartActuals/Estimates                         | Parts used on WOs              |
| WorkOrderMiscCostActuals/Estimates                     | Misc cost tracking             |
| WorkOrderDocuments / WorkOrderImages                   | WO attachments                 |
| Parts / PartLocations / PartTransactions / PartVendors | Inventory management           |
| PurchaseOrders / PurchaseOrderLineItems                | PO management                  |
| Receipts / ReceiptLineItems                            | Receiving                      |
| Invoices                                               | Invoice management             |
| Labors                                                 | Labor records                  |
| Companies                                              | Vendor/company records         |
| Classifications                                        | Asset classification hierarchy |
| Specifications / SpecificationAssetSpecifications      | Asset spec templates           |
| LookupTables / LookupTableValues                       | Configurable dropdowns         |
| Schema                                                 | API schema discovery endpoint  |
| Log                                                    | System/audit log               |

## Project Structure

```
mc-mcp/
├── .claude/
│   └── skills/
│       └── SKILL.md           # maintenance-connection-api-rag skill (two-stage RAG workflow)
├── CLAUDE.md                  # This file
├── tsconfig.json              # NodeNext module resolution — required for MCP SDK + Bun ESM
├── package.json               # Deps: @modelcontextprotocol/sdk, zod, typescript
├── api-docs/
│   ├── mc-normalized-api-map.json   # Structured endpoint/schema reference (source of truth)
│   └── mc-llm-api-chunks.json       # Semantic retrieval chunks for fuzzy discovery
├── build-mc-api-map.ts        # Script that built api-docs/ from mc-api-swagger.json
├── mc-api-swagger.json        # Raw Swagger 2.0 source (do not query directly)
└── src/
    ├── index.ts               # Server entry point — creates McClient, registers all tools, connects transport
    ├── config.ts              # Reads MC_BASE_URL and MC_API_KEY; throws on missing values
    ├── mc-client.ts           # McClient class — all HTTP/auth logic; McApiError type
    ├── shared/
    │   ├── odata.ts           # odataShape — Zod fragment spread into every list tool ($filter/$top/$skip/$orderby)
    │   ├── response.ts        # toToolText() / toToolError() — standardizes all tool return values
    │   └── types.ts           # McApiResponse<T> envelope + minimal entity summary types
    └── tools/
        ├── ping.ts            # mc_ping — connectivity + auth check
        ├── datasets.ts        # mc_list_datasets — static resource family index
        ├── work-orders.ts     # mc_list_work_orders, mc_get_work_order
        ├── assets.ts          # mc_list_assets, mc_get_asset
        ├── parts.ts           # mc_list_parts, mc_get_part
        └── purchase-orders.ts # mc_list_purchase_orders, mc_get_purchase_order
```

### Adding a new tool domain (Phase 2+)

1. Create `src/tools/<domain>.ts` — export `register(server, client)`
2. Add `import { register as registerX } from './tools/<domain>.js'` to `src/index.ts`
3. Call `registerX(server, client)` in `src/index.ts` before `server.connect()`
4. Add minimal types to `src/shared/types.ts` as fields are confirmed against real API responses

## Implementation Plan

### Phase 0: Discovery (partially done)

- [x] API swagger obtained and normalized
- [x] Confirm auth model — HTTP Basic, `base64(CONNECTION_KEY:API_KEY)`
- [x] Identify priority entities — Assets, Work Orders (CM), PMs, Work Requests (SR)
- [ ] Confirm target MCP client (Claude Desktop, VS Code, custom?)
- [ ] Confirm sandbox/non-prod environment (DEV key not yet working)

### Phase 1: Skeleton Server (COMPLETE)

- [x] Add `@modelcontextprotocol/sdk` and `zod` dependencies (bun)
- [x] Initialize TypeScript MCP server (`src/index.ts`)
- [x] Add config loading (`src/config.ts`) — env vars: `MC_BASE_URL`, `MC_BASIC_AUTH_ENCODED`
- [x] Add MC API client wrapper (`src/mc-client.ts`) with error handling
- [x] Add shared layer: `src/shared/odata.ts`, `src/shared/response.ts`, `src/shared/types.ts`
- [x] Register 9 tools: `mc_ping`, `mc_list_work_orders`, `mc_get_work_order`, `mc_list_assets`, `mc_get_asset`, `mc_list_parts`, `mc_get_part`, `mc_list_purchase_orders`, `mc_get_purchase_order`
- [x] Add `tsconfig.json` with NodeNext module resolution
- [x] Auth confirmed working against live prod data

### Phase 2: Data Discovery Layer

- [x] Migrate `types.ts` from hand-written interfaces to Zod schemas — types inferred via `z.infer<>`
- [x] Verify Work Orders endpoint against live data — schema confirmed, `parse()` wired up
- [x] Verify Assets endpoint against live data — schema confirmed, `parse()` wired up
- [x] Investigate type filter for work orders — MC OData requires double quotes for strings (not single quotes); type filtering via `Type eq "CM"` works. Tool description and odataShape need updating to use double-quote convention.
- [x] Add `mc_list_datasets` tool — static tool, no API call, returns all resource families with tools, record counts, and usable filters
- [x] Verify Parts and Purchase Orders endpoints against live data — schemas confirmed, `parse()` wired up
- [x] Add `mc_list_po_line_items` tool — 159 records across 74 POs; filter by `PurchaseOrderPK eq {pk}` or `PartRef/PK eq {pk}`
- [x] Fix `EntityRefSchema.Name` to be nullable — `WorkOrderRef.Name` is null in live data since WOs have no Name field

### Phase 2.5: Deep Entity Exploration

Must be completed for each entity before Phase 3. Follow this checklist for every entity. Assets is the completed reference example.

**Exploration checklist per entity:**
1. [ ] Fetch a sample of live records (use `$top: 20` minimum) — inspect for variation across records
2. [ ] Fetch a single record by PK — confirm the full field set including all `*Ref` and `*Details` fields
3. [ ] Identify all meaningful enum/lookup values in the data (e.g. status codes, type codes) — document in Notable Findings
4. [ ] Identify which boolean OData filters are useful (e.g. `IsOpen`, `IsActive`) — document confirmed working filters
5. [ ] Update the Zod schema in `types.ts` with confirmed field names and types
6. [ ] Verify `parse()` succeeds against a live sample — no Zod errors
7. [ ] Update the tool description to mention key fields and usable filters so the LLM knows what to expect
8. [ ] Document findings in CLAUDE.md Notable Findings section (date, total records, key fields, confirmed filters, gotchas)

---

#### Work Orders — deep exploration (COMPLETE)
- [x] Type codes confirmed across all 645 records (see Notable Findings — 8 codes, not 4)
- [x] Schema expanded to full field set, `parse()` verified against all 8 type codes
- [x] Samples fetched for CM, IN, PM, SR, CAP, ADMN, FO, PC — field set is identical across types, only population varies
- [x] All status codes confirmed across all 645 records: ISSUED, CLOSED, REQUESTED, CANCELED
- [x] Boolean filters documented — useful: IsOpen, IsAssigned, IsPartsReserved, IsFollowupWork; not useful (constant): IsApproved, HasWarranty, IsChargeable, IsFailedWorkOrder, IsLockoutTagout, IsShutdownRequired
- [x] Tool description updated with all type codes, status codes, priority codes, and useful filters

#### Assets — deep exploration (COMPLETE)
- [x] Hierarchy confirmed: `AssetLevel` 1=root, 2=campus, deeper=buildings/equipment
- [x] `IsLocation eq false` filters to equipment only
- [x] `TypeDetails.Value = "L"` means Location node
- [x] Schema confirmed, `parse()` wired up
- [x] Tool description updated

#### Parts — deep exploration (COMPLETE)
- [x] Fetched 30-record sample and all 3305 records — full field key set confirmed
- [x] Fetched two single records by PK — full field set confirmed including all nullables
- [x] Boolean filters confirmed: Active (3300/5), DirectIssue (3185/120), AvailableToRequester (3180/125)
- [x] IssueUnitsDetails: only "E" (Each) in 1 record; 3304 null — nearly unused in this customer's data
- [x] CostRuleDetails: S=Standard Cost (156), AVG=Average Cost (2); 3147 null
- [x] Zod schema expanded from 15 to 36 fields — see Notable Findings for full field list
- [x] parse() verified: list (50), single record, inactive parts — all pass
- [x] Tool description updated with confirmed filters, key fields, and PartLocations caveat

#### Purchase Orders — deep exploration (COMPLETE)
- [x] Fetched all 74 records — full field key set confirmed
- [x] Fetched two single records by PK — ShippingInfo/BillingInfo confirmed (mostly null nested objects)
- [x] All status codes confirmed: ISSUED(54), REQUESTED(16), CANCELED(2), CLOSED(2)
- [x] Line items: both `/purchaseorders/{pk}/lineitems` and `/purchaseorderlineitems` root endpoints exist (159 total line items); a new `mc_list_po_line_items` tool is needed
- [x] Useful boolean filters: IsOpen (71/3), IsPartsOrdered (55/19); IsApproved near-constant (72/2)
- [x] Status filter path confirmed: `Status eq "ISSUED"` (not `StatusDetails/Value eq "ISSUED"`)
- [x] Schema expanded from 12 to 36 fields — Budget is nullable in 24/74 records (gotcha)
- [x] parse() verified: all 74 records, single record, and status filter — all pass
- [x] Tool description updated with confirmed codes, filters, and line items caveat

### Phase 3: Analysis UX

> **Read first:** `docs/live-context-resources.md` — architectural ideation on MCP Resources as a context layer (staleness tiers, proposed resource URIs, ID enrichment, system prompt + resources interplay). The context layer is the foundation Phase 3 depends on — build it before prompt templates.
>
> **Read also:** `docs/phase3-prompts-and-repair-center.md` — repair center recon findings (filter syntax, schema presence per entity, discovery problem) and the full plan for adding optional args (`repair_center`, `asset_name`, `vendor_name`, `type`, `category`) to prompt templates.

- [ ] Build context layer: implement `mc://context/*` MCP Resources (time, summary, labors, asset-locations, lookup-tables)
- [ ] Add TTL cache to `McClient` to support session-tier resources
- [ ] Convert `mc_list_datasets` tool to `mc://context/datasets` resource
- [ ] Add prompt templates for common CMMS analysis questions (requires context layer)
- [ ] Add behavioral rules to system prompt: which resources to fetch before which tools

### Phase 4: Hardening

- [ ] **Automatic pagination** — currently `$top` max is 500 and the LLM must manually issue follow-up calls with `$skip` to page through large result sets. For datasets like Assets (33,639) and Parts (3,305) this is critical. Options:
  - Add a `fetchAll` mode to `McClient` that loops `$skip` until `Results.length + $skip >= Total`
  - Or surface `Total` and `nextSkip` in tool responses so the LLM knows to call again
  - Consider a hard cap (e.g. 2,000 records) to protect context window size
- [ ] Tests
- [ ] Caching and rate-limit handling
- [ ] Logging and error handling
- [ ] Deployment docs

## Working Principles

- **Read-only by default.** No write/update/delete MCP tools in v1.
- **Small, testable increments.** Don't build Phase 3 before Phase 1 works.
- **Explicit schemas over ad hoc payloads.** Use Zod for all tool input/output.
- **Document decisions.** Add entries to `docs/interview-log.md` when material decisions are made.
- **TypeScript + Bun.** Use `bun` as the package manager and runtime. Use `bunx` instead of `npx`.
- **MCP SDK: `@modelcontextprotocol/sdk` v1** — use the `McpServer` + `registerTool` high-level API.

## Notable Findings

### Auth
- **Auth is confirmed (2026-03-25).** MC uses HTTP Basic auth: `Authorization: Basic base64(CONNECTION_KEY:API_KEY)`. The connection key identifies the tenant (maps to the `Container_Resource` table); the API key authenticates the caller. Store the pre-encoded value in `MC_BASIC_AUTH_ENCODED`. DEV and PROD have separate connection keys.
- **DEV connection key is unverified.** Prod works. DEV returns 500 `ContainerResource was not found` — either the key is wrong, the base URL differs, or DEV is not provisioned. Needs follow-up with MC team.

### OData Filtering (confirmed 2026-03-25, corrected 2026-03-26)
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

### Work Order Types (confirmed across all 645 records, 2026-03-26)
All "task" entities are Work Orders filtered by `Type`. Confirmed codes in this customer's data:

| Code | Description | Count | PMRef present? | Customer concept |
|------|-------------|-------|----------------|------------------|
| `PM` | Preventive Maintenance | 299 | Yes | PMs |
| `IN` | Inspection | 228 | No | Inspections |
| `CM` | Corrective Maintenance | 77 | No | Work Orders |
| `CAP` | Capital Project | 29 | No | Capital projects |
| `SR` | Service Request | 5 | No | Work Requests |
| `ADMN` | Administration | 3 | No | Admin tasks |
| `FO` | Follow-up | 2 | No | Follow-up WOs |
| `PC` | Part Checkout | 2 | No | Internal/inventory |

- Filter pattern: `$filter=Type eq "CM"` (double quotes required)
- PM alternative filter: `$filter=PMRef ne null` (equivalent to `Type eq "PM"` for this customer)
- There is **no standalone PM, Inspection, or Work Request endpoint** — always filter WorkOrders

### Work Order Status, Priority, and Boolean Filters (confirmed 2026-03-26)
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

### Assets (confirmed against live prod API, 2026-03-25)
- Total assets: **33,639**
- Asset tree is hierarchical — `AssetLevel` indicates depth (1 = root/university, 2 = campuses, deeper = buildings/equipment)
- `TypeDetails.Value = "L"` means Location (not equipment) — filter with `$filter=IsLocation eq false` to target equipment only
- Same `ValueDescription` and `EntityRef` patterns as Work Orders
- Key fields for LLM use: `Name`, `ID`, `IsLocation`, `IsUp`, `AssetLevel`, `TypeDetails`, `ClassificationRef`, `ParentRef`, `LastMaintained`

### Parts (confirmed against all 3305 live records, 2026-03-26)
- Total parts: **3,305**
- **Quantity fields not on Parts endpoint** — `QuantityOnHand`, `QuantityOnOrder`, `QuantityReserved`, `ReorderLevel`, `ReorderQuantity` are absent from `/Parts` responses; they live in the `PartLocations` endpoint
- **IssueUnitsDetails codes**: E=Each (1 record); 3304 null — nearly unused in this customer's data
- **CostRuleDetails codes**: S=Standard Cost (156), AVG=Average Cost (2); 3147 null
- **OrderUnitsDetails / WarrantyFromDetails**: all null in this customer's data — keep in schema for other clients
- **Useful boolean filters**: `Active eq true` (3300), `DirectIssue eq true` (3185), `AvailableToRequester eq true` (3180)
- **Constant for this customer** (keep in schema): `Hazardous` always false, `RotatingPart` always false, `WarrantyDays` always 0/null
- Key fields for LLM: `Name`, `ID`, `InternalPartNumber`, `PartDescription`, `IssueUnitCost`, `LastOrderUnitPrice`, `LastOrdered`, `LastIssued`, `CategoryRef`, `ClassificationRef`, `LastIssuedWOID`, `LastOrderedPOID`

### Purchase Orders (confirmed against all 74 live records, 2026-03-26)
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

### Live Data Snapshot (prod, 2026-03-26)
- Total work orders: **645** (PM×299, IN×228, CM×77, CAP×29, SR×5, ADMN×3, FO×2, PC×2)
- Total assets: **33,639** (mix of locations and equipment across hierarchical tree)
- Total parts: **3,305**
- Total purchase orders: **74**

- **Testing entry point:** `bun --env-file=.env run src/index.ts`, then call `mc_ping` from any MCP client.

## Open Questions

These must be answered before the API client can be built:

1. ~~What auth scheme does the MC API use?~~ **Resolved:** HTTP Basic, `base64(CONNECTION_KEY:API_KEY)`
2. ~~Which 3–5 entities are highest priority?~~ **Resolved:** Assets, Work Orders (CM), PMs (PM), Work Requests (SR)
3. DEV environment — does it use a different base URL? Is the DEV connection key provisioned?
4. Which MCP client will connect first? (Claude Desktop, VS Code extension, custom?)
5. Are there PII or data sensitivity rules that constrain what we expose?
6. Natural-language-only filtering, structured filters, or both?

## Key Conventions

- All tools must be read-only (GET requests only in v1)
- API errors should surface as tool errors with the HTTP status and message
- Prefer pagination over fetching all records at once
- Use `$filter`, `$orderby`, `$top`, `$skip` OData params where available (the API supports them on list endpoints)
- Do not invent undocumented parameters — verify everything against `mc-normalized-api-map.json`
