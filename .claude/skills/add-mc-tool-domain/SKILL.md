---
name: add-mc-tool-domain
description: Add a new tool domain (resource family) to the MC-MCP server — use this when the user asks to add tools for a new MC API resource like Invoices, Labors, Companies, etc.
---

# Add MC Tool Domain Skill

## Contracts

Read `.claude/skills/add-mc-tool-domain/contracts.json` at the start of this skill. It defines the required files to create/modify, naming conventions, and verification steps that must be followed.

## When to use this skill

Use this skill when the user asks to:

- Add tools for a new MC API resource family (e.g., Invoices, Labors, Companies, Classifications)
- Expose a new entity to MCP clients
- Implement list/get tools for an endpoint not yet in the server

## The authoritative pattern

**`src/tools/purchase-orders.ts` is the reference implementation.** Read it before writing any code and mirror it exactly — registration call shape, import style, `$fetchAll` handling, Zod parsing, error handling. If anything in this skill disagrees with that file, the file wins.

What the reference demonstrates and every new domain must reproduce:

- `server.registerTool(name, { description, inputSchema }, handler)` — the object-config SDK API
- Imports via the `@/` path alias, never relative `../` paths
- List handlers spread `...odataShape`, split off `$fetchAll`, and branch: `client.getAllPages(path, { params: { ...params, $top: FETCH_ALL_CAP } })` when set, plain `client.get(path, { params })` otherwise
- Every raw response is validated with a Zod schema (`.parse(raw)`) before returning
- List results return via `toListToolText(data, params.$skip ?? 0)` — with `{ fetchedAll: true, cappedAt: FETCH_ALL_CAP }` on the fetch-all branch; single records return via `toToolText`
- All handlers wrap in try/catch and return `toToolError(err)` on failure

## Prerequisites

Before writing any code, use the `maintenance-connection-api-rag` skill to look up the target resource:

1. Search `mc-llm-api-chunks.json` for the resource family name
2. Verify exact paths, path params, and query params in `mc-normalized-api-map.json`
3. Note the exact casing of path segments (e.g., `/Assets` vs `/workorders` — they differ)

Never invent endpoint paths. Confirm against the normalized map first.

## Implementation checklist

### Step 1 — Look up the API endpoints

Use the RAG skill to find:

- `GET /<Resource>` — list endpoint path (exact casing)
- `GET /<Resource>/{pk}` — single-record endpoint path and path param name
- Any required query params beyond standard OData
- The response schema name (usually `ApiResponse` for lists)

### Step 2 — Add a Zod summary schema to `src/shared/types.ts`

Add `<Entity>SummarySchema`, mirroring `PurchaseOrderSummarySchema`: include only fields confirmed against the normalized map (or better, a real API response), never the full Swagger schema. Add fields incrementally as they are verified, and keep unverified-but-likely fields `.nullable().optional()`.

### Step 3 — Create `src/tools/<domain>.ts`

Copy `src/tools/purchase-orders.ts` and adapt. Two gotchas the reference file demonstrates but that are easy to miss:

- Single-record GET endpoints return the same `ApiResponse` envelope as list endpoints — parse the get response with the **list** schema (`McApiResponseSchema(<Entity>SummarySchema)`), not a bare entity schema.
- Do not drop the `$fetchAll` branch from list handlers; without it the new tool silently lacks the paging behavior every sibling tool has.

### Step 4 — Register in `src/server.ts`

Registration happens inside `buildMcpServer()` in `src/server.ts` (not `src/index.ts`, which is only the HTTP bootstrap). Add one import alongside the other tool imports and one `register<Domain>(server, client)` call alongside the existing register calls.

### Step 5 — Add the dataset catalog entry

Add an entry to `DATASETS` in `src/shared/datasets.ts` (name, description, tools, bestFor, notes), matching the existing entries' plain, analyst-facing language. This single entry feeds both the `mc_list_datasets` tool and the `mc://context/datasets` resource — skipping it leaves the new domain invisible to orientation queries.

### Step 6 — Update the tests

- `tests/server.test.ts` asserts the **exact** tool-name array in the `exposes tools, prompts, and resources over MCP initialize` test — add the new tool names in registration order or the suite fails.
- Add handler tests to `tests/tool-handlers.test.ts` mirroring an existing list/get pair: `FakeMcClient.whenGet(...)` fixtures, a happy-path list test (params forwarded, payload parsed), a get test, and an error-surfacing test.

### Step 7 — Verify

```bash
bunx tsc --noEmit
bun run test
```

Fix errors before shipping. Common issues:

- Path param name wrong (check the normalized map — it may be `assetPK`, not `pk`)
- Path casing wrong (the API mixes `/Assets` and `/workorders` styles)
- Zod schema too strict for real payloads (loosen fields to `.nullable().optional()`)

## Tool description guidelines

The description field is read by the LLM to decide when to call the tool. Write it for an analyst, not a developer — say what the entity is and what questions the tool answers.

**Hard rule, test-enforced:** descriptions must not contain raw query syntax. The `keeps tool, prompt, and resource descriptions free of raw query syntax` test in `tests/server.test.ts` fails the suite if any tool, prompt, or resource description matches the `USER_FACING_TECHNICAL_PATTERNS` list: `$filter`, `$orderby`, `$top`, `$skip`, `OData`, `eq`, `PK`, or field-path syntax like `StatusDetails/Value`.

- **Good:** "List purchase orders from Maintenance Connection. Useful for open commitments, approval-pipeline reviews, vendor activity, and purchase-order aging analysis."
- **Bad:** "GET /Invoices endpoint wrapper" (developer-speak), or "Use $filter to narrow by status" (fails the description lint)

Instead of "PK", say "internal Maintenance Connection record number" — see the live get-tool descriptions. Query-syntax guidance belongs in the shared `odataShape` param descriptions, which already carry it.

Also add `.describe()` to any tool-specific params beyond OData, in the same plain language.

## After adding the domain

1. Update the `## Available Tools` table in `README.md` — one row per new tool, following the existing format.
2. Update `docs/implementation-plan.md` Phase 2 checklist to mark the new entity as done.
3. If the API lookup surfaced quirks (odd casing, undocumented params, envelope surprises), record them in `docs/notable-findings.md` under a per-entity heading.
