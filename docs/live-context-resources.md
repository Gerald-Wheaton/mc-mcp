# Live Context Resources — Ideation

> Inspired by analysis of the Limble MCP server's context resource pattern (2026-03-30).
> This doc captures architectural thinking for MC-MCP Phase 3+ work.

## The Core Idea

MCP has two primitives we should be using:

- **Tools** — actions the LLM invokes to query data (parameters in, results out)
- **Resources** — URI-addressable data the LLM reads for context (`mc://context/time`, etc.)

Right now MC-MCP uses only Tools. Limble's MCP server uses Resources for everything that answers "what does this account look like?" and Tools for everything that answers "what data matches this query?" That's a clean separation worth adopting.

## Staleness Tiers

Not all context ages at the same rate. The refresh strategy should match the tier:

| Tier | Changes | Examples | Strategy |
|------|---------|----------|----------|
| **Live** | Every call | Current time, precomputed date ranges | Compute fresh on every resource read |
| **Session** | Hours/days | Record counts, asset summaries | Fetch from MC API, cache in McClient ~1 hour |
| **Slow** | Weeks/months | Labors/technicians, lookup table values | Fetch once per session, no TTL needed |
| **Static** | Never | WO type codes, status codes, priority codes | Could be hardcoded, but cleaner as a resource |

## Proposed Resources for MC-MCP

| URI | Fetches | Tier |
|-----|---------|------|
| `mc://context/time` | Current date + precomputed ISO date ranges (7/30/90/365 days ago) | Live |
| `mc://context/summary` | Live record counts for all entities | Session |
| `mc://context/labors` | All technician/labor records for ID→name resolution | Slow |
| `mc://context/asset-locations` | Top-level location nodes (IsLocation eq true) | Slow |
| `mc://context/lookup-tables` | Customer's configured lookup table values | Slow |
| `mc://context/datasets` | Resource family index (currently `mc_list_datasets` tool) | Static |

> **Implementation status (2026-04-22):** `time`, `summary`, `labors`, `asset-locations`, `lookup-tables`, and `datasets` are implemented in the server. `lookup-tables` is populated dynamically from the connected tenant at read time; no customer-specific lookup values are hard-coded in repo state.

## The Dynamic Counts Problem — Solved Properly

Removing hardcoded counts from tool descriptions (done 2026-03-27) was treating a symptom. The real solution is `mc://context/summary`:

```
GET /workorders?$top=1  → { Total: N }
GET /Assets?$top=1      → { Total: N }
GET /Parts?$top=1       → { Total: N }
GET /purchaseorders?$top=1 → { Total: N }
```

Returns live counts the LLM can use to orient itself before deciding how to approach a question. Never stale, never in code.

## ID Enrichment Gap

MC Ref objects usually embed `Name` (e.g., `AssetRef: { PK: 1234, Name: "HVAC Unit" }`), which softens the problem. But `Name` is sometimes null (confirmed: `WorkOrderRef.Name` is null in live data). The bigger gap is **labor/technician resolution** — work orders have assignee references, but resolving a labor PK to a person requires an extra API call.

A `mc://context/labors` resource pre-loads all technician records at session start, letting the LLM resolve any labor assignment without a round-trip. Same principle applies to asset location nodes.

**Goal:** The LLM should never surface a raw PK to the user — always resolve to a human-readable name.

## System Prompt + Resources = Phase 3 Foundation

Resources alone aren't enough — behavioral rules make them mandatory. The system prompt should specify:

```
Before mc_list_work_orders:  fetch mc://context/time, mc://context/labors
Before mc_list_assets:       fetch mc://context/time, mc://context/asset-locations
Before ALL tools:            fetch mc://context/time
```

This is exactly the Phase 3 "prompt templates" work from the roadmap. Without `mc://context/time`, a prompt template has to say "figure out what date it is somehow" — unreliable. With it, the template is precise and LLM behavior is predictable.

## `mc_list_datasets` Transition

`mc://context/datasets` now exists and is the preferred interface for MCP clients that support resources. The legacy `mc_list_datasets` tool remains supported during the transition so existing tool-only workflows do not break.

The underlying reasoning is still the same: dataset orientation is resource-shaped, not action-shaped. The LLM should read `mc://context/datasets` before deciding which query tool to use. This also means:
- It doesn't clutter the tool list
- The LLM doesn't "spend" a tool invocation on what is fundamentally reading a menu
- Deprecation of `mc_list_datasets` should be considered only after the resource path has been exercised and confirmed stable in real client workflows

## Lookup Tables Angle

MC has `LookupTables` and `LookupTableValues` endpoints — customer-configurable dropdowns used across entities. `mc://context/lookup-tables` now reads those endpoints at runtime and exposes normalized table/value data without hard-coding tenant-specific labels, IDs, or examples in the repo. This gives the LLM live category/code context while keeping the server portable across Maintenance Connection customers.

## Implementation Notes

- MCP SDK exposes resources via `server.registerResource()` with a URI and handler
- The handler can call `client.get()` just like a tool does
- `McClient` needs a lightweight TTL cache layer to avoid re-fetching slow-tier resources on every message in a long conversation — small addition to `mc-client.ts`
- Resources returning JSON should set MIME type `application/json`

## The Big Picture

Right now MC-MCP is a set of tools. A mature MCP server is really two things working together:

1. **Context layer** — resources that tell the LLM what the account looks like
2. **Query layer** — tools that fetch specific data against that context

The context layer is what enables precision, avoids extra round-trips, and produces human-readable output. Everything in Phase 3 (Analysis UX) implicitly depends on building this context layer first.
