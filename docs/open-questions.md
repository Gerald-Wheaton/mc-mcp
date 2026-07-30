# Open Questions

These must be answered before the relevant work can proceed.

> **Status (2026-07-29):** closed out. Every numbered question is resolved and the deferred TODOs moved to `docs/future-work.md` (items 7 and 8). New open questions should still be logged here per the convention in `CLAUDE.md`.

1. ~~What auth scheme does the MC API use?~~ **Resolved:** HTTP Basic, `base64(CONNECTION_KEY:API_KEY)`
2. ~~Which 3–5 entities are highest priority?~~ **Resolved:** Assets, Work Orders (CM), PMs (PM), Work Requests (SR)
3. ~~DEV environment — does it use a different base URL? Is the DEV connection key provisioned?~~ **Resolved:** Yes: staging lives at `https://api-stage.maintenanceconnection.com/v8`, selected per session via the `X-MC-Base-URL` header. Staging credentials are provisioned and in active use.
4. ~~Which MCP client will connect first? (Claude Desktop, VS Code extension, custom?)~~ **Resolved:** Claude Desktop will be first
5. ~~Are there PII or data sensitivity rules that constrain what we expose?~~ **Resolve:** Not as of now
6. ~~Natural-language-only filtering, structured filters, or both?~~ **Resolved:** The backend can use structured filters, but user-facing prompt/tool/resource copy should stay plain English.

## TODO: Token Cost Audit

**Moved (2026-07-29)** to `docs/future-work.md` item 7.

---

## TODO: Refine the "No Internal Syntax" Rule to Distinguish Context

**Moved (2026-07-29)** to `docs/future-work.md` item 8.

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
