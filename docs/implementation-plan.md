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

- [x] **Automatic pagination** — `$fetchAll` flag added to all list tools; `McClient.getAllPages` loops `$skip` internally until the collection is exhausted or the 2,000-record hard cap is hit. `toListToolText` surfaces `fetchedAll` and `cappedAt` in pagination metadata so the LLM knows when results were capped.
- [x] **Address hanging or very slow requests** — `AbortController` timeout already existed; added retry/backoff (2 retries, exponential delay, 5xx only — 4xx and timeouts throw immediately); `[mc]` structured logging emits path, status, duration, timeout, and retry events; `McTimeoutError` message tells the user to narrow filters or reduce `$top`; `mc_ping` now probes `/workorders`, `/Assets`, and `/Parts` in parallel and returns `status: ok | degraded | error` so heavy-endpoint health is tracked separately from auth.
- [x] **Tests** — expanded to cover `getAllPages` (empty, single-page, multi-page), retry behavior (503 retries, 4xx no-retry, exhausted retries), concurrent `getCached` dedup, `mc_ping` ok/degraded/all-failed, `$fetchAll` tool handler paths, default `$top` injection, and `fetchedAll`/`cappedAt` pagination metadata.
- [ ] **Caching and rate-limit handling** — TTL cache exists for context resources; cache hit/miss/join/stored logging added. Rate-limiting (throttling outbound MC API requests) is not yet implemented; noted as a known limitation in `docs/deployment.md`.
- [x] **Logging and error handling** — structured log prefixes throughout: `[mc]` for API calls, cache events, retries, and timeouts; `[tool]` for non-4xx tool errors (with stack traces); `[resource]` for context resource failures. Log format documented in `docs/deployment.md`.
- [x] **Deployment docs** — `docs/deployment.md` added: env vars, Railway config, local dev, credential format, credential rotation, log format table, known limitations. README updated with pointer.
- [ ] **End-user UX audit** — review all prompt templates and tool descriptions to ensure the LLM never surfaces OData syntax or other developer-facing details to end users. The LLM should translate user intent into filters silently; replies should offer plain-English follow-up options, not raw filter strings. See `docs/open-questions.md` for the full design concern and example.

- Full OAuth 2.1 flow (authorization server, token exchange, refresh tokens) — not needed for pilot; static API
  keys are sufficient
  - HTTPS/TLS — handled by a reverse proxy (Cloudflare, nginx, fly.io proxy); the server speaks plain HTTP
  - Rate limiting — Phase 4 item, deferred
  - API key rotation UI — keys are rotated by updating TENANTS_JSON and restarting the server
  - Backward compatibility with stdio — stdio mode is removed; existing local users update their Claude Desktop
    config to point to the hosted URL
