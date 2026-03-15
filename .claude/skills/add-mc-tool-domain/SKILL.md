---
name: add-mc-tool-domain
description: Add a new tool domain (resource family) to the MC-MCP server — use this when the user asks to add tools for a new MC API resource like Invoices, Labors, Companies, etc.
---

# Add MC Tool Domain Skill

## Contracts

Read `.claude/skills/add-mc-tool-domain/contracts.json` at the start of this skill. It defines the required files to create/modify, naming conventions, and verification steps that must be followed.

## When to use this skill

Use this skill when the user asks to:

- Add tools for a new MC API resource family (e.g., Invoices, Labors, Companies, Classifications)
- Expose a new entity to MCP clients
- Implement list/get tools for an endpoint not yet in the server

## Prerequisites

Before writing any code, use the `maintenance-connection-api-rag` skill to look up the target resource:

1. Search `mc-llm-api-chunks.json` for the resource family name
2. Verify exact paths, path params, and query params in `mc-normalized-api-map.json`
3. Note the exact casing of path segments (e.g., `/Assets` vs `/workorders` — they differ)

Never invent endpoint paths. Confirm against the normalized map first.

## Implementation checklist

### Step 1 — Look up the API endpoints

Use the RAG skill to find:

- `GET /<Resource>` — list endpoint path (exact casing)
- `GET /<Resource>/{pk}` — single-record endpoint path and path param name
- Any required query params beyond standard OData
- The response schema name (usually `ApiResponse` for lists)

### Step 2 — Add minimal types to `src/shared/types.ts`

Add a `<Entity>Summary` interface with only fields that are confirmed in the normalized map:

```typescript
export interface InvoiceSummary {
  PK: number;
  ID: string;
  // add fields only as confirmed against real API responses
}
```

Do not copy the full Swagger schema as TypeScript — add fields incrementally as they are verified.

### Step 3 — Create `src/tools/<domain>.ts`

Follow this exact pattern:

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '../mc-client.js'
import { odataShape } from '../shared/odata.js'
import { toToolText, toToolError } from '../shared/response.js'
import type { McApiResponse, <Entity>Summary } from '../shared/types.js'

export function register(server: McpServer, client: McClient): void {
  server.tool(
    'mc_list_<domain>',
    '<Description for LLM — what entity, what filters are useful, what questions it answers>',
    { ...odataShape },
    async (input) => {
      try {
        const data = await client.get<McApiResponse<<Entity>Summary>>('/<exact-path>', {
          params: input,
        })
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )

  server.tool(
    'mc_get_<domain_singular>',
    'Get full details for a single <entity> by its primary key (PK).',
    {
      pk: z.number().int().positive().describe('The <entity> primary key (PK integer)'),
    },
    async ({ pk }) => {
      try {
        const data = await client.get<<Entity>Summary>(`/<exact-path>/${pk}`)
        return toToolText(data)
      } catch (err) {
        return toToolError(err)
      }
    },
  )
}
```

### Step 4 — Register in `src/index.ts`

Add two lines — one import and one register call:

```typescript
// Add import with other tool imports
import { register as register<Domain> } from './tools/<domain>.js'

// Add call before server.connect()
register<Domain>(server, client)
```

### Step 5 — Type-check

```bash
bunx tsc --noEmit
```

Fix any errors before testing. Common issues:

- Path param name wrong (check the normalized map — it may be `assetPK` not `pk`)
- Response type mismatch (some endpoints return a single object, not `McApiResponse<T>`)

## Tool description guidelines

The description field is read by the LLM to decide when to call the tool. Write it for an analyst, not a developer:

- **Good:** "List invoices from Maintenance Connection. Use $filter to narrow by status, vendor, or date range. Useful for AP reconciliation and spend analysis."
- **Bad:** "GET /Invoices endpoint wrapper"

Include what the entity _is_, what filters are _typically useful_, and what _questions_ the tool helps answer.

Also add `.describe()` to any tool-specific params beyond OData — include examples.

## After adding the domain

1. Update the `## Available Tools` table in `README.md` — add a row for each new tool following the existing format:
   ```
   | `mc_list_<domain>` | <one-line description of what it lists and key filter use cases> |
   | `mc_get_<domain_singular>` | Get a single <entity> by PK |
   ```

2. Update `CLAUDE.md` Phase 2 checklist to mark the new entity as done.
