# MC-MCP Prompt Templates

High-level reference for the live MCP prompt registrations in `src/prompts/*.ts`.

The source files are the implementation of record. This document intentionally mirrors the
plain-English user experience and does not include raw query syntax or field-path guidance.
Any developer-only filter details belong in the API research docs, not in the prompts the model
can surface back to end users.

Status key: `[reviewed]` `[implemented]`

## Prompt Index

| Prompt | Optional args | Intent |
| --- | --- | --- |
| `mc_daily_maintenance_review` | `repair_center_id`, `repair_center_name` | Daily operating picture: urgent work, unassigned work, recent completions, and follow-up items. |
| `mc_open_work_order_backlog` | `repair_center_id`, `repair_center_name`, `type` | Backlog breakdown by work-order type, priority, assignment status, and age. |
| `mc_unassigned_work_orders` | `repair_center_id`, `repair_center_name`, `type` | Action list of open work that still needs an owner. |
| `mc_emergency_work_orders` | `repair_center_id`, `repair_center_name` | All open emergency work that needs immediate response. |
| `mc_asset_health_check` | `repair_center_id`, `repair_center_name`, `asset_name` | Find stressed assets by open corrective work, or assess one named asset in depth. |
| `mc_location_equipment_breakdown` | `repair_center_id`, `repair_center_name` | Explain the mix of location nodes vs equipment and what the asset tree looks like. |
| `mc_reserved_parts_audit` | `repair_center_id`, `repair_center_name`, `asset_name` | Show work orders with reserved parts and whether inventory is getting tied up. |
| `mc_inventory_audit` | `category` | Broad catalog orientation: active vs inactive parts, requester availability, and data quality. |
| `mc_slow_moving_parts` | `category` | Identify slow-moving parts that may need cleanup or reorder-policy review. |
| `mc_pm_compliance_review` | `repair_center_id`, `repair_center_name`, `asset_name` | Review preventive-maintenance completion health overall or for one asset. |
| `mc_inspection_summary` | `repair_center_id`, `repair_center_name` | Open and recently completed inspection workload, with backlog signals. |
| `mc_open_purchase_orders` | `repair_center_id`, `repair_center_name`, `vendor_name` | Open purchasing pipeline, vendor exposure, and committed spend. |
| `mc_vendor_performance` | `repair_center_id`, `repair_center_name`, `vendor_name` | Supplier activity and spend patterns based on purchase-order history. |
| `mc_po_approval_pipeline` | `repair_center_id`, `repair_center_name` | Purchase orders waiting for approval or action before they become active orders. |

## Prompt Style Rules

- Prompt text should ask for business outcomes in plain language, not raw filter syntax.
- If a prompt needs scoping help, it should tell the model to resolve the entity first and only
  then narrow the analysis.
- If the results cannot be narrowed reliably, the prompt should direct the model to say so briefly and
  keep the scope in its reasoning rather than inventing unsupported query paths.
- Repair-center, asset, vendor, and category resolution instructions should be written in terms of
  matching returned names and IDs, not raw backend expressions.

## Developer Note

Keep API-specific filter syntax only in developer docs such as:

- `docs/notable-findings.md`
- `docs/open-questions.md`
- `docs/phase3-prompts-and-repair-center.md`
