# Open Questions

These must be answered before the relevant work can proceed.

1. ~~What auth scheme does the MC API use?~~ **Resolved:** HTTP Basic, `base64(CONNECTION_KEY:API_KEY)`
2. ~~Which 3–5 entities are highest priority?~~ **Resolved:** Assets, Work Orders (CM), PMs (PM), Work Requests (SR)
3. DEV environment — does it use a different base URL? Is the DEV connection key provisioned?
4. ~~Which MCP client will connect first? (Claude Desktop, VS Code extension, custom?)~~ **Resolved:** Claude Desktop will be first
5. ~~Are there PII or data sensitivity rules that constrain what we expose?~~ **Resolve:** Not as of now
6. ~~Natural-language-only filtering, structured filters, or both?~~ **Resolved:** The backend can use structured filters, but user-facing prompt/tool/resource copy should stay plain English.

## TODO: Token Cost Audit

**Deferred — revisit before production hardening.**

The MCP currently offloads significant work to the LLM: deciding which endpoints to call, constructing OData filters, interpreting raw API responses, etc. This is flexible but expensive in tokens per conversation turn.

Worth exploring at some point:

- **Pre-built query methods** — specific tools that encode a complete, common query (e.g. "open CMs this week by site") rather than asking the model to compose filters on the fly.
- **Slimmer tool output** — are we returning fields the model never uses? Trimming response payloads reduces both prompt and completion tokens.
- **Context resource caching** — resources like `mc://context/summary` already amortize expensive calls; are there more candidates?
- **Tool count vs. tool breadth** — fewer, narrower tools can be cheaper than many general-purpose ones if the use cases are predictable.
- **Strip redundant prompt copy** — the system role string `"You are a maintenance operations assistant with access to live Maintenance Connection data."` appears 14 times across `src/prompts/assets.ts`, `pm.ts`, `operational.ts`, `inventory.ts`, and `procurement.ts` as a hardcoded `system` message inside every `registerPrompt` messages array. Now that this identity is established at the `McpServer` level, these per-prompt copies are redundant and burn tokens on every prompt invocation. They should be removed.

The goal is to understand the per-conversation token budget and identify the highest-leverage reduction opportunities before scaling to more users.

---

## TODO: Refine the "No Internal Syntax" Rule to Distinguish Context

**Deferred — related to the OData concern below.**

The current rule (no OData or internal API syntax in user-facing copy) is a blanket assertion applied uniformly. It should be split into two narrower, context-aware rules:

- **Tool descriptions, resource descriptions, and static copy** — no internal syntax at all. These are surfaced passively to the LLM and can leak into user-facing responses verbatim. The prohibition stays strict here.
- **Prompt message bodies** (e.g. `src/prompts/procurement.ts`, `assets.ts`, `pm.ts`, `operational.ts`, `inventory.ts`) — targeted executable guidance is appropriate. These are instructions *to* the model about how to carry out a specific workflow, not text the model will echo back. OData filter construction instructions, step-by-step tool call sequences, and internal field references belong here and should not be stripped.

The investigation should also check whether any prompt message body text contains gratuitous leakage (filter syntax shown as an example to the user rather than as a private execution instruction) that the blanket rule was rightly catching — and whether any tool description or resource description is too restrictive as a result of the same rule.

---

## UX Design Concern: Never Expose OData to End Users

**Resolved in runtime copy.** End users are facility managers and maintenance techs — not developers. The LLM must never suggest OData filter syntax in its replies (e.g. `IsLocation eq false`). That phrasing is meaningless to the target audience and actively harmful if they try to act on it.

The right pattern: if the LLM wants to offer a filtered view, it should say "I can show you equipment only if you'd like" and then apply the filter itself on the next tool call. The OData mechanics stay entirely on the backend.

Example of what went wrong:
> "If you want a meaningful equipment-only count, filtering `IsLocation eq false` would trim that significantly."

What it should say instead:
> "That 33,639 total includes location nodes (buildings, campuses, floors), not just equipment. Want me to pull the equipment-only count?"

The runtime prompt templates, tool descriptions, and resource descriptions now follow that pattern.
Raw filter syntax should stay only in developer-facing docs such as `docs/notable-findings.md`,
`docs/phase3-prompts-and-repair-center.md`, and related implementation notes.
