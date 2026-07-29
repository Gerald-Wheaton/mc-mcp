# Deployment Runbook

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP port the server listens on |
| `MC_BASE_URL` | No | `https://api.maintenanceconnection.com/v8` | MC API base URL |

**Credentials are NOT a server environment variable.** Each client session passes its MC credentials via the `X-MC-Basic-Auth` request header. The server never reads credentials from env — it proxies whatever the client sends.

## Running locally

```bash
bun --env-file=.env run src/index.ts
```

The server starts on `http://localhost:3000`. The `.env` file is only needed if you want to override `PORT` or `MC_BASE_URL` — credentials come from the MCP client header.

**Health check:**

```bash
curl http://localhost:3000/health
# → ok
```

## Railway deployment

> **Status:** the original deployment ran on Gerald's personal Railway account and is no longer active. There is currently no live instance; deploy a fresh one before connecting clients.

To stand up a new instance, create a Railway project from this repo (`railway.toml` is already present) with:

- **Health check path:** `/health`
- **HTTPS:** handled by Railway's proxy; the server speaks plain HTTP internally
- **Build command:** `bun install`
- **Start command:** `bun run src/index.ts`

Railway auto-deploys on push to whichever branch the linked project tracks (`main` by convention).

To check deployment status or view logs, use the Railway dashboard or CLI:

```bash
railway logs
```

## Claude Desktop config

Add the following entry to `claude_desktop_config.json` under `"mcpServers"`:

```json
"mc-mcp": {
  "command": "npx",
  "args": [
    "mcp-remote",
    "https://YOUR-DEPLOYED-DOMAIN/mcp",
    "--header",
    "X-MC-Basic-Auth: <base64(CONNECTION_KEY:API_KEY)>",
    "--header",
    "X-MC-Base-URL: https://api.maintenanceconnection.com/v8"
  ]
}
```

For local development, replace the URL with `http://localhost:3000/mcp`.

## Credential format

Credentials are pre-encoded HTTP Basic auth:

```bash
echo -n "YOUR_CONNECTION_KEY:YOUR_API_KEY" | base64
```

- **Connection key** — identifies the tenant (username in Basic auth)
- **API key** — authenticates the caller (password in Basic auth)
- Order matters: connection key must come first

The resulting base64 string goes into the `X-MC-Basic-Auth` header value.

## Credential rotation

1. Re-encode the new key pair: `echo -n "CONNECTION_KEY:NEW_API_KEY" | base64`
2. Update the `X-MC-Basic-Auth` value in the Claude Desktop config (or whichever MCP client is in use)
3. Restart the MCP client to pick up the new header value

No server restart is required — credentials are validated per session, not at startup.

## Log format

The server emits structured log lines to stdout. Each line is prefixed by its subsystem:

| Prefix | Source | Example |
|--------|--------|---------|
| `[http]` | `src/server.ts` | `[http] POST /mcp session=a1b2c3 → 200 in 142ms` |
| `[mc]` | `src/mc-client.ts` | `[mc] GET /workorders → 200 in 89ms` |
| `[mc]` | `src/mc-client.ts` | `[mc] GET /Assets → TIMEOUT after 30000ms` |
| `[mc]` | `src/mc-client.ts` | `[mc] GET /Parts → retry 1/2 after 300ms` |
| `[mc]` | `src/mc-client.ts` | `[mc] CACHE miss context:labors — fetching` |
| `[mc]` | `src/mc-client.ts` | `[mc] CACHE hit context:labors (43181s remaining)` |
| `[tool]` | `src/shared/response.ts` | `[tool] error: McTimeoutError: ...` |
| `[resource]` | `src/resources/context.ts` | `[resource] mc://context/labors failed: ...` |

On Railway, logs are available in the dashboard under the deployment's **Logs** tab. Filter by prefix to isolate API errors (`[mc]`), client session activity (`[http]`), or resource failures (`[resource]`).

## Known limitations

- **No rate limiting** — the server does not throttle requests to the MC API. Concurrent sessions each issue their own requests.
- **No OAuth** — authentication uses static API keys passed per session. No token refresh flow.
- **Read-only** — no write, update, or delete operations are exposed. All MCP tools are read-only queries.
- **In-memory sessions** — sessions are stored in a process-level Map. A server restart clears all active sessions; clients will re-initialize automatically on the next request.
- **In-memory cache** — context resource caches (labors, asset-locations, lookup-tables) are per-process and reset on restart.
