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
| [FB-004](#fb-004) | Read access to PMs, Procedures, and custom reporting | Feature Request | Open | 2026-06-02 |
| [FB-003](#fb-003) | PM and Procedure endpoints missing from tool choices | Feature Request | Open | 2026-05-22 |
| [FB-002](#fb-002) | No pagination — tool only returns first page of results | Bug | Open | 2026-05-22 |
| [FB-001](#fb-001) | Tool call blew out context window with ~1M tokens | Bug | Open | 2026-05-22 |

---

<!-- Add new entries below. Most recent at the top. -->

---

## FB-004 — Read access to PMs, Procedures, and custom reporting

**Date:** 2026-06-02
**Tester:** — (colleague, relayed)
**Type:** Feature Request
**Status:** Open

**Description:**
"Preventive Maintenance, Procedures, and custom reporting would be great for MCP to read."

The PM and Procedure portion reinforces [FB-003](#fb-003). The new piece is **custom reporting** — exposing the customer's saved/custom MC reports (or their output) as something the MCP server can read.

**Suggested resolution:**
- PMs / Procedures: see FB-003 (use the `add-mc-tool-domain` skill).
- Custom reporting: investigate whether the MC v8 API exposes report definitions or report execution endpoints — check `mc-normalized-api-map.json` / `mc-llm-api-chunks.json` for a Reports tag or similar. If no API surface exists, document that as a limitation and consider whether equivalent insight can be delivered via existing list tools + prompt templates.

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

---

## FB-002 — No pagination — tool only returns first page of results

**Date:** 2026-05-22
**Tester:** —
**Type:** Bug
**Status:** Open

**Description:**
List tools only return the first batch of results (controlled by `$top`). There is no mechanism to page through the full dataset, meaning large result sets are silently truncated. Users may be missing data without knowing it.

**Suggested resolution:**
Add a pagination loop (or cursor-based `$skip` support) to list tools so callers can retrieve all matching records across pages. Consider adding a `fetchAll` mode that auto-pages up to a safe ceiling, and surface total count when the API provides it.

---

## FB-001 — Tool call blew out context window with ~1M tokens

**Date:** 2026-05-22
**Tester:** —
**Type:** Bug
**Status:** Open

**Description:**
A tool call returned so much data that it consumed approximately 1 million tokens in the context window. This is not acceptable — it degrades LLM performance, inflates cost, and can crash the session entirely.

**Suggested resolution:**
Implement response trimming / truncation at the tool layer. Options to evaluate:
- Hard cap on number of records returned (e.g. max 50 by default, configurable via `$top`)
- Summarize large payloads instead of returning raw JSON
- Strip high-cardinality / low-signal fields before returning to the LLM
- Return a count + sample when result set exceeds a threshold, with instructions to narrow the query

---

