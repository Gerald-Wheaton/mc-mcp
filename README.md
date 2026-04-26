# MC-MCP: Maintenance Connection MCP Server

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server that wraps the Accruent Maintenance Connection (MC) REST API. Connects LLM clients (Claude Desktop, VS Code, etc.) to live CMMS data so users can ask natural-language questions about work orders, assets, parts, purchase orders, and more.

## Requirements

- [Bun](https://bun.sh) v1.0+
- A Maintenance Connection API key and connection key

## Setup

```bash
bun install
```

Create a `.env` file in the project root:

```env
MC_BASE_URL=https://api.maintenanceconnection.com/v8
MC_BASIC_AUTH_ENCODED=<base64(CONNECTION_KEY:API_KEY)>
```

**How to generate `MC_BASIC_AUTH_ENCODED`:**

```bash
echo -n "YOUR_CONNECTION_KEY:YOUR_API_KEY" | base64
```

> The connection key identifies the tenant (username); the API key authenticates the caller (password). Order matters — connection key must come first.

## Running

```bash
# Development — runs TypeScript directly via Bun
bun --env-file=.env run src/index.ts

# Or using the package.json script (loads .env automatically)
bun dev
```

**Test connectivity before connecting a client:**

```bash
bun --env-file=.env -e "
import { loadConfig } from './src/config.ts'
import { McClient } from './src/mc-client.ts'
const client = new McClient(loadConfig())
const r = await client.get('/workorders', { params: { \$top: 1 } })
console.log('Connected. Total WOs:', r.Total)
"
```

## Connecting to Claude Desktop

This server uses **HTTP transport**. Claude Desktop connects via `mcp-remote`, which bridges the local stdio expectation to the remote HTTP endpoint.

**Steps:**

1. Open Claude Desktop
2. Go to **Settings → Developer → Edit Config**
3. Add the following entry inside the `"mcpServers"` object in `claude_desktop_config.json`:

```json
"mc-mcp": {
  "command": "npx",
  "args": [
    "mcp-remote",
    "https://mc-mcp.up.railway.app/mcp",
    "--header",
    "X-MC-Basic-Auth: base64(CONNECTION_KEY:API_KEY)"
  ]
}
```

> **HTTPS is handled by Railway** — the server speaks plain HTTP internally; clients always connect over `https://`.

Replace the header value with your encoded MC credentials:

```bash
echo -n "YOUR_CONNECTION_KEY:YOUR_API_KEY" | base64
```

4. Save and **restart Claude Desktop**
5. Verify the server appears under the MCP tools icon (hammer icon) in the chat interface

**Suggested first prompts:**

- *"What data is available in Maintenance Connection?"* — calls `mc_list_datasets`
- *"Show me open work orders"* — calls `mc_list_work_orders` with `IsOpen eq true`
- *"How many assets does this facility have?"* — calls `mc_list_assets`
- *"Are there any open purchase orders?"* — calls `mc_list_purchase_orders`

## Available Tools


| Tool                      | Description                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mc_ping`                 | Verify connectivity and auth                                                                                                                         |
| `mc_list_datasets`        | List all available resource families and their tools — call this first to orient                                                                     |
| `mc_list_work_orders`     | List work orders (types: CM=Corrective, PM=Preventive, SR=Service Request)                                                                           |
| `mc_get_work_order`       | Get a single work order by PK                                                                                                                        |
| `mc_list_assets`          | List assets and locations (33,639 records, hierarchical)                                                                                             |
| `mc_get_asset`            | Get a single asset by PK                                                                                                                             |
| `mc_list_parts`           | List inventory parts (3,305 records)                                                                                                                 |
| `mc_get_part`             | Get a single part by PK                                                                                                                              |
| `mc_list_purchase_orders` | List purchase orders (74 records)                                                                                                                    |
| `mc_get_purchase_order`   | Get a single purchase order by PK                                                                                                                    |
| `mc_list_po_line_items`   | List PO line items — filter by `PurchaseOrderPK eq {pk}` to see what was ordered on a PO, or by `PartRef/PK` to trace procurement history for a part |


All list tools support OData pagination: `$top` (max 500), `$skip`, `$orderby`.

**OData filter syntax** — string values must use double quotes (MC API quirk — single quotes are stripped by the parser):

```
IsOpen eq true                        boolean
IsAssigned eq false                   boolean
IsLocation eq false                   assets — equipment only
Type eq "CM"                          work orders — corrective maintenance
Type eq "PM"                          work orders — preventive maintenance
Type eq "SR"                          work orders — service requests
ID eq "AC001/001"                     match by ID string
StatusDetails/Value eq "ISSUED"       match by status
```

## Project Structure

```
src/
├── index.ts              # Server entry point — registers all tools
├── config.ts             # Env var loading (MC_BASE_URL, MC_BASIC_AUTH_ENCODED)
├── mc-client.ts          # HTTP wrapper — all auth logic lives here
├── shared/
│   ├── odata.ts          # Shared OData Zod params ($filter, $top, $skip, $orderby)
│   ├── response.ts       # toToolText() / toToolError() helpers
│   └── types.ts          # Zod schemas + inferred TypeScript types for all entities
└── tools/
    ├── ping.ts
    ├── datasets.ts        # Static tool — no API call
    ├── work-orders.ts
    ├── assets.ts
    ├── parts.ts
    └── purchase-orders.ts
```

## Adding a New Tool Domain

1. Look up the endpoint in `api-docs/mc-normalized-api-map.json`
2. Add a Zod schema to `src/shared/types.ts` with confirmed fields only
3. Create `src/tools/<domain>.ts` exporting `register(server, client)`
4. Import and call `register` in `src/index.ts`
5. Run `bun run --bun tsc --noEmit` to type-check

> If using Claude Code, the `add-mc-tool-domain` skill automates this process.

