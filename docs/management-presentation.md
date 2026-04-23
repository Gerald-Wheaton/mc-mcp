# MC-MCP: AI-Powered Maintenance Intelligence
### Project Overview for FM360 Leadership — April 2026

---

## What We Built

We've developed a custom AI integration between **Maintenance Connection (MC)** and **Claude**, Anthropic's AI assistant. The integration is called **MC-MCP** (Maintenance Connection Model Context Protocol server).

In plain terms: the AI can now read and reason about your live MC data in real time. A maintenance manager or technician can ask a plain-English question and get a specific, data-backed answer — without writing a report, digging through screens, or knowing how to filter in MC.

---

## The Problem It Solves

Maintenance Connection holds a massive amount of operational data — work orders, assets, parts, purchase orders, and more. Getting insight out of that data today requires:

- Knowing which filters to use
- Running reports manually
- Exporting to Excel and sorting by hand
- Emailing someone who knows the system to pull the info

Most of that institutional knowledge lives in a few people's heads. When staff are busy or turnover happens, insight disappears.

**MC-MCP makes that data conversational.** Anyone can ask a question and get a real answer in seconds.

---

## Current Status

The server is fully functional and connected to live production MC data. Here's where we are:

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Core server, auth, connectivity | Complete |
| Phase 2 | Live data validation (WOs, Assets, Parts, POs) | Complete |
| Phase 2.5 | Deep data exploration — field mapping, filters, edge cases | Complete |
| Phase 3 | AI context layer, prompt templates, scoped queries | Substantially complete |
| Phase 4 | Hardening, pagination, deployment docs, error handling | In progress |

**What's live today:**
- Real-time queries against Work Orders (645 records), Assets (33,639), Parts (3,305), and Purchase Orders (74)
- 14 pre-built prompt templates covering daily operations, asset health, PM compliance, inventory, and procurement
- Scoped filtering by repair center, asset, vendor, part category, and WO type
- Context resources that orient the AI to current time, active labor staff, site locations, and dataset sizes before it starts answering

---

## What It Looks Like in Practice

The AI connects through Claude Desktop (a free Anthropic app). The user types a question — or picks from a pre-built prompt — and the AI does the querying.

### Sample Prompts — Management View

---

**"Give me a daily maintenance review for today."**

> The AI fetches open work orders, checks which are overdue, identifies unassigned work, and summarizes by type (corrective, preventive, inspection). It flags anything that needs attention and presents it in plain English — no report building required.

---

**"What does our open work order backlog look like, and where is it piling up?"**

> The AI groups open WOs by type, priority, and age — surfacing which categories are growing and which assets are driving the most corrective maintenance. This is the kind of analysis that typically takes 30 minutes in Excel.

---

**"Are we on track with PM compliance this month?"**

> The AI reviews scheduled preventive maintenance work orders, identifies which are overdue or at risk, and flags assets that are consistently behind on PMs. A supervisor can act on this in the field rather than discovering it in a quarterly review.

---

**"Show me the purchase order approval pipeline."**

> The AI lists all POs in REQUESTED status, how long each has been waiting, which vendors are involved, and total dollar amounts pending. Finance or a purchasing manager can see the full picture immediately.

---

### Sample Prompts — Floor / Technician View

---

**"What work is unassigned right now that I could pick up?"**

> Returns open, unassigned work orders with location and priority — so a tech who finishes early can self-dispatch to the next task without waiting for a supervisor.

---

**"Is the air handler on the third floor due for any maintenance?"**

> The AI searches assets by name, pulls up the matching record, checks open WOs and PM schedules tied to it, and gives a clear answer. No navigating the asset tree required.

---

**"Do we have the parts on hand to complete WO #4821?"**

> The AI looks up the work order, identifies any parts reserved or noted, then checks current stock levels — flagging anything that may be short.

---

**"Which parts haven't moved in over 90 days?"**

> A storeroom audit question answered in seconds. The AI surfaces slow-moving inventory across all parts, which helps identify dead stock and improve reorder decisions.

---

## Why This Matters

### For Leadership

- **Operational visibility without waiting for reports** — daily or weekly reviews happen in seconds
- **Fewer bottlenecks on experienced staff** — new or junior staff can get answers the system already has
- **Better decisions, faster** — backlog trends, PM gaps, and procurement delays are visible in real time
- **Foundation for more** — this integration can grow to cover additional MC data, notifications, and workflow automation

### For Maintenance Staff

- **Plain-English access to their own data** — no training required beyond typing a question
- **Faster self-dispatch** — less waiting, more wrenching
- **Fewer phone calls** — "is this part in stock?" answered without tracking someone down
- **Consistent answers** — the AI reads the same live data every time, no stale spreadsheets

---

## What's Next

**Phase 4 (in progress):**
- Handling large datasets with automatic pagination (Assets alone has 33,000+ records)
- Request timeouts and error recovery
- End-user language audit — ensuring no technical filter syntax ever surfaces in a reply
- Deployment documentation for IT handoff

**Beyond Phase 4:**
- Hosted deployment so staff can access via browser, not just Claude Desktop
- Potential integration with additional FM360 systems
- Piloting with Darling Ingredients and O-I Glass once hosted

---

## Technical Notes (for IT / Review)

- **Read-only** — the integration cannot create, update, or delete any MC data. It is strictly observational.
- **Auth** — HTTP Basic auth using existing MC API credentials. No new accounts or permissions required.
- **Data stays on-premise** — queries go from the AI client to the MC API directly. No MC data is stored or retained by this server.
- **Stack** — TypeScript / Node.js (Bun runtime), MCP protocol, Claude Desktop client
- **AI provider** — Anthropic (Claude). Query content is subject to Anthropic's standard API data policies.

---

*Prepared by FM360 Engineering — April 2026*
