# User Feedback Log

Feedback collected during early testing of the MC-MCP server. Use this doc to track bugs, friction points, feature requests, and general impressions from testers.

---

## How to Log Feedback

Each entry should include:
- **Date** — when it was reported
- **Tester** — name or initials (optional)
- **Type** — Bug | Feature Request | UX/Friction | Question | Positive
- **Description** — what happened or what they said
- **Status** — Open | In Progress | Resolved | Won't Fix

---

## Feedback Index

| ID | Title | Type | Status | Date |
|----|-------|------|--------|------|
| [FB-005](#fb-005) | MCP config template does not work on Windows | UX/Friction | Open | 2026-07-29 |
| [FB-004](#fb-004) | Read access to PMs, Procedures, and custom reporting | Feature Request | Won't Fix (no API surface) | 2026-06-02 |
| [FB-003](#fb-003) | PM and Procedure endpoints missing from tool choices | Feature Request | Won't Fix (no API surface) | 2026-05-22 |
| [FB-002](#fb-002) | No pagination — tool only returns first page of results | Bug | Resolved | 2026-05-22 |
| [FB-001](#fb-001) | Tool call blew out context window with ~1M tokens | Bug | In Progress | 2026-05-22 |

---

<!-- Add new entries below. Most recent at the top. -->

---

## FB-005 — MCP config template does not work on Windows

**Date:** 2026-07-29
**Tester:** Gerald
**Type:** UX/Friction
**Status:** Open

**Description:**
The MCP client config template (`.mcp.template.json`) invokes `npx` directly. Windows MCP clients cannot resolve bare `npx` (`npx.cmd` is the actual executable), so the server never starts on a Windows machine. The template needs Windows-specific configuration.

**Suggested resolution:**
Add a Windows variant to the template (or a comment pointing to it) that routes through `cmd /c npx`, mirroring the Windows config already documented in the README's "Connecting to Claude Desktop" section.

**Date:** 2026-06-02
**Tester:** — (colleague, relayed)
**Type:** Feature Request
**Status:** Won't Fix (no API surface)

**Description:**
"Preventive Maintenance, Procedures, and custom reporting would be great for MCP to read."

The PM and Procedure portion reinforces [FB-003](#fb-003). The new piece is **custom reporting** — exposing the customer's saved/custom MC reports (or their output) as something the MCP server can read.

**Suggested resolution:**
- PMs / Procedures: see FB-003 (use the `add-mc-tool-domain` skill).
- Custom reporting: investigate whether the MC v8 API exposes report definitions or report execution endpoints — check `mc-normalized-api-map.json` / `mc-llm-api-chunks.json` for a Reports tag or similar. If no API surface exists, document that as a limitation and consider whether equivalent insight can be delivered via existing list tools + prompt templates.

**Resolution (2026-07-29):** The v8 spec exposes no PM-schedule, procedure, or reporting endpoints; all 38 resource families in `api-docs/mc-normalized-api-map.json` were checked. This cannot be built on the current API. Documented as a ceiling in `docs/project-overview.md` and `docs/future-work.md`.

---

## FB-003 — PM and Procedure endpoints missing from tool choices

**Date:** 2026-05-22
**Tester:** —
**Type:** Feature Request
**Status:** Open

**Description:**
PMs (Preventive Maintenance schedules) and their associated Procedures (task lists / steps attached to PMs) are not currently exposed as tool-callable endpoints. Testers need to be able to query PM records and the procedure steps tied to them.

**Suggested resolution:**
Add `mc_list_pms`, `mc_get_pm`, and procedure sub-resource tools (e.g. `mc_list_pm_procedures`) using the `add-mc-tool-domain` skill. Verify available endpoints against `mc-normalized-api-map.json` first.

**Resolution (2026-07-29):** Verified against the API map: the v8 spec contains no PM-schedule or procedure endpoints, so these tools cannot be built. Nearest substitutes are work orders filtered with `Type eq "PM"` and the WorkOrderTasks family. See `docs/project-overview.md` (ceiling section).

---

## FB-002 — No pagination — tool only returns first page of results

**Date:** 2026-05-22
**Tester:** —
**Type:** Bug
**Status:** Resolved

**Description:**
List tools only return the first batch of results (controlled by `$top`). There is no mechanism to page through the full dataset, meaning large result sets are silently truncated. Users may be missing data without knowing it.

**Suggested resolution:**
Add a pagination loop (or cursor-based `$skip` support) to list tools so callers can retrieve all matching records across pages. Consider adding a `fetchAll` mode that auto-pages up to a safe ceiling, and surface total count when the API provides it.

**Resolution (2026-07-29):** Shipped. List tools return `_pagination` metadata with `nextSkip`, and `$fetchAll` auto-pages up to a 2,000-record cap.

---

## FB-001 — Tool call blew out context window with ~1M tokens

**Date:** 2026-05-22
**Tester:** —
**Type:** Bug
**Status:** In Progress

**Description:**
A tool call returned so much data that it consumed approximately 1 million tokens in the context window. This is not acceptable — it degrades LLM performance, inflates cost, and can crash the session entirely.

**Suggested resolution:**
Implement response trimming / truncation at the tool layer. Options to evaluate:
- Hard cap on number of records returned (e.g. max 50 by default, configurable via `$top`)
- Summarize large payloads instead of returning raw JSON
- Strip high-cardinality / low-signal fields before returning to the LLM
- Return a count + sample when result set exceeds a threshold, with instructions to narrow the query

**Resolution (2026-07-29):** Partially mitigated: default `$top` on `mc_list_assets` and `mc_list_parts`, plus the `$fetchAll` 2,000-record cap. The systemic fix (default `$top` everywhere, byte budgets, resource-loader caps) is item 1 in `docs/future-work.md`.

---

