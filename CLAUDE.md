# MC-MCP: Maintenance Connection MCP Server

## Project Goal

Build a read-only MCP server that wraps the Accruent Maintenance Connection (MC) REST API, enabling LLM clients to reason about a customer's CMMS data. The target experience is conversational: customers ask "why" questions about their facilities data and the LLM answers by querying live MC data.

**Current status:** Phase 2.5 (deep entity exploration) is complete, and the first Phase 3 context resources are now shipped. Next up is finishing the Analysis UX layer on top of that context foundation.

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
└── src/
    ├── index.ts               # Server entry point — creates McClient, registers all tools, connects transport
    ├── config.ts              # Reads MC_BASE_URL and MC_API_KEY; throws on missing values
    ├── mc-client.ts           # McClient class — all HTTP/auth logic; McApiError type
    ├── resources/
    │   └── context.ts         # mc://context/* MCP resources (time, summary, labors, asset-locations, datasets)
    ├── shared/
    │   ├── datasets.ts        # Shared dataset catalog used by the transitional tool + preferred context resource
    │   ├── odata.ts           # odataShape — Zod fragment spread into every list tool ($filter/$top/$skip/$orderby)
    │   ├── response.ts        # toToolText() / toToolError() — standardizes all tool return values
    │   └── types.ts           # McApiResponse<T> envelope + minimal entity summary types
    └── tools/
        ├── ping.ts            # mc_ping — connectivity + auth check
        ├── datasets.ts        # mc_list_datasets — transitional compatibility tool; prefer mc://context/datasets
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
- **Document decisions** in `docs/interview-log.md` when material decisions are made.
- **Testing entry point:** `bun --env-file=.env run src/index.ts`, then call `mc_ping` from any MCP client.

## Docs Index

| File                                       | Description                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `docs/implementation-plan.md`              | Full roadmap: Phase 0–4 checklists, entity exploration status                           |
| `docs/notable-findings.md`                 | Per-entity research findings: auth, OData quirks, schema notes, live data snapshot      |
| `docs/open-questions.md`                   | Outstanding questions before next phase can proceed                                     |
| `docs/live-context-resources.md`           | Architectural ideation: MCP Resources as context layer (staleness tiers, resource URIs) |
| `docs/phase3-prompts-and-repair-center.md` | Repair center recon and Phase 3 prompt template plan                                    |
| `docs/user-feedback.md`                    | Feedback log from early testers — bugs, friction points, feature requests               |
| `docs/codebase-evaluation.md`              | Point-in-time review (2026-06-14): architecture summary + ranked shortcomings           |
