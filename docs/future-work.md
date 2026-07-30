# Future Work

Improvement queue identified during the 2026-07-29 handoff pass. Ranked detail behind most items lives in [`codebase-evaluation.md`](codebase-evaluation.md). Items 9–11 and the amendments to items 2 and 3 were added from the 2026-07-29 full-surface tooling review ([`tooling-review-2026-07-29.md`](tooling-review-2026-07-29.md)). None of these block local use; items 1 and 2 should be treated as blocking before putting the server in front of a real customer tenant of unknown size.

## 1. Large responses vs the consuming agent's context window

This is the big one, and it is not a non-issue. FB-001 recorded a single tool call consuming roughly 1M tokens. The pressure is structural, not incidental:

- MC v8 has no `$select`, so field trimming cannot be pushed to the API.
- There are no aggregation or reporting endpoints, so every "how many / why" analysis pages raw rows through the model.
- Records are wide (a work order carries roughly 60 fields).
- The only server-side levers are `$top`, `$skip`, and the envelope `Total`.

Shipped mitigations: curated Zod summary schemas trim fields locally, `mc_list_assets` and `mc_list_parts` have default `$top` values, and `$fetchAll` caps at 2,000 records. Remaining gaps: `mc_list_work_orders` and `mc_list_po_line_items` have no default `$top`, nothing bounds response bytes (2,000 wide records can still be several hundred thousand tokens), and the dynamic context resources (`asset-locations`, `lookup-tables`) page to exhaustion, so they scale with tenant size.

Candidate fixes, cheapest first:

1. Default `$top` on every list tool.
2. Byte budget in `toListToolText`: truncate past a threshold and return `Total`, `nextSkip`, and guidance to narrow the filter.
3. Record and byte caps on the context-resource loaders.
4. Count-and-sample mode: past a threshold, return `Total`, the first N records, and suggested narrower filters instead of the full page.
5. Resource-link pattern: write oversized payloads to an MCP resource and return its URI, letting the client read selectively instead of receiving everything inline.

## 2. Endpoint hardening

Allowlist `X-MC-Base-URL` to the two known MC hosts (today any URL is honored, an SSRF vector on a public endpoint). Bind sessions to a hash of the creating credentials (today any holder of a session ID can reuse it). Add idle session expiry (today the session map only shrinks on transport close, a slow memory leak). Add rate limiting on our endpoint. Separately, MC-side rate limits are undocumented and recorded nowhere — state what is known (even if that is "unknown; no 429 observed") in `docs/notable-findings.md` as part of this work, per the design heuristics.

## 3. `mc_get_*` detail honesty

Get tools parse with the same summary schemas as list tools, and Zod strips unknown fields, so "full details" is not full. Measured against the swagger ViewModels (2026-07-29): `mc_get_asset` returns roughly 19 of 150 fields, work orders about 55 of 91, parts about 35 of 65, POs about 40 of 66. Either use `.passthrough()` on the get-by-PK path or change the tool descriptions to match reality.

## 4. Error UX and annotations

`toToolError` surfaces raw ZodError JSON (internal field paths) to end users; map validation failures to plain messages. Add MCP `readOnlyHint` annotations so clients can signal tool safety.

## 5. `mc_list_datasets` story

Older docs called the tool transitional in favor of `mc://context/datasets`, while the README tells users to call it first. Pick one story: retire the tool, or keep both and drop the transitional framing. Note that several MCP clients surface tools far more readily than resources, which argues for keeping the tool.

## 6. `mc://context/time` timezone

The resource uses the server's timezone (UTC on Railway), so relative dates ("today", "yesterday") are off by one for US users in the evening, and the prompt templates explicitly tell the model to trust this resource. Derive the zone from the client or accept it as a parameter.

## 7. Token cost audit

Moved from `docs/open-questions.md` (2026-07-29). The server offloads query planning to the model (endpoint choice, OData construction, raw-response interpretation), which is flexible but token-expensive per turn. Candidates: pre-built query tools that encode common complete queries ("open CMs this week by site"); trimming fields the model never uses; more cached context resources; and fewer, narrower tools where use cases are predictable. Shipped mitigation: the redundant per-prompt system string ("You are a maintenance operations assistant...") was removed from the 14 prompt bodies in `src/prompts/`; the same identity now lives once in the `McpServer` instructions.

## 8. Split the "no internal syntax" rule by context

Moved from `docs/open-questions.md` (2026-07-29). Keep the strict ban on OData and internal API syntax in tool descriptions, resource descriptions, and static copy, since those leak into user-facing responses verbatim. But allow targeted executable guidance (filter construction, tool-call sequences, internal field references) inside prompt message bodies, which are instructions to the model rather than text it echoes back. While splitting the rule, audit prompt bodies for gratuitous user-facing filter examples and check whether any tool or resource description ended up over-restricted by the blanket rule.

## 9. `$fetchAll` correctness

From the 2026-07-29 tooling review; do this in the same pass as item 1 — it is the same code.

- **Short-page break can silently under-fetch.** `McClient.getAllPages` treats a page shorter than the requested size as end-of-data (`src/mc-client.ts:167`). Pages are requested at 500; if MC ever clamps page size below the requested value (never live-probed), `$fetchAll` returns one page while reporting `fetchedAll: true` with `returned` far below `total`. Fix: stop only on an empty page, `skip >= Total`, or the requested top being reached. Add a regression test that simulates a clamping server.
- **Caller's `$top` is discarded.** All four list tools pass `{ ...params, $top: FETCH_ALL_CAP }` in the `$fetchAll` branch, so "fetch all but stop at 600" is impossible. Honor `min(caller $top, FETCH_ALL_CAP)`.

## 10. Tool coverage and the missing deferred-tools record

From the 2026-07-29 tooling review. The API map holds 122 GET operations across 38 resource families; the server exposes 5 families as tools plus 3 via context resources, and nothing records why the rest are out. Two parts:

**New domains** (use the `add-mc-tool-domain` skill), highest value first, each with a live demand signal:

| Family | Signal |
| --- | --- |
| PartLocations | On-hand/reorder quantities live only here — "are we out of X" is unanswerable today, and the datasets catalog admits it |
| WorkOrderAssignments | `mc_emergency_work_orders` asks "assigned and to whom", but `WorkOrderViewModel` only carries `IsAssigned`; assignee identity is `LaborRef` on assignments. Until built, soften that prompt line |
| WorkOrderTasks | Named in the FB-003/FB-004 resolutions as the nearest procedure substitute — never built |
| WorkOrder/PurchaseOrder StatusUpdates | Status-change history for "why is this stuck" aging analysis |
| WO Labor/Part/Misc cost actuals + estimates | Cost "why" questions — core to the project goal |
| Companies | Vendor prompts currently resolve vendors by sampling POs |

**Deferred-tools record:** the mcp-tool-designer heuristics require every excluded GET endpoint to be listed with a stated reason. Write that record (a table in this doc or a dedicated doc) so scope decisions stop being re-litigated from scratch.

## 11. Schema-discovery tool and surfacing filter knowledge

From the 2026-07-29 tooling review. `$filter` evaluates server-side against the full record, so the model can already filter on fields the trimmed summaries never show it — it just has no way to learn those fields exist. And two live-probed quirks sit only in `notable-findings.md` where no client model can see them: PO status filtering is `Status eq "ISSUED"` (`StatusDetails/Value eq ...` returns 400), and repair-center scoping uses the flat `RepairCenterID` / `RepairCenterPK` fields, not `RepairCenterRef/...` paths.

Candidates:

- Expose `GET /Schema/{model}` as an `mc_describe_entity_fields` tool so the model can discover filterable fields per entity (cheap, read-only, self-describing).
- Move the known filter quirks into the tool descriptions where models will hit them — coordinate with the item 8 rule split.
- Enrich the API map: add a `resourceFamily → ViewModel` mapping (every operation's `responseSchemaRefs` is the generic `ApiResponse`, so the operation→ViewModel link is currently a naming convention), and consider carrying the OData quirks in `usageNotes`.
