# Codebase Evaluation — 2026-06-14

A point-in-time review of the MC-MCP server: what it is, where it's going, and its
shortcomings. Conducted on branch `gotchas-planning`. Build was clean (`bunx tsc`) and
the test suite passed (57 pass, 2 skipped live tests) at the time of review.

This is a snapshot. Line references and "current state" notes reflect the code as of the
date above — verify against the live source before acting on any item, since several of
these may have been addressed after this was written.

---

## What this is

A **read-only MCP server** wrapping the Maintenance Connection v8 REST API, deployed on
Railway as a **multi-tenant HTTP service**. Key architectural facts:

- **Credentials are per-session, never server-side.** Each client passes `X-MC-Basic-Auth`
  (and optionally `X-MC-Base-URL`) headers. `src/server.ts` builds a per-session `McClient`
  with its own cache. This is the post-refactor model; older docs still describe env-var
  credentials, which is wrong (see shortcoming #4).
- **Four tool domains:** work orders, assets, parts, purchase orders (+ PO line items).
  Each has `mc_list_*` and `mc_get_*`, sharing an OData input shape (`src/shared/odata.ts`).
- **Six context resources** (`mc://context/*` in `src/resources/context.ts`): time anchors,
  dataset guide, record counts, labor roster, location hierarchy, lookup tables. The dynamic
  ones use a TTL cache.
- **13 prompt templates** (`src/prompts/*.ts`) encoding analysis workflows in plain English,
  with a shared repair-center scoping helper (`repair-center.ts`).

**Direction (per docs):** finish the Analysis UX layer, address tester feedback (PMs/
procedures, token blowouts), then post-launch hardening (rate limiting). Code quality is
good for its stage — consistent patterns, real tests, deliberate error UX.

---

## Shortcomings

Ordered by how much they matter. Items #1 and #2 are the ones to treat as blocking before
putting this in front of a real customer tenant of unknown size; both are cheap to fix
relative to blast radius.

### 1. The token-blowout problem (FB-001) is mitigated per-tool, not solved

- `mc_list_assets` and `mc_list_parts` got a `DEFAULT_TOP` (100/200). But
  `mc_list_work_orders` and `mc_list_po_line_items` have **no default `$top`** — a bare call
  relies on MC's undocumented server-side default page size. Fine for this pilot tenant
  (645 WOs), unknown for the next one.
- **Nothing bounds bytes.** `$fetchAll` caps at 2,000 *records* (`FETCH_ALL_CAP`), but 2,000
  work orders at ~60 fields each is plausibly several hundred thousand tokens.
- **Context resources are worse.** `getAllPages` with no `$top` pages to exhaustion, so
  `mc://context/lookup-tables` returns every table with every value, and
  `mc://context/asset-locations` returns every location node. These scale with tenant size
  with no ceiling.
- **No `$select` available.** Confirmed zero occurrences in the API map — field trimming
  cannot be pushed to the API. The only systemic fix is local: a byte/record budget in
  `toListToolText` and caps on the resource loaders.

### 2. Security gaps on a public endpoint (`src/server.ts`)

- **`X-MC-Base-URL` is an SSRF vector.** The server honors any URL the client sends
  (`src/server.ts:112`) and issues GETs against it. The Railway endpoint is public and
  "auth" is merely *any non-empty* credentials header, so the server can be used as a GET
  proxy — including against Railway-internal addresses. Fix: allowlist the two known MC hosts
  (prod + staging).
- **Sessions aren't bound to credentials.** Reuse only checks the session ID exists and that
  *some* `X-MC-Basic-Auth` header is present — it never verifies the header matches the one
  that created the session. A leaked session ID lets someone ride another tenant's session.
  Fix: store a hash of the creating credentials, compare on reuse.
- **Sessions never expire.** The `Map` grows until transport close or process restart, and
  each session holds an `McClient` whose cache can contain full lookup-table/labor payloads.
  With `mcp-remote` clients reconnecting on every Claude Desktop restart, this is a slow
  memory leak. No eviction / idle TTL exists.
- **Base-URL fallback contradicts intent.** Commit d583dc0 says base URL is now *required*
  alongside credentials, but `loadConfig`/`server.ts` silently fall back to the prod default.
  Staging credentials without the header produce a confusing 401 against prod — exactly the
  failure that commit meant to prevent.

### 3. `mc_get_*` tools don't deliver "full details"

They parse responses with the **same summary schemas** as the list tools, and Zod strips
unknown keys by default — so the detail view returns exactly the list-view field set, with
no way to see anything outside the curated schema. Either use `.passthrough()` on the
get-by-PK path or stop describing them as "full details." Related: an unexpected *type* on a
known field fails the whole call, and `toToolError` surfaces the raw ZodError message (a JSON
blob of internal field paths) — which violates the project's own "no internal syntax reaches
end users" rule.

### 4. Docs have drifted from the code

This repo leans on docs as a source of truth more than most (agent workflows, skills,
CLAUDE.md-driven development), so drift here directly degrades future agent work.

- **CLAUDE.md** says `config.ts` reads `MC_API_KEY` (credentials haven't been server-side
  since the header refactor), describes `index.ts` as the stdio entry point, omits
  `server.ts` / `prompts/` / `tests/` entirely, and pins status at "Phase 2.5 complete."
- **user-feedback.md** marks FB-002 (pagination) Open even though `_pagination` / `nextSkip`
  / `$fetchAll` shipped.
- **beta-readiness.md** Segment 3 has the same pagination item unchecked.
- **README** project-structure section is similarly stale.

The `synchronize-claudemd` skill fits this cleanup.

### 5. The prompt layer is ahead of the tool layer on PMs

`mc_pm_compliance_review` ships today, but it can only see PM-*type work orders* — the actual
PM schedule and procedure entities testers asked for (FB-003 / FB-004) aren't exposed as
tools. Known and logged; worth noting that one shipped prompt partially writes checks the
tools can't cash yet.

### 6. Minor

- **`mc://context/time` uses the server's timezone** (UTC on Railway), so for a US user in
  the evening every relative date ("today", "yesterday", the `daysAgo` anchors) is off by one
  — and the prompts explicitly tell the model to trust this resource. Consider deriving the
  zone from the client or making it a parameter.
- **No MCP `readOnlyHint` annotations** on tools, which clients could use to signal safety.
- **Rate limiting absent** — already documented and planned (Segment 4), so not a surprise.

---

## What is *not* wrong

The architecture is sound. Per-session credential isolation, the context-resource layer, the
prompt scoping helper, the standardized tool-response/error helpers, and the test shape
(contract + transport weighted, no pointless E2E) are all good calls. The shortcomings above
are gaps to close, not a signal to rethink the design.
