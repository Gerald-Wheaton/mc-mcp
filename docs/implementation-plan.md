# MC-MCP Implementation Plan

## Phase 0: Discovery (partially done)

- [x] API swagger obtained and normalized
- [x] Confirm auth model — HTTP Basic, `base64(CONNECTION_KEY:API_KEY)`
- [x] Identify priority entities — Assets, Work Orders (CM), PMs, Work Requests (SR)
- [x] Confirm target MCP client — Claude Desktop first
- [ ] Confirm sandbox/non-prod environment (DEV key not yet working)

## Phase 1: Skeleton Server (COMPLETE)

- [x] Add `@modelcontextprotocol/sdk` and `zod` dependencies (bun)
- [x] Initialize TypeScript MCP server (`src/index.ts`)
- [x] Add config loading (`src/config.ts`) — env vars: `MC_BASE_URL`, `MC_BASIC_AUTH_ENCODED`
- [x] Add MC API client wrapper (`src/mc-client.ts`) with error handling
- [x] Add shared layer: `src/shared/odata.ts`, `src/shared/response.ts`, `src/shared/types.ts`
- [x] Register 9 tools: `mc_ping`, `mc_list_work_orders`, `mc_get_work_order`, `mc_list_assets`, `mc_get_asset`, `mc_list_parts`, `mc_get_part`, `mc_list_purchase_orders`, `mc_get_purchase_order`
- [x] Add `tsconfig.json` with NodeNext module resolution
- [x] Auth confirmed working against live prod data

## Phase 2: Data Discovery Layer

- [x] Migrate `types.ts` from hand-written interfaces to Zod schemas — types inferred via `z.infer<>`
- [x] Verify Work Orders endpoint against live data — schema confirmed, `parse()` wired up
- [x] Verify Assets endpoint against live data — schema confirmed, `parse()` wired up
- [x] Investigate type filter for work orders — MC OData requires double quotes for strings (not single quotes); type filtering via `Type eq "CM"` works. Tool description and odataShape need updating to use double-quote convention.
- [x] Add `mc_list_datasets` tool — static tool, no API call, returns all resource families with tools, record counts, and usable filters
- [x] Verify Parts and Purchase Orders endpoints against live data — schemas confirmed, `parse()` wired up
- [x] Add `mc_list_po_line_items` tool — 159 records across 74 POs; filter by `PurchaseOrderPK eq {pk}` or `PartRef/PK eq {pk}`
- [x] Fix `EntityRefSchema.Name` to be nullable — `WorkOrderRef.Name` is null in live data since WOs have no Name field

## Phase 2.5: Deep Entity Exploration (COMPLETE)

Must be completed for each entity before Phase 3. Follow this checklist for every entity. Assets is the completed reference example.

**Exploration checklist per entity:**
1. [ ] Fetch a sample of live records (use `$top: 20` minimum) — inspect for variation across records
2. [ ] Fetch a single record by PK — confirm the full field set including all `*Ref` and `*Details` fields
3. [ ] Identify all meaningful enum/lookup values in the data (e.g. status codes, type codes) — document in `docs/notable-findings.md`
4. [ ] Identify which boolean OData filters are useful (e.g. `IsOpen`, `IsActive`) — document confirmed working filters
5. [ ] Update the Zod schema in `types.ts` with confirmed field names and types
6. [ ] Verify `parse()` succeeds against a live sample — no Zod errors
7. [ ] Update the tool description to mention key fields and usable filters so the LLM knows what to expect
8. [ ] Document findings in `docs/notable-findings.md` (date, total records, key fields, confirmed filters, gotchas)

---

#### Work Orders — deep exploration (COMPLETE)
- [x] Type codes confirmed across all 645 records (see notable-findings.md — 8 codes, not 4)
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
- [x] Zod schema expanded from 15 to 36 fields — see notable-findings.md for full field list
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

## Phase 3: Analysis UX

> **Read first:** `docs/live-context-resources.md` — architectural ideation on MCP Resources as a context layer (staleness tiers, proposed resource URIs, ID enrichment, system prompt + resources interplay). The context layer is the foundation Phase 3 depends on — build it before prompt templates.
>
> **Read also:** `docs/phase3-prompts-and-repair-center.md` — repair center recon findings (filter syntax, schema presence per entity, discovery problem) and the full plan for adding optional args (`repair_center`, `asset_name`, `vendor_name`, `type`, `category`) to prompt templates.

- [x] Build initial context layer: implement `mc://context/time`, `mc://context/summary`, `mc://context/labors`, `mc://context/asset-locations`, and `mc://context/datasets`
- [x] Add TTL cache to `McClient` to support session-tier and slow-tier resources
- [x] Add `mc://context/datasets` as the preferred dataset-orientation interface while keeping `mc_list_datasets` supported during the transition
- [x] Add `mc://context/lookup-tables` after the lookup-table API surface is explored and validated
- [x] Add prompt templates for common CMMS analysis questions (requires context layer)
- [x] Add behavioral rules to prompt text: which resources to fetch before which tools

## Phase 4: Hardening

- [ ] **Automatic pagination** — currently `$top` max is 500 and the LLM must manually issue follow-up calls with `$skip` to page through large result sets. For datasets like Assets (33,639) and Parts (3,305) this is critical. Options:
  - Add a `fetchAll` mode to `McClient` that loops `$skip` until `Results.length + $skip >= Total`
  - Or surface `Total` and `nextSkip` in tool responses so the LLM knows to call again
  - Consider a hard cap (e.g. 2,000 records) to protect context window size
- [ ] Tests
- [ ] Caching and rate-limit handling
- [ ] Logging and error handling
- [ ] Deployment docs
