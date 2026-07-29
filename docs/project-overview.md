# MC-MCP Project Overview

Orientation for engineers inheriting this repo, written for readers who have never touched an MCP server. It covers what was built, how it works, the slice of the Maintenance Connection (MC) API it exposes, and where the hard limits are. For setup and day-to-day usage, go straight to the [README](../README.md).

## What this is

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server that wraps the Accruent Maintenance Connection v8 REST API. It lets LLM clients (Claude Desktop, VS Code, etc.) answer natural-language questions about live CMMS data: work orders, assets and locations, inventory parts, and purchase orders. It is built to run as a multi-tenant HTTP service; clients hold their own MC credentials and pass them per session, so the server stores no secrets. It was formerly hosted on Railway under Gerald's personal account; that deployment is not active at the moment, so stand up a new host (see [`docs/deployment.md`](deployment.md)) before pointing clients at it.

## What an MCP server is

MCP (Model Context Protocol) is an open standard for connecting LLM applications to external systems. A server exposes three primitives over JSON-RPC, and the client (Claude Desktop here) makes them available to the model:

- **Tools**: functions the model can call. Here each tool is a scoped MC API query, like `mc_list_work_orders`.
- **Resources**: readable context documents. Here the `mc://context/*` resources serve reference data such as time anchors, the labor roster, the asset location tree, and lookup tables.
- **Prompts**: reusable analysis templates a user can invoke, like `mc_daily_maintenance_review`.

Clients talk to servers over stdio or HTTP. This server uses Streamable HTTP; Claude Desktop bridges to it with `mcp-remote` (wiring in the README).

## What has been built

- **Tool layer**: read-only list and get tools over five entity families (work orders, assets, parts, purchase orders, PO line items) plus `mc_ping` and `mc_list_datasets` for orientation. The README has the current tool table.
- **Context resources**: cached reference data (`src/resources/context.ts`) so the model does not re-fetch stable facts every session.
- **Prompt templates**: guided analyses (backlog review, PM compliance, vendor performance, and more), indexed in `src/prompts/PROMPTS.md`.
- **Multi-tenant deployment**: each session sends `X-MC-Basic-Auth` (and `X-MC-Base-URL` for staging vs production) headers; the server builds a per-session `McClient` with its own cache.

## How it is built

TypeScript on Bun, using `@modelcontextprotocol/sdk` v1 (the high-level `McpServer` API) with Zod schemas for every tool input and output. `src/server.ts` owns HTTP routing and sessions, `src/mc-client.ts` owns auth, retries, and caching, and each tool domain is one file under `src/tools/` sharing a common OData parameter shape. API knowledge comes from the pre-built artifacts in `api-docs/` (the normalized map is the source of truth; the chunks file supports fuzzy lookup), never from the raw swagger. `bun run test` covers client behavior, MCP contract, and domain handlers.

## Running it

Follow the [README](../README.md) for setup, credential encoding, local runs, tests, and connecting Claude Desktop. [`docs/deployment.md`](deployment.md) is the Railway runbook.

## API scope

The v8 spec (per `api-docs/mc-normalized-api-map.json`) contains 38 resource families and 251 operations: 122 GET, 61 POST, 68 PUT, and zero DELETE. This server wraps the read side of the five families above plus the reference families used by context resources (labors, lookup tables, classifications). Everything else (documents, images, meter history, specifications, invoices, receipts, cost actuals and estimates, companies) is unexposed but follows the same pattern; the `add-mc-tool-domain` skill in `.claude/skills/` walks through adding a family.

## Known limitations today

- **Large responses**: token blowouts are mitigated per tool (default `$top` on some list tools, `$fetchAll` capped at 2,000 records) but nothing bounds response bytes, and some context resources fetch without a ceiling, so they scale with tenant size.
- **`mc_get_*` is not "full detail"**: get tools parse with the same summary schemas as list tools, and unknown fields are stripped.
- **Hardening gaps on the public endpoint**: `X-MC-Base-URL` is not allowlisted, sessions are not bound to the credentials that created them and never expire, and there is no rate limiting.
- **OData quirk**: string filter values must use double quotes (`Type eq "CM"`); single quotes fail silently.

See [`docs/codebase-evaluation.md`](codebase-evaluation.md) for the ranked list and [`docs/user-feedback.md`](user-feedback.md) for tester reports.

## Ceiling if built out further

- **No PM schedule, procedure, or reporting endpoints exist in the v8 spec.** The most-requested tester features (FB-003, FB-004) cannot be built on this API; PM insight is limited to work orders with `Type eq "PM"`.
- **No `$select` and no aggregation endpoints.** Field trimming and computation cannot be pushed to the API, so every analysis pages raw records through the model. Context-window pressure is structural; only local record and byte budgets can contain it.
- **Writes are possible but out of scope.** The API exposes POST and PUT (no DELETE at all), so a write-capable MCP is technically feasible. Auth is a static tenant-wide key with no scoping, meaning a write build carries full-tenant blast radius; read-only was a deliberate v1 decision.

## Where to go next

The docs index in `CLAUDE.md` maps the rest: `future-work.md` (queued improvements, led by the large-response problem), `implementation-plan.md` (roadmap), `notable-findings.md` (API quirks), `open-questions.md`, and `phase3-prompts-and-repair-center.md`.
