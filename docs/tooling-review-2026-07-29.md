# Tooling Review — 2026-07-29

A point-in-time, full-surface review of the MC-MCP server: tools, resources, prompts,
shared plumbing (`mc-client.ts`, `src/shared/`), and the API-knowledge layer
(`api-docs/` artifacts + the `maintenance-connection-api-rag` skill). Conducted on branch
`gotchas-planning`. Method: full source read, test run (57 pass, 2 skipped live tests,
0 fail), jq probes against `api-docs/mc-normalized-api-map.json`, then a diff against the
prior reviews (`codebase-evaluation.md` 2026-06-14, `future-work.md`).

This is a snapshot. Line references reflect the code as of the date above — verify
against live source before acting on any item.

Net-new findings from this review were folded into `future-work.md` as items 9–11, plus
amendments to items 2 and 3.

---

## State: healthy pilot-grade build, one structural problem, thin coverage

12 tools (ping, datasets, list+get for work orders / assets / parts / purchase orders,
PO line items), 6 context resources, 13 prompt templates. The architecture is right:
per-session credentials, shared OData input shape, standardized response/error helpers,
live-verified Zod summaries. Naming, read-only posture, pagination pattern, and domain
grouping all match FM360's MCP tool design heuristics.

`future-work.md` items 1–8 are accurate — this pass confirmed all of them
independently. What follows is mostly net-new; each finding is marked **[known]** or
**[net-new]**.

---

## Design quality — where tools deviate from what the API actually is

The MC v8 API gives you almost nothing to work with server-side: no `$select`
(0 mentions in the API map), no aggregation or reporting endpoints, a generic
`ApiResponse` envelope on every GET, and the swagger declares zero OData query params on
list endpoints — every filtering fact this project knows came from live probing
(`notable-findings.md`), not vendor docs. Given that, the curated-summary +
context-resource design is the correct response. But:

### 1. Own-rulebook deviation on caps **[known, reframed]**

The FM360 heuristics say: default list limit 50, drop to 20 for high-volume entities,
hard cap. Shipped: `$top` max 500 (`src/shared/odata.ts:22`), no default `$top` on work
orders — the highest-volume entity in any real tenant — and none on PO line items.
Already future-work item 1; this review adds that it also contradicts the team's own
written standard, not just general prudence.

### 2. `$fetchAll` under-fetches silently if MC clamps page size **[net-new, plausible]**

`getAllPages` treats a short page as end-of-data (`src/mc-client.ts:167`). The loop
requests pages of 500; if any tenant or endpoint clamps page size below the requested
value, the loop stops after one page while reporting `fetchedAll: true` with
`returned` far below `total`. MC's clamp behavior has never been live-probed. Cheap
fix: stop only on empty page, `skip >= Total`, or requested-top reached — and add a
regression test. Now future-work item 9.

### 3. `$fetchAll` discards the caller's `$top` **[net-new, minor]**

All four list tools pass `{ ...params, $top: FETCH_ALL_CAP }`
(e.g. `src/tools/work-orders.ts:22`), so "fetch all but stop at 600" is impossible.
Honor `min(caller $top, cap)`. Now part of future-work item 9.

### 4. Prompts promise data no tool can return **[net-new]**

`mc_emergency_work_orders` asks for "whether it is assigned and to whom"
(`src/prompts/operational.ts:219`). `WorkOrderViewModel` carries only `IsAssigned` —
assignee identity lives in the unexposed WorkOrderAssignments family (`LaborRef`,
confirmed in the API map). Same prompt-ahead-of-tools pattern the June evaluation caught
for PMs. Either build `mc_list_work_order_assignments` or soften the prompt. Now part of
future-work item 10.

### 5. `mc_get_*` "full details" claim, quantified **[known, now measured]**

Get tools parse with the list summary schemas, and Zod strips unknown fields. Measured
against the swagger ViewModels: `mc_get_asset` returns roughly 19 of 150 fields, work
orders about 55 of 91, parts about 35 of 65, POs about 40 of 66. The asset detail view
delivers 13% of what the API sends. `.passthrough()` on the get-by-PK path is the honest
fix (future-work item 3, now carrying these numbers). Related known issue: a type
surprise on any field fails the whole call and leaks raw ZodError JSON
(`src/shared/response.ts:74`, future-work item 4).

### 6. Filter knowledge trapped in docs **[net-new angle]**

The double-quote rule made it into tool descriptions, but the PO quirk
(`Status eq "ISSUED"` works; `StatusDetails/Value eq "ISSUED"` returns 400) and the flat
repair-center filter fields (`RepairCenterID` / `RepairCenterPK`, not
`RepairCenterRef/...`) live only in `notable-findings.md`. A client model will hit those
400s. Also: since `$filter` evaluates server-side against the full record, the model can
already filter on fields the trimmed summaries never show it — but has no way to learn
those fields exist. `GET /Schema/{model}` (unexposed; returns per-entity field metadata)
could power a cheap `mc_describe_entity_fields` tool that closes both gaps. Now
future-work item 11.

---

## Coverage: 10 of ~15 read families unexposed, none queued

The API map holds 122 GET operations across 38 resource families; the server exposes 5
families as tools plus 3 more via context resources. Fine as v1 scoping — but
`future-work.md` contained zero coverage items before this review, and the design
heuristics require an explicit deferred-tools record (every excluded GET endpoint with a
stated reason). No such record exists; `implementation-plan.md` has phase checklists,
not per-endpoint deferrals.

Highest-value gaps, each tied to a live demand signal:

| Family | Why it matters |
| --- | --- |
| PartLocations | On-hand/reorder quantities live here (per `notable-findings.md`) — "are we out of X" is unanswerable today; the datasets catalog openly admits the limitation |
| WorkOrderAssignments | Cashes the "assigned to whom" promise (finding 4) |
| WorkOrderTasks | Named in the FB-003/FB-004 resolutions as the nearest procedure substitute — never built |
| WorkOrder/PurchaseOrder StatusUpdates | Status history → "why is this stuck" aging analysis |
| Labor/Part/Misc cost actuals + estimates | Cost "why" questions — core to the project goal |
| Companies | Vendor prompts currently resolve vendors by sampling POs |

Now future-work item 10.

---

## API-knowledge layer

The map (251 operations, 122 GET, 38 families, 57 schemas, built 2026-03-11) and chunks
file (308 entries) are well built, and the two-stage RAG skill workflow is sound. One
structural weakness: every operation's `responseSchemaRefs` says `ApiResponse` →
`IApiResult`, so the operation→ViewModel link is only a naming convention the skill user
must know. Worth enriching the map with a `resourceFamily → ViewModel` mapping, and the
`usageNotes` fields (217 populated, all mechanical path-param notes today) could carry
the live-probed OData quirks. Folded into future-work item 11.

---

## Hygiene (fixed during this review)

- `docs/user-feedback.md`: FB-004's heading had been lost — its body sat inside the
  FB-005 section with a dead index anchor; FB-003's body status said `Open` while the
  index said `Won't Fix`. Both repaired 2026-07-29.
- MC-side rate limits are undocumented and were recorded nowhere, not even as
  "unknown" — the heuristics want that stated explicitly. Added to future-work item 2.

---

## Priority order

1. Response budget — future-work item 1 (defaults everywhere, byte cap in
   `toListToolText`, resource-loader caps); fix the `$fetchAll` issues (item 9) in the
   same pass, same code.
2. Endpoint hardening — future-work item 2; still blocking before any public redeploy.
3. Get-tool passthrough + ZodError mapping — items 3 and 4.
4. New domains: PartLocations, WorkOrderAssignments, WorkOrderTasks (the
   `add-mc-tool-domain` skill covers the mechanics); write the deferred-tools record for
   the rest — item 10.
5. Schema-endpoint helper tool + per-tool filter guidance — item 11, pairs with the
   item 8 rule split.

---

## Bottom line

Nothing here says rethink the design. It says: finish the response-size work before a
bigger tenant hits it, make the get tools honest, and let the tool layer catch up to
what the prompts and the API already support.
