# MC-MCP: Maintenance Connection MCP Server

## Project Goal

Build a read-only MCP server that wraps the Accruent Maintenance Connection (MC) REST API, enabling LLM clients to reason about a customer's CMMS data. The target experience is conversational: customers ask "why" questions about their facilities data (work orders, assets, PMs, inventory, POs) and the LLM answers by querying live MC data.

Phase 1 (skeleton) is complete. The server runs and 9 tools are registered. We are now in Phase 2 (data discovery layer) — blocked on customer credentials and auth confirmation.

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
- **Auth:** Unknown — needs to be confirmed with the customer (likely API key or OAuth; see open questions below)
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
- [ ] Confirm auth model with customer
- [ ] Identify 3–5 highest-priority entities
- [ ] Confirm target MCP client (Claude Desktop, VS Code, custom?)
- [ ] Confirm sandbox/non-prod environment

### Phase 1: Skeleton Server (COMPLETE)

- [x] Add `@modelcontextprotocol/sdk` and `zod` dependencies (bun)
- [x] Initialize TypeScript MCP server (`src/index.ts`)
- [x] Add config loading (`src/config.ts`) — env vars: `MC_BASE_URL`, `MC_API_KEY`
- [x] Add MC API client wrapper (`src/mc-client.ts`) with error handling
- [x] Add shared layer: `src/shared/odata.ts`, `src/shared/response.ts`, `src/shared/types.ts`
- [x] Register 9 tools: `mc_ping`, `mc_list_work_orders`, `mc_get_work_order`, `mc_list_assets`, `mc_get_asset`, `mc_list_parts`, `mc_get_part`, `mc_list_purchase_orders`, `mc_get_purchase_order`
- [x] Add `tsconfig.json` with NodeNext module resolution
- [ ] **BLOCKED:** Confirm auth scheme and test `mc_ping` against a real environment

### Phase 2: Data Discovery Layer

- [ ] Add `list_datasets` tool returning available resource families
- [ ] Add first read-only tools for priority entities (WorkOrders, Assets, Parts)
- [ ] Add OData-style filter support where the API supports it

### Phase 3: Analysis UX

- [ ] Add prompt templates for common CMMS analysis questions
- [ ] Add richer tool descriptions for LLM tool selection

### Phase 4: Hardening

- [ ] Tests
- [ ] Pagination, caching, rate-limit handling
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

- **PMs have no standalone API resource.** Preventive Maintenance appears only as a `Preventive` reference field on WorkOrders. PM-related questions must be answered by filtering work orders on that field. Confirm with MC team once credentials are available.
- **Auth is a placeholder.** `src/mc-client.ts` sends a `Bearer` token header. The actual auth scheme (API key, OAuth2, etc.) is unconfirmed — do not ship without resolving this.
- **Testing entry point:** `MC_API_KEY=your-key bun dev`, then call `mc_ping` from any MCP client.

## Open Questions

These must be answered before the API client can be built:

1. What auth scheme does the MC API use? (API key? OAuth2? Bearer token? Basic?)
2. Do we have a sandbox/non-prod MC environment to test against?
3. Which 3–5 entities are highest priority for the first release?
4. Which MCP client will connect first? (Claude Desktop, VS Code extension, custom?)
5. Are there PII or data sensitivity rules that constrain what we expose?
6. Natural-language-only filtering, structured filters, or both?

## Key Conventions

- All tools must be read-only (GET requests only in v1)
- API errors should surface as tool errors with the HTTP status and message
- Prefer pagination over fetching all records at once
- Use `$filter`, `$orderby`, `$top`, `$skip` OData params where available (the API supports them on list endpoints)
- Do not invent undocumented parameters — verify everything against `mc-normalized-api-map.json`
