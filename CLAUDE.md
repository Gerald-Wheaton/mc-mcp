# MC-MCP: Maintenance Connection MCP Server

## Project Goal

Build a read-only MCP server that wraps the Accruent Maintenance Connection (MC) REST API, enabling LLM clients to reason about a customer's CMMS data. The target experience is conversational: customers ask "why" questions about their facilities data and the LLM answers by querying live MC data.

**Current status:** the read-only tool layer (work orders, assets, parts, purchase orders, PO line items), the `mc://context/*` resource layer, and the prompt-template layer are all shipped, packaged as a multi-tenant HTTP server. There is currently no live deployment (the former Railway instance on Gerald's personal account is inactive). Queued improvements live in `docs/future-work.md`.

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
- **Auth:** HTTP Basic — `Authorization: Basic base64(CONNECTION_KEY:API_KEY)`. Connection key is the username (identifies tenant); API key is the password. The server never stores credentials: each MCP session supplies them via the `X-MC-Basic-Auth` header (plus optional `X-MC-Base-URL` for staging). The `MC_BASIC_AUTH_ENCODED` env var exists only for the live smoke tests.
- **NodeNext import convention:** local TypeScript source files use `.js` in import specifiers (for example `@/config.js`) because the repo emits ESM JavaScript into `dist/`. The files on disk are still `.ts`.
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
├── docs/                      # Reference docs (see Docs Index below)
├── tests/                     # bun test suite: client, routing, MCP contract, handlers, fixtures
└── src/
    ├── index.ts               # Bootstrap: loads config, starts the HTTP server
    ├── server.ts              # HTTP routing, sessions, per-session credentials, buildMcpServer()
    ├── config.ts              # Reads PORT and MC_BASE_URL; credentials are never server env
    ├── mc-client.ts           # McClient class: HTTP/auth/retry/cache logic; McApiError type
    ├── prompts/               # Prompt templates (indexed in src/prompts/PROMPTS.md) + repair-center helper
    ├── resources/
    │   └── context.ts         # mc://context/* MCP resources (time, summary, labors, asset-locations, lookup-tables, datasets)
    ├── shared/
    │   ├── datasets.ts        # Shared dataset catalog used by mc_list_datasets + mc://context/datasets
    │   ├── odata.ts           # odataShape — Zod fragment spread into every list tool ($filter/$top/$skip/$orderby)
    │   ├── response.ts        # toToolText() / toToolError() — standardizes all tool return values
    │   └── types.ts           # McApiResponse<T> envelope + minimal entity summary types
    └── tools/
        ├── ping.ts            # mc_ping — connectivity + auth check
        ├── datasets.ts        # mc_list_datasets — orientation tool over the shared dataset catalog
        ├── work-orders.ts     # mc_list_work_orders, mc_get_work_order
        ├── assets.ts          # mc_list_assets, mc_get_asset
        ├── parts.ts           # mc_list_parts, mc_get_part
        └── purchase-orders.ts # mc_list_purchase_orders, mc_get_purchase_order
```

### Adding a new tool domain

Use the **`add-mc-tool-domain` skill** — it covers API lookup, file creation, registration, type-checking, and README update.

## Working Principles & Key Conventions

- **Read-only by default.** No write/update/delete MCP tools in v1.
- **TypeScript + Bun.** Use `bun` as the package manager and runtime. Use `bunx` instead of `npx`.
- **Explicit schemas over ad hoc payloads.** Use Zod for all tool input/output; infer types via `z.infer<>`.
- **MCP SDK: `@modelcontextprotocol/sdk` v1** — use the `McpServer` + `registerTool` high-level API.
- **OData string filters require double quotes** — `Type eq "CM"` works; `Type eq 'CM'` fails. See `docs/notable-findings.md`.
- **Do not invent undocumented parameters** — verify everything against `mc-normalized-api-map.json`.
- **API errors** should surface as tool errors with the HTTP status and message.
- **Document decisions** in the relevant doc under `docs/` (e.g. resolve items in `docs/open-questions.md`) when material decisions are made.
- **Testing entry point:** `bun dev`, then `curl localhost:3000/health`; for end-to-end auth call `mc_ping` from an MCP client. Full suite: `bun run test`.

## Docs Index

| File                                       | Description                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `docs/project-overview.md`                 | Entry-point orientation for engineers new to the repo and to MCPs: what is built, how, API scope, limits |
| `docs/implementation-plan.md`              | Full roadmap: Phase 0–4 checklists, entity exploration status                           |
| `docs/notable-findings.md`                 | Per-entity research findings: auth, OData quirks, schema notes, live data snapshot      |
| `docs/open-questions.md`                   | Outstanding questions before next phase can proceed                                     |
| `docs/live-context-resources.md`           | Architectural ideation: MCP Resources as context layer (staleness tiers, resource URIs) |
| `docs/phase3-prompts-and-repair-center.md` | Repair center recon and Phase 3 prompt template plan                                    |
| `docs/user-feedback.md`                    | Feedback log from early testers — bugs, friction points, feature requests               |
| `docs/codebase-evaluation.md`              | Point-in-time review (2026-06-14): architecture summary + ranked shortcomings           |
| `docs/future-work.md`                      | Queued improvements, led by the large-response/context-window problem                   |
| `docs/deployment.md`                       | Runbook: env vars, Railway setup, credential format and rotation, log format, limits    |
| `docs/testing-strategy.md`                 | What the test suite protects and why: protocol wiring, contract, handlers               |
| `docs/beta-readiness.md`                   | Four-segment beta checklist (status lines may lag the code; verify before trusting)     |
| `docs/prompt-stress-tests.md`              | Manual QA prompts for validating repair-center scoping after prompt refactors           |
| `docs/management-presentation.md`          | Non-technical project overview for FM360 leadership (April 2026)                        |
