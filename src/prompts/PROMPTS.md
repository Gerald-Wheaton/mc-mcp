# MC-MCP Prompt Templates

Sketches for MCP prompt templates. Each entry includes the prompt name, description (shown in client UI),
any parameters, and the full prompt text the LLM will receive.

Status key: `[ draft ]` `[ reviewed ]` `[ implemented ]`

---

## Operational / Daily

---

### `mc_daily_maintenance_review` [ draft ]

**Description:** Get a summary of today's maintenance activity — open high-priority work orders, recently completed work, and anything that needs immediate attention.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

Give me a daily maintenance review. Cover the following:

1. **Emergency and high-priority open work orders** — fetch open work orders with priority 0 ("Emergency / Immediate Response"). List each one with its ID, reason/description, asset, and how long it has been open (use DateOpened).

2. **Unassigned open work orders** — fetch open work orders that are not yet assigned (IsAssigned eq false). How many are there? Break them down by type (CM, PM, IN, SR, etc.).

3. **Recently closed work orders** — fetch work orders closed in the last 7 days (Status eq "CLOSED"). How many were closed? Any notable patterns (type mix, assets involved)?

4. **Follow-up work orders** — fetch any open work orders of type FO (follow-up). These signal unresolved issues that needed a second pass.

Summarize your findings in plain language a maintenance manager would understand. Flag anything that looks urgent or out of the ordinary.
```

---

### `mc_open_work_order_backlog` [ draft ]

**Description:** Analyze the full backlog of open work orders by type and priority to understand where effort is concentrated.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

Pull the full open work order backlog and analyze it. Walk through each work order type using $filter=IsOpen eq true, fetching each type separately if needed (CM, PM, IN, SR, CAP, ADMN, FO, PC).

For each type present in the data:
- How many open work orders exist?
- What is the priority distribution (0=Emergency, 2=Normal, 3=Low)?
- How many are unassigned (IsAssigned eq false)?
- Are any overdue or notably old based on DateOpened?

After the per-type breakdown, give me a one-paragraph executive summary: where is the backlog concentrated, and what should the team focus on first?
```

---

### `mc_unassigned_work_orders` [ draft ]

**Description:** Show all open work orders that have not been assigned to a technician, sorted by priority.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

Fetch all open, unassigned work orders using:
  $filter=IsOpen eq true and IsAssigned eq false
  $orderby=Priority asc

List each work order with:
- ID and reason/description
- Type (CM, PM, IN, SR, etc.)
- Priority (0=Emergency, 2=Normal, 3=Low)
- Asset name and location (if available)
- Date opened

Group the results by priority. For any Priority 0 items, call them out explicitly at the top of your response — these require immediate attention.

Finish with a count summary: how many unassigned WOs by type and priority.
```

---

### `mc_emergency_work_orders` [ draft ]

**Description:** Surface all open emergency (Priority 0) work orders that require immediate response.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

Fetch all open work orders at Priority 0 (Emergency / Immediate Response) using:
  $filter=IsOpen eq true and Priority eq 0

For each one, tell me:
- Work order ID and reason/description
- Type (CM, IN, SR, etc.)
- Asset involved (name, ID, location if available)
- Date opened — how many days has this been open?
- Whether it is assigned (IsAssigned) and to whom if that field is populated

If there are no open emergency work orders, say so clearly — that is a good sign worth noting.

Close with a plain-language assessment: is the emergency situation under control, or are there items that have been sitting open too long?
```

---

## Asset-Focused

---

### `mc_asset_health_check` [ draft ]

**Description:** Identify which equipment assets have the most active open work orders — a proxy for assets under stress or nearing failure.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

I want to understand which equipment assets are generating the most maintenance activity right now.

Step 1: Fetch open corrective maintenance work orders (Type eq "CM" and IsOpen eq true). Collect the AssetRef (PK and Name) from each record.

Step 2: Tally open CM work orders per asset. Which assets appear most frequently?

Step 3: For the top 5 assets by open CM count, fetch the full asset record using mc_get_asset to get additional context: IsUp (is the asset currently operational?), LastMaintained, AssetLevel, ClassificationRef, and ParentRef (location).

Present a ranked list of the top assets by open CM work order count. For each asset, include:
- Asset name and ID
- Number of open CMs
- Is the asset currently up (IsUp)?
- Last maintained date
- Location / parent asset

Close with a plain-language assessment: which assets look like they may need proactive attention or investigation?
```

---

### `mc_location_equipment_breakdown` [ draft ]

**Description:** Summarize the asset hierarchy — how many location nodes vs equipment records exist, and what does the top of the tree look like.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

Help me understand the shape of the asset hierarchy in this system.

Step 1: Fetch assets at the top of the hierarchy (AssetLevel eq 1 and AssetLevel eq 2) — these are the root and campus/site-level nodes. List their names and IDs.

Step 2: Fetch a sample of equipment assets (IsLocation eq false, $top=20) to show what the leaf-level records look like — include Name, ID, ClassificationRef, and ParentRef.

Step 3: Fetch a count of location-only assets ($filter=IsLocation eq true, use $top=1 and inspect Total in the response) vs equipment assets ($filter=IsLocation eq false).

Summarize:
- How many total assets are in the system (locations + equipment combined)?
- How many are pure location/structural nodes vs actual equipment?
- What does the top of the tree look like (site/campus names)?
- What types of equipment are represented in the sample?

This gives a quick orientation to the facility structure for someone new to this account.
```

---

## Inventory / Parts

---

### `mc_reserved_parts_audit` [ draft ]

**Description:** Show all open work orders with parts reserved and surface which parts are tied up, to help identify inventory bottlenecks.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

A "reserved parts" situation means a work order has parts allocated to it but the work may not yet be complete. I want to audit what is currently reserved.

Step 1: Fetch all open work orders with parts reserved:
  $filter=IsOpen eq true and IsPartsReserved eq true

For each work order, capture: ID, reason/description, type, priority, asset (AssetRef), and date opened.

Step 2: For each unique part referenced (PartRef) across those work orders, fetch the part record using mc_get_part to get: Name, ID, InternalPartNumber, IssueUnitCost, and Active status.

Step 3: Summarize:
- How many open work orders have parts reserved?
- Which parts appear most frequently across multiple WOs?
- Are any reserved parts inactive (Active eq false) — that could be a data quality issue?
- Which work orders have been open the longest with parts still reserved — these may represent stalled work?

Close with a plain-language assessment of whether the reserved parts situation looks healthy or whether action is needed.
```

---

### `mc_inventory_audit` [ draft ]

**Description:** Get a high-level overview of the parts catalog — active vs inactive parts, cost rule distribution, and general inventory health.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

Give me a high-level inventory audit of the parts catalog.

Step 1: Fetch a broad sample of parts (use $top=100, no filter) to understand the general shape of the catalog — field population, cost data, category distribution.

Step 2: Fetch active parts only ($filter=Active eq true) and note the total count from the response envelope.

Step 3: Fetch inactive parts ($filter=Active eq false) and note the count.

Step 4: Fetch parts available to requesters ($filter=AvailableToRequester eq true) — these are parts end users can request directly.

Summarize:
- Total parts in the catalog (active + inactive)
- What percentage are active?
- How many are available to requesters?
- From the sample: what categories appear most? Are cost fields (IssueUnitCost, LastOrderUnitPrice) well-populated or mostly null?
- Any data quality flags — parts with no description, no category, or zero cost?

Keep the summary concise — this is an orientation, not an exhaustive ledger.
```

---

### `mc_slow_moving_parts` [ draft ]

**Description:** Identify parts that have not been issued or ordered recently — candidates for reorder review or catalog cleanup.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

I want to find parts that haven't been moving — not issued recently, not ordered recently. These are candidates for reorder policy review or catalog cleanup.

Step 1: Fetch active parts, ordered by LastIssued ascending (oldest first):
  $filter=Active eq true
  $orderby=LastIssued asc
  $top=50

Step 2: Fetch active parts ordered by LastOrdered ascending:
  $filter=Active eq true
  $orderby=LastOrdered asc
  $top=50

For parts appearing in both lists (slow on both issuing and ordering), highlight them — these are the strongest candidates for review.

For each highlighted part include: Name, ID, InternalPartNumber, LastIssued, LastOrdered, IssueUnitCost.

Close with a plain-language summary: how many parts appear genuinely slow-moving, and does the catalog seem well-maintained or overdue for a cleanup pass?
```

---

## Preventive Maintenance

---

### `mc_pm_compliance_review` [ draft ]

**Description:** Review PM work order status to understand whether scheduled preventive maintenance is being completed on time or falling behind.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

Give me a PM compliance review — how well is scheduled preventive maintenance being completed?

Step 1: Fetch all PM-type work orders ($filter=Type eq "PM"), capturing Status and DateOpened for each. Tally by status: ISSUED, CLOSED, REQUESTED, CANCELED.

Step 2: Among open PMs (Status eq "ISSUED"), fetch the oldest ones (order by DateOpened asc, $top=10). How long have they been open? Long-open PMs may signal overdue work.

Step 3: Among recently closed PMs (Status eq "CLOSED", order by DateClosed desc if available, $top=20), what assets were maintained?

Summarize:
- Total PM work orders and status breakdown (as percentages)
- How many PMs are currently open, and how old is the oldest?
- Any patterns in which assets generate the most PMs?
- Plain-language compliance assessment: is PM work staying current or building up a backlog?
```

---

### `mc_inspection_summary` [ draft ]

**Description:** Summarize open and recent inspection work orders to understand the state of scheduled inspections.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

Give me a summary of inspection work orders (Type eq "IN").

Step 1: Fetch all open inspections:
  $filter=Type eq "IN" and IsOpen eq true
  $orderby=Priority asc

Step 2: Fetch recently closed inspections:
  $filter=Type eq "IN" and Status eq "CLOSED"
  $orderby=DateOpened desc
  $top=20

For open inspections, summarize:
- Total count and priority breakdown
- How many are unassigned (IsAssigned eq false)?
- Which assets appear most frequently?
- Oldest open inspections (by DateOpened) — flag anything open more than 30 days

For recently closed, summarize:
- Count closed recently and which assets were inspected

Close with a plain-language assessment: are inspections being kept current, or is there a backlog building?
```

---

## Procurement

---

### `mc_open_purchase_orders` [ draft ]

**Description:** Review all open purchase orders — what is outstanding, who are the vendors, and what is the total spend committed.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

Give me a summary of all open purchase orders.

Step 1: Fetch all open POs:
  $filter=IsOpen eq true
  $orderby=OrderDate asc

For each PO capture: ID, Description, VendorRef (name), Total, OrderDate, Status, IsPartsOrdered, InvoiceNumber.

Step 2: Summarize:
- Total number of open POs and combined dollar value (sum of Total)
- Breakdown by status (ISSUED vs REQUESTED)
- Which vendors have the most open POs?
- How many POs have parts already ordered (IsPartsOrdered eq true) vs not yet ordered?
- Oldest open POs by OrderDate — flag any that have been open unusually long

Close with a plain-language summary of the procurement pipeline: is purchasing moving smoothly, or are there stalled orders that need follow-up?
```

---

### `mc_vendor_performance` [ draft ]

**Description:** Analyze purchase orders by vendor to understand spend distribution, order frequency, and order status across suppliers.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

I want to understand vendor performance through the lens of purchase order data.

Step 1: Fetch all POs (no status filter, to get the full picture):
  $top=200
Capture VendorRef (name and PK), Total, Status, OrderDate, IsPartsOrdered for each.

Step 2: Group by vendor. For each vendor calculate:
- Number of POs (total, open, closed, canceled)
- Total spend (sum of Total across all POs)
- Average PO value
- How many POs have parts ordered vs not

Step 3: Rank vendors by total spend (highest first). Present the top 10 vendors with their metrics.

Step 4: Flag any vendors with canceled POs — these may signal fulfillment issues.

Close with a plain-language summary: which vendors are the primary suppliers, is spend concentrated or distributed, and are there any vendors with concerning patterns?
```

---

### `mc_po_approval_pipeline` [ draft ]

**Description:** Show purchase orders in REQUESTED status that are awaiting approval or action before becoming active orders.

**Parameters:** none

**Prompt text:**
```
You are a maintenance operations assistant with access to live Maintenance Connection data.

Show me all purchase orders currently in the approval pipeline — status REQUESTED, meaning they have been created but not yet issued/approved.

Step 1: Fetch all REQUESTED POs:
  $filter=Status eq "REQUESTED"
  $orderby=OrderDate asc

For each PO capture: ID, Description, VendorRef (name), Total, OrderDate, and whether parts are already flagged as ordered (IsPartsOrdered).

Step 2: Fetch line items for the top 5 largest REQUESTED POs (by Total) using mc_list_po_line_items with $filter=PurchaseOrderPK eq {pk}. Summarize what is being ordered.

Summarize:
- How many POs are awaiting approval and their combined value?
- Which vendors are involved?
- How old are the oldest REQUESTED POs (by OrderDate)? Flag anything over 14 days old.
- What are the biggest pending orders about (from line item detail)?

Close with a plain-language assessment: is the approval queue healthy or are there orders stalled and waiting?
```
