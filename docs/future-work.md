# Future Work

Improvement queue identified during the 2026-07-29 handoff pass. Ranked detail behind most items lives in [`codebase-evaluation.md`](codebase-evaluation.md). None of these block local use; items 1 and 2 should be treated as blocking before putting the server in front of a real customer tenant of unknown size.

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

Allowlist `X-MC-Base-URL` to the two known MC hosts (today any URL is honored, an SSRF vector on a public endpoint). Bind sessions to a hash of the creating credentials (today any holder of a session ID can reuse it). Add idle session expiry (today the session map only shrinks on transport close, a slow memory leak). Add rate limiting.

## 3. `mc_get_*` detail honesty

Get tools parse with the same summary schemas as list tools, and Zod strips unknown fields, so "full details" is not full. Either use `.passthrough()` on the get-by-PK path or change the tool descriptions to match reality.

## 4. Error UX and annotations

`toToolError` surfaces raw ZodError JSON (internal field paths) to end users; map validation failures to plain messages. Add MCP `readOnlyHint` annotations so clients can signal tool safety.

## 5. `mc_list_datasets` story

Older docs called the tool transitional in favor of `mc://context/datasets`, while the README tells users to call it first. Pick one story: retire the tool, or keep both and drop the transitional framing. Note that several MCP clients surface tools far more readily than resources, which argues for keeping the tool.

## 6. `mc://context/time` timezone

The resource uses the server's timezone (UTC on Railway), so relative dates ("today", "yesterday") are off by one for US users in the evening, and the prompt templates explicitly tell the model to trust this resource. Derive the zone from the client or accept it as a parameter.

## 7. Token cost audit

Moved from `docs/open-questions.md` (2026-07-29). The server offloads query planning to the model (endpoint choice, OData construction, raw-response interpretation), which is flexible but token-expensive per turn. Candidates: pre-built query tools that encode common complete queries ("open CMs this week by site"); trimming fields the model never uses; more cached context resources; fewer, narrower tools where use cases are predictable; and removing the redundant per-prompt system string ("You are a maintenance operations assistant...") repeated 14 times across the five files in `src/prompts/`, since the same identity is already set at the `McpServer` level.

## 8. Split the "no internal syntax" rule by context

Moved from `docs/open-questions.md` (2026-07-29). Keep the strict ban on OData and internal API syntax in tool descriptions, resource descriptions, and static copy, since those leak into user-facing responses verbatim. But allow targeted executable guidance (filter construction, tool-call sequences, internal field references) inside prompt message bodies, which are instructions to the model rather than text it echoes back. While splitting the rule, audit prompt bodies for gratuitous user-facing filter examples and check whether any tool or resource description ended up over-restricted by the blanket rule.
