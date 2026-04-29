---
name: fallow-health-plan
description: Run fallow static analysis across dead code, duplication, and complexity, then build a prioritized plan to fix the findings that are worth fixing.
---

# Fallow Health Plan Skill

## Purpose

Run fallow's full suite of analyses, apply judgment about what is actually worth fixing, then enter plan mode with a prioritized fix list. The goal is actionable cleanup, not mechanical suppression of every finding.

## Step 1 — Run all three analyses

Run these three commands and capture all output. Run them in parallel.

```bash
bunx fallow dead-code --format json
bunx fallow dupes --format json
bunx fallow health --format json
```

If any command fails or is not yet installed, report the error and stop.

## Step 2 — Apply judgment to dead-code findings

Not every fallow finding warrants a code change. Use these rules before adding anything to the plan:

### Unused files — judgment rules

| Pattern | Decision |
|---|---|
| `scripts/explore-*.ts`, `scripts/recon-*.ts`, one-off investigation scripts | Suppress with `// fallow-ignore-file unused-file` — these are intentional dev utilities |
| `build-mc-api-map.ts`, `read-lookup-tables.mjs`, any root-level standalone script | Suppress — they're build/research tools, not dead code |
| `src/**` files not reachable from `src/index.ts` | Investigate — likely real dead code, add to plan as **delete or integrate** |
| `docs/**`, `api-docs/**` | Ignore — fallow does not understand non-TS files as intentional artifacts |
| `tests/**` files | Investigate — may be real dead test code or orphaned helpers |

### Unused exports — judgment rules

| Pattern | Decision |
|---|---|
| Exports in `tests/helpers/**` not used by any test file | Suppress — test helper exports are often forward-looking |
| Exports in `src/shared/**` not used in `src/` | Real dead code — add to plan as **remove export** |
| Exports in `src/tools/**` or `src/resources/**` | Investigate before removing — MCP tools are registered dynamically |
| Exports in `src/index.ts` | Never remove — entry point exports may be used by the MCP host |

### Circular dependencies

Always add to the plan. Circular deps in `src/` are never intentional.

### Unused dependencies

Always add to the plan. Removing unused packages reduces supply chain surface area.

## Step 3 — Apply judgment to duplication findings

- Clone pairs that are < 5 lines: skip — not worth extracting.
- Clone pairs in `src/tools/*.ts` that share the same OData/response pattern: add to plan as **extract shared helper**.
- Clone pairs across different resource families that are structurally identical (e.g., list tool boilerplate): note as a refactor opportunity but only add to plan if >= 3 files share the clone.
- Clone pairs in `tests/` or `scripts/`: skip.

## Step 4 — Apply judgment to complexity findings

- Functions with cyclomatic complexity > 10 in `src/`: add to plan as **refactor**.
- Functions with cognitive complexity > 15 in `src/`: add to plan as **refactor**.
- Anything in `scripts/` or `tests/`: skip.

## Step 5 — Enter plan mode

After completing steps 1–4, call `EnterPlanMode` and present the plan with this structure:

### Plan structure

```
## Fallow Health Plan

### Summary
- X unused files: N to delete, M to suppress
- X unused exports: N to remove
- X duplication findings: N worth fixing
- X complexity hotspots
- X circular dependencies

### Priority 1 — Breaking / High-value (do these first)
[Circular deps, unused src/ exports that are clearly dead]

### Priority 2 — Cleanup (do in one pass)
[Delete real dead files in src/, remove unused exports]

### Priority 3 — Refactor (do when touching related code)
[Duplication extractions, complexity hotspots]

### Suppress (no code change needed)
[Scripts, one-off tools, test helpers — add ignore comments]
```

For each item, include: file path, what fallow found, and the recommended action (delete / remove export / extract / suppress / refactor).

## Rules

- Do not auto-apply any fixes during this skill. The skill ends after presenting the plan.
- Do not suppress findings in `src/` without explicitly calling it out in the plan and noting the reason.
- If the total findings are zero or only suppressions, say so clearly and exit plan mode.
- Prefer delete over suppress for genuinely unreachable `src/` code.
- If a finding is ambiguous, list it under a separate **Needs Investigation** section rather than guessing.
