# MC-MCP: Maintenance Connection MCP Server

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server that wraps the Accruent Maintenance Connection (MC) REST API. Connects LLM clients (Claude Desktop, VS Code, etc.) to live CMMS data so users can ask natural-language questions about work orders, assets, parts, purchase orders, and more.

> **New to this repo, or new to MCPs?** Start with [docs/project-overview.md](docs/project-overview.md): what has been built, how it works, the slice of the MC API it covers, and its current limits.

## Requirements

- [Bun](https://bun.sh) v1.0+
- A Maintenance Connection API key and connection key

## Setup

```bash
bun install
```

The server itself needs no credentials. It reads two optional env vars, which a `.env` file in the project root can override:

```env
PORT=3000
MC_BASE_URL=https://api.maintenanceconnection.com/v8
```

MC credentials are supplied by each client session via the `X-MC-Basic-Auth` header (see "Connecting to Claude Desktop" below). Generate the encoded value like this:

```bash
echo -n "YOUR_CONNECTION_KEY:YOUR_API_KEY" | base64
```

> The connection key identifies the tenant (username); the API key authenticates the caller (password). Order matters: connection key must come first.

## Running

```bash
# Runs TypeScript directly via Bun (Bun auto-loads .env)
bun dev
```

The server listens on `http://localhost:3000` (override with `PORT`).

**Test the server is up:**

```bash
curl http://localhost:3000/health
# → ok
```

To verify real MC credentials end to end, run the live smoke tests (below) or connect an MCP client and call `mc_ping`.

## Testing

Run the full local test suite with:

```bash
bun run test
```

This suite covers:

- `McClient` behavior: success paths, 401s, timeouts, pagination, and caching
- MCP contract checks: tools, prompts, resources, and request routing
- Domain tool handlers with fake MC responses
- Dynamic context resources such as `mc://context/summary`, `mc://context/labors`, `mc://context/asset-locations`, and `mc://context/lookup-tables`
- Schema fixture parsing for work orders, assets, parts, purchase orders, and PO line items

Type-check the project with:

```bash
bun run build
```

### Optional Live Smoke Tests

Live smoke tests are skipped by default. To run them against a real MC tenant:

```bash
MC_LIVE_TESTS=true MC_BASIC_AUTH_ENCODED=... bun run test
```

These smoke tests are intended as a quick confidence check for real credentials and core endpoints. They are not required for normal local development.

## Deployment

See [`docs/deployment.md`](docs/deployment.md) for the full runbook covering Railway, local dev, credential format, credential rotation, log format, and known limitations.

> **Hosting status:** the original Railway deployment ran on Gerald's personal account and is not active at the moment. Deploy a fresh instance before pointing clients at the config below.

## Connecting to Claude Desktop

This server uses **HTTP transport**. Claude Desktop connects via `mcp-remote`, which bridges the local stdio expectation to the remote HTTP endpoint.

> **HTTPS is handled by Railway** — the server speaks plain HTTP internally; clients always connect over `https://`.

### Step 0 — Install Node.js (if you don't have it)

`mcp-remote` requires Node.js. If you're not sure whether you have it, open a terminal and run `node --version`. If you get a version number back, skip this step.

**Mac:**
Download and run the installer from [nodejs.org](https://nodejs.org) (choose the LTS version), or if you use Homebrew:
```bash
brew install node
```

**Windows:**
Download and run the installer from [nodejs.org](https://nodejs.org) (choose the LTS version), or via winget:
```powershell
winget install OpenJS.NodeJS
```

Once installed, close and reopen your terminal, then confirm with `node --version`.

### Step 1 — Generate your credentials

Encode your connection key and API key as a single Base64 string. The connection key identifies the tenant (username); the API key authenticates the caller (password). Order matters — connection key must come first.

**Mac / Linux (Terminal):**
```bash
echo -n "YOUR_CONNECTION_KEY:YOUR_API_KEY" | base64
```

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("YOUR_CONNECTION_KEY:YOUR_API_KEY"))
```

Copy the output — you'll paste it as `YOUR_BASE64_CREDENTIALS` below.

### Step 2 — Add the MCP server config

1. Open Claude Desktop
2. Go to **Settings → Developer → Edit Config**
3. Add the appropriate entry inside the `"mcpServers"` object in `claude_desktop_config.json`:

**Mac / Linux:**
```json
"mc-mcp": {
  "command": "npx",
  "args": [
    "mcp-remote",
    "https://YOUR-RAILWAY-DOMAIN.up.railway.app/mcp",
    "--header",
    "X-MC-Basic-Auth: YOUR_BASE64_CREDENTIALS",
    "--header",
    "X-MC-Base-URL: https://api.maintenanceconnection.com/v8"
  ]
}
```

**Windows:**
```json
"mc-mcp": {
  "command": "cmd",
  "args": [
    "/c", "npx", "mcp-remote",
    "https://YOUR-RAILWAY-DOMAIN.up.railway.app/mcp",
    "--header",
    "X-MC-Basic-Auth: YOUR_BASE64_CREDENTIALS",
    "--header",
    "X-MC-Base-URL: https://api.maintenanceconnection.com/v8"
  ]
}
```

> **Staging vs. production:** Replace the `X-MC-Base-URL` value with `https://api-stage.maintenanceconnection.com/v8` if your credentials are for the MC staging environment.

> Windows requires routing through `cmd /c` because Claude Desktop cannot resolve the bare `npx` command on Windows — `npx.cmd` is the actual executable.

4. Save and **restart Claude Desktop**
5. Verify the server appears under the MCP tools icon (hammer icon) in the chat interface

**Suggested first prompts:**

- _"What data is available in Maintenance Connection?"_ — calls `mc_list_datasets`
- _"Show me open work orders"_ — calls `mc_list_work_orders` with `IsOpen eq true`
- _"How many assets does this facility have?"_ — calls `mc_list_assets`
- _"Are there any open purchase orders?"_ — calls `mc_list_purchase_orders`

## Available Tools

| Tool                      | Description                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mc_ping`                 | Verify connectivity and auth                                                                                                                         |
| `mc_list_datasets`        | List all available resource families and their tools — call this first to orient                                                                     |
| `mc_list_work_orders`     | List work orders (types: CM=Corrective, PM=Preventive, SR=Service Request)                                                                           |
| `mc_get_work_order`       | Get a single work order by PK                                                                                                                        |
| `mc_list_assets`          | List assets and locations (hierarchical)                                                                                                             |
| `mc_get_asset`            | Get a single asset by PK                                                                                                                             |
| `mc_list_parts`           | List inventory parts                                                                                                                                 |
| `mc_get_part`             | Get a single part by PK                                                                                                                              |
| `mc_list_purchase_orders` | List purchase orders                                                                                                                                 |
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
├── index.ts              # Bootstrap: loads config, starts the HTTP server
├── config.ts             # Env loading (PORT, MC_BASE_URL); credentials are never server env
├── server.ts             # HTTP routing, sessions, per-session credentials, MCP server assembly
├── mc-client.ts          # MC API wrapper: auth, retries, timeouts, caching
├── prompts/              # Prompt templates (see PROMPTS.md) + repair-center scoping helper
├── resources/
│   └── context.ts        # mc://context/* resources: time, datasets, summary, labors, locations, lookups
├── shared/
│   ├── datasets.ts       # Dataset catalog shared by tool and resource layers
│   ├── odata.ts          # Shared OData Zod params ($filter, $top, $skip, $orderby)
│   ├── response.ts       # toToolText() / toToolError() helpers
│   └── types.ts          # Zod schemas + inferred TypeScript types for all entities
└── tools/
    ├── ping.ts
    ├── datasets.ts       # mc_list_datasets: static, no API call
    ├── work-orders.ts
    ├── assets.ts
    ├── parts.ts
    └── purchase-orders.ts
tests/                    # bun test suite: client, routing, contract, handlers, fixtures
```

## Adding a New Tool Domain

1. Look up the endpoint in `api-docs/mc-normalized-api-map.json`
2. Add a Zod schema to `src/shared/types.ts` with confirmed fields only
3. Create `src/tools/<domain>.ts` exporting `register(server, client)`
4. Import and call `register` in `buildMcpServer` (`src/server.ts`)
5. Run `bun run build` to type-check

> If using Claude Code, the `add-mc-tool-domain` skill automates this process.
