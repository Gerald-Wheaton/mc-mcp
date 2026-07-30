# Prompt Stress Tests

Manual QA prompts for validating shared repair-center guidance after prompt refactors. These are copy/paste scenarios for checking that runtime prompts keep executable `RepairCenterID` scoping, stop on ambiguity, and do not drift into unscoped analysis.

## Operational

### Should succeed

- `Run mc_daily_maintenance_review for repair_center_id "M".`
- `Run mc_open_work_order_backlog for repair_center_id "M" and type "CM".`
- `Run mc_unassigned_work_orders for repair_center_name "Main Campus".`
- `Run mc_emergency_work_orders for repair_center_id "M".`

### Should stop or clarify

- `Run mc_open_work_order_backlog for repair_center_name "Campus".`
- `Run mc_unassigned_work_orders for repair_center_name "Unknown Repair Center".`

## PM

### Should succeed

- `Run mc_pm_compliance_review for repair_center_id "M".`
- `Run mc_pm_compliance_review for repair_center_id "M" and asset_name "AHU-12".`
- `Run mc_inspection_summary for repair_center_name "Main Campus".`

### Should stop or clarify

- `Run mc_pm_compliance_review for repair_center_name "Campus" and asset_name "AHU-12".`
- `Run mc_inspection_summary for repair_center_name "No Such Campus".`

## Assets

### Should succeed

- `Run mc_asset_health_check for repair_center_id "M".`
- `Run mc_asset_health_check for repair_center_id "M" and asset_name "AHU-12".`
- `Run mc_location_equipment_breakdown for repair_center_name "Main Campus".`

### Should stop or clarify

- `Run mc_asset_health_check for repair_center_name "Campus" and asset_name "AHU-12".`
- `Run mc_location_equipment_breakdown for repair_center_name "Unknown Site".`

## Reserved Parts

### Should succeed

- `Run mc_reserved_parts_audit for repair_center_id "M".`
- `Run mc_reserved_parts_audit for repair_center_id "M" and asset_name "AHU-12".`
- `Run mc_reserved_parts_audit for repair_center_name "Main Campus".`

### What to verify

- The prompt scopes work-order queries with `RepairCenterID`.
- The prompt explicitly says not to apply repair-center scoping to part lookups.
- Asset-specific reserved-parts analysis stays constrained to the resolved asset.

### Should stop or clarify

- `Run mc_reserved_parts_audit for repair_center_name "Campus" and asset_name "AHU-12".`
- `Run mc_reserved_parts_audit for repair_center_name "Does Not Exist".`

## Procurement

### Should succeed

- `Run mc_open_purchase_orders for repair_center_id "M".`
- `Run mc_open_purchase_orders for repair_center_name "Main Campus" and vendor_name "Grainger".`
- `Run mc_vendor_performance for repair_center_id "M".`
- `Run mc_po_approval_pipeline for repair_center_id "M".`

### What to verify

- Purchase-order prompts keep `RepairCenterID` scoping in runtime guidance.
- `mc_po_approval_pipeline` still instructs separate `mc_list_po_line_items` calls with `PurchaseOrderPK eq {poPK}`.
- Vendor-focused prompts do not lose repair-center scope when both vendor resolution and repair-center scoping are present.

### Should stop or clarify

- `Run mc_open_purchase_orders for repair_center_name "Campus" and vendor_name "Grainger".`
- `Run mc_vendor_performance for repair_center_name "Unknown Site".`

## Cross-Prompt Regression Checks

- `Run mc_pm_compliance_review with repair_center_id "M", then run mc_asset_health_check with the same repair center and asset_name "AHU-12".`
- `Run mc_reserved_parts_audit for repair_center_id "M", then confirm the follow-up part lookups are not scoped by repair center.`
- `Run mc_po_approval_pipeline for repair_center_id "M", then verify line items are fetched per PO rather than from a broad unscoped list.`
- `Run mc_open_work_order_backlog for repair_center_id "M"` and confirm the prompt does not degrade into generic “keep it limited” wording without the executable filter.
