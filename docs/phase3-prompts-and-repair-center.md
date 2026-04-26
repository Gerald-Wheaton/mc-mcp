# Phase 3: Prompt Args & Repair Center Filtering

> **Status:** Research complete, core implementation landed on 2026-04-22.
> Prompt templates now support scoped args, including repair center by exact ID or case-insensitive exact name. Keep this doc for rationale and follow-on ideas.

---

## 1. Repair Center — Recon Findings (2026-03-30)

### What it is

A `RepairCenterRef` is a first-class organizational scope in MC. Think of it as the top-level multi-tenancy boundary within a single MC connection. A university might have "Main Campus", "Agricultural Campus", and "Medical Center" as separate repair centers — each managing its own WOs, assets, inventory, and POs independently.

### Where RepairCenterRef lives

| Entity | Present in schema? | Populated (this client) |
|---|---|---|
| WorkOrders | Yes | 645/645 (100%) — all "Main" |
| Assets | Yes | 33,639/33,639 (100%) — all "MAIN" |
| PurchaseOrders | Yes | 44/74 (59%) — 30 records are null |
| Parts | **No** | Not on PartViewModel schema |

### Filter syntax (confirmed working on live prod API)

```
RepairCenterPK eq 1          ✓  integer PK — works on WOs, Assets, POs
RepairCenterID eq "M"        ✓  string ID with double-quote convention — confirmed on WOs
RepairCenterRef/PK eq 1      ✗  navigation path — fails: "Expression of type 'Boolean' expected"
RepairCenterRef/ID eq "M"    ✗  navigation path — same error
```

Use **flat scalar fields** (`RepairCenterPK`, `RepairCenterID`), not the navigation path. This matches the pattern seen elsewhere in MC's OData implementation.

### This client's data

- Single repair center: `PK=1, ID="M", Name="Main"`
- Filtering by RC is equivalent to no filter for this client — it's their only scope
- The 30 null POs are a data quality issue, not a second repair center

**Capitalization gotcha:** WOs store `"Name":"Main"`, Assets store `"Name":"MAIN"` — same repair center, inconsistent casing. Never match on `Name`; use `PK` or `ID`.

### Discovery problem

There is **no `/repaircenter` or `/repairecenters` API endpoint** to enumerate available repair centers. For multi-site clients, the LLM must discover them by sampling records (e.g., inspecting `RepairCenterRef` values from a small WO or Asset fetch). Consider surfacing this in a future `mc://context/repair-centers` resource or by adding a discovery note to `mc_list_datasets`.

### Zod schema update needed

`RepairCenterRef` is missing from the current Zod schemas in `src/shared/types.ts` for WorkOrders, Assets, and PurchaseOrders. Add it as:

```typescript
RepairCenterRef: EntityRefSchema.nullable()
```

(Nullable to account for the 30 null PO records.)

---

## 2. Prompt Args Plan

### The approach: optional args for "scoped or fleet-wide"

The MCP `registerPrompt` API supports an `argsSchema` (same Zod pattern as tools). When args are defined, the client renders an "Enter prompt inputs" dialog before firing. When a field is `z.string().optional()`, the field appears in the dialog but the user can leave it blank — the prompt callback then branches:

```typescript
server.registerPrompt(
  'mc_asset_health_check',
  {
    title: 'Asset health check',
    description: '...',
    argsSchema: {
      asset_name: z.string().optional().describe('Name or partial name of the asset to analyze'),
    },
  },
  (args) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: args.asset_name
          ? `...scoped report for asset matching "${args.asset_name}"...`
          : `...fleet-wide top-assets-by-open-CMs report...`
      }
    }]
  })
)
```

**Required args** (always show the dialog, user must fill in): use when the prompt makes no sense without the value (e.g. Limble's `asset_health_check` — analyzing a specific asset requires knowing which one).

**Optional args** (dialog shows, can be skipped): use when the prompt has a meaningful fleet-wide default but can also be scoped down.

We prefer **optional** here so a single prompt covers both the "overall report" and the "specific thing" use cases without duplicating prompt entries in the client UI.

### Which prompts get args (and which args)

#### Repair center prompt args (implemented)

Applies to all WO, Asset, and PO prompts. Not applicable to Parts prompts (RepairCenterRef is absent from the Parts schema).

Implemented prompt args:
- `repair_center_id` — exact ID, injected as `RepairCenterID eq "{value}"`
- `repair_center_name` — resolved from sampled `RepairCenterRef` values using case-insensitive exact-name matching, then converted to `RepairCenterID eq "{resolvedID}"`

If both are supplied, the prompt fails fast and asks the user to provide only one.
If the provided repair center name resolves to zero matches, the prompt tells the model to stop and report that it could not be resolved.
If the provided repair center name resolves to more than one exact match after normalization, the prompt tells the model to stop and report that duplicate repair centers were found.

| Prompt | `repair_center` arg |
|---|---|
| `mc_daily_maintenance_review` | optional |
| `mc_open_work_order_backlog` | optional |
| `mc_unassigned_work_orders` | optional |
| `mc_emergency_work_orders` | optional |
| `mc_asset_health_check` | optional |
| `mc_location_equipment_breakdown` | optional |
| `mc_pm_compliance_review` | optional |
| `mc_inspection_summary` | optional |
| `mc_open_purchase_orders` | optional |
| `mc_vendor_performance` | optional |
| `mc_po_approval_pipeline` | optional |
| `mc_reserved_parts_audit` | optional (scopes the WO side) |
| `mc_inventory_audit` | — (Parts has no RC) |
| `mc_slow_moving_parts` | — (Parts has no RC) |

#### Entity-scoping args (per-prompt, secondary priority)

These narrow the prompt to a specific asset, vendor, or WO type:

| Prompt | Additional optional arg | Description / placeholder |
|---|---|---|
| `mc_open_work_order_backlog` | `type` | WO type code to focus on (CM, PM, IN, SR, etc.) |
| `mc_unassigned_work_orders` | `type` | WO type code to focus on |
| `mc_asset_health_check` | `asset_name` | Name or partial name of the asset to analyze |
| `mc_reserved_parts_audit` | `asset_name` | Limit to WOs for a specific asset |
| `mc_inventory_audit` | `category` | Part category name to scope the audit |
| `mc_slow_moving_parts` | `category` | Part category name to scope the report |
| `mc_pm_compliance_review` | `asset_name` | Limit PMs to a specific asset |
| `mc_open_purchase_orders` | `vendor_name` | Limit to POs for a specific vendor |
| `mc_vendor_performance` | `vendor_name` | Focus on a single vendor vs. all |

### Recommended implementation order

1. **Add repair center args first** — `repair_center_id` / `repair_center_name`
2. **Add entity-scoping args** — `asset_name`, `vendor_name`, `type`, `category`
3. **Keep filtering on `RepairCenterID`** — never on `RepairCenterRef/...`

### Prompt text branching pattern

When `repair_center` is provided, prepend a scoping instruction at the top of the prompt text:

```
// With repair_center = "East Campus"
"All queries in this analysis should be scoped to Repair Center ID \"East Campus\" using the filter RepairCenterID eq \"East Campus\"."

// Without repair_center
"Queries should cover all repair centers (no repair center filter)."
```

When an entity-scope arg is provided (e.g. `asset_name`), add the lookup step at the top:

```
// With asset_name = "Air Compressor"
"First use mc_list_assets with $filter=Name contains \"Air Compressor\" to identify the target asset PK and Name, then scope subsequent queries to that asset."
```

---

## 3. Implementation Checklist

- [x] Update `src/shared/types.ts` — add `RepairCenterRef: EntityRefSchema.nullable()` to WorkOrder, Asset, PurchaseOrder Zod schemas
- [x] Update `src/prompts/operational.ts` — add optional repair center and `type` args to applicable prompts
- [x] Update `src/prompts/assets.ts` — add optional repair center and `asset_name` args
- [x] Update `src/prompts/inventory.ts` — add optional `asset_name` and `category` args (no repair center on Parts-only prompts)
- [x] Update `src/prompts/pm.ts` — add optional repair center and `asset_name` args
- [x] Update `src/prompts/procurement.ts` — add optional repair center and `vendor_name` args
- [ ] Update `CLAUDE.md` Notable Findings with RepairCenter confirmation
- [x] Update `src/prompts/PROMPTS.md` sketch file to reflect arg additions

---

## 4. Prompt Text Branching — Shared Helper Module

> **Status:** Not yet started. Ideate and implement before or alongside the arg addition work in § 2.

When five prompt files all branch on `repair_center`, `asset_name`, `vendor_name`, `type`, and `category`, the branching logic and preamble text will duplicate across every file. Extract a small shared module (`src/shared/prompt-helpers.ts` or similar) before that duplication sets in.

The helper should generate:

- **Repair-center scoping preamble** — `RepairCenterID eq "{value}"` injection text (or "no filter" default)
- **Entity-scoping preamble** — lookup step for `asset_name`, `vendor_name`, `type`, `category`
- **"No scope" default text** — fleet-wide fallback for each optional arg
- **Validation / error text** — mutually exclusive arg combinations (if any emerge)

This keeps all prompt files aligned on:

- Filter syntax using double-quoted string values (OData convention — see `docs/notable-findings.md`)
- Resource-first behavior (fetch context resources before issuing tool calls)
- Consistent scoping language across all prompts

---

## 5. Open Questions

- Resolved: prompt templates now accept either `repair_center_id` or `repair_center_name`. Name resolution is case-insensitive exact match only; no partial-name fallback is implemented in this phase.
- Should we add a `mc_list_repair_centers` tool that discovers RC values by sampling WO/Asset records? Would make the filter arg more discoverable for users who don't know their RC codes.
