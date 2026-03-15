# MC-MCP: Maintenance Connection MCP Server

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server that wraps the Accruent Maintenance Connection (MC) REST API. Connects LLM clients (Claude Desktop, VS Code, etc.) to live CMMS data so users can ask natural-language questions about work orders, assets, parts, purchase orders, and more.

## Requirements

- [Bun](https://bun.sh) v1.0+
- A Maintenance Connection API key and base URL

## Setup

```bash
bun install
```

Copy `.env.example` to `.env` and fill in your credentials:

```bash
MC_BASE_URL=https://api.maintenanceconnection.com/v8
MC_API_KEY=your-api-key-here
```

> **Note:** Bun reads `.env` automatically — no dotenv package needed.

## Running

```bash
# Development (runs TypeScript directly)
bun dev

# Production build
bun run build       # compiles to dist/
bun start           # runs dist/index.js
```

## Connecting to an MCP Client

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mc-mcp": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/mc-mcp/src/index.ts"],
      "env": {
        "MC_BASE_URL": "https://api.maintenanceconnection.com/v8",
        "MC_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Restart Claude Desktop after editing. You should see the MC tools available in a new conversation.

## Available Tools

| Tool                      | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `mc_ping`                 | Verify connectivity and auth                     |
| `mc_list_work_orders`     | List WOs with OData filtering/sorting/pagination |
| `mc_get_work_order`       | Get a single WO by PK                            |
| `mc_list_assets`          | List assets with OData filtering                 |
| `mc_get_asset`            | Get a single asset by PK                         |
| `mc_list_parts`           | List parts/inventory with OData filtering        |
| `mc_get_part`             | Get a single part by PK                          |
| `mc_list_purchase_orders` | List POs with OData filtering                    |
| `mc_get_purchase_order`   | Get a single PO by PK                            |

All list tools support OData query parameters: `$filter`, `$orderby`, `$top` (max 500), `$skip`.

**Example filters:**

- `$filter=Status eq 'Open'`
- `$filter=TargetDate gt '2024-01-01'`
- `$filter=AssetPK eq 12345`

## Project Structure

```
src/
├── index.ts                  # Server entry point
├── config.ts                 # Env var loading
├── mc-client.ts              # HTTP wrapper (auth lives here)
├── shared/
│   ├── odata.ts              # Shared OData Zod params — used by all list tools
│   ├── response.ts           # toToolText() / toToolError() helpers
│   └── types.ts              # MC API response types
└── tools/
    ├── ping.ts
    ├── work-orders.ts
    ├── assets.ts
    ├── parts.ts
    └── purchase-orders.ts
```

## Adding a New Tool Domain

Follow these steps to expose a new MC API resource (e.g., Invoices, Labors, Companies).

### 1. Look up the endpoints

Before writing any code, find the exact paths in `api-docs/mc-normalized-api-map.json`. Search by the resource family name or tag. Note:

- The exact path casing (the MC API is inconsistent — e.g., `/Assets` vs `/workorders`)
- The path parameter name (e.g., `assetPK`, not just `pk`)
- Whether the list response is wrapped in `McApiResponse<T>` or returned directly

> If you're using Claude Code, the `add-mc-tool-domain` skill automates this process.

### 2. Add a type to `src/shared/types.ts`

Add a minimal `<Entity>Summary` interface with only the fields you've confirmed exist in the API response. Do not copy the full Swagger schema — add fields incrementally as you verify them against real responses.

```typescript
export interface InvoiceSummary {
  PK: number;
  ID: string;
  // add fields as confirmed
}
```

### 3. Create `src/tools/<domain>.ts`

Create a new file that exports a single `register(server, client)` function:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McClient } from "../mc-client.js";
import { odataShape } from "../shared/odata.js";
import { toToolText, toToolError } from "../shared/response.js";
import type { McApiResponse, InvoiceSummary } from "../shared/types.js";

export function register(server: McpServer, client: McClient): void {
  server.tool(
    "mc_list_invoices",
    "List invoices from Maintenance Connection. Use $filter to narrow by status, vendor, or date. Useful for AP reconciliation and spend analysis.",
    { ...odataShape },
    async (input) => {
      try {
        const data = await client.get<McApiResponse<InvoiceSummary>>(
          "/Invoices",
          { params: input },
        );
        return toToolText(data);
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  server.tool(
    "mc_get_invoice",
    "Get full details for a single invoice by its primary key (PK).",
    {
      pk: z
        .number()
        .int()
        .positive()
        .describe("The invoice primary key (PK integer)"),
    },
    async ({ pk }) => {
      try {
        const data = await client.get<InvoiceSummary>(`/Invoices/${pk}`);
        return toToolText(data);
      } catch (err) {
        return toToolError(err);
      }
    },
  );
}
```

**Tool description tips** — the description is read by the LLM to decide when and how to call the tool:

- Say what the entity _is_, what filters are _typically useful_, and what _questions_ the tool helps answer
- Add `.describe()` with examples to any non-obvious parameters
- Write for an analyst, not a developer (i.e. this is prompt engineering NOT developer comments)

### 4. Register in `src/index.ts`

Two lines: one import and one register call.

```typescript
// With the other imports
import { register as registerInvoices } from "./tools/invoices.js";

// Before server.connect()
registerInvoices(server, client);
```

### 5. Type-check

```bash
bunx tsc --noEmit
```

Fix any errors before testing.

## Changing the Auth Scheme

All auth logic lives in the private `buildHeaders()` method in `src/mc-client.ts`. When the real auth scheme is confirmed, only that method needs to change — nothing else in the codebase touches authentication.

## Open Questions

Before shipping Phase 2:

1. What auth scheme does the MC API use? (API key header? OAuth2? Basic?)
2. What is the sandbox/non-prod environment URL?
3. Which 3–5 entities are highest priority for the first release?
4. Which MCP client connects first — Claude Desktop, VS Code, or custom?
