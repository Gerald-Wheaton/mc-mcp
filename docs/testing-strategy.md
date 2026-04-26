# Testing Strategy

This repo is a thin MCP adapter around the Maintenance Connection API, plus a growing context/prompt layer.
That means the most valuable tests are the ones that protect:

- HTTP and MCP protocol wiring
- MC client error handling, pagination, and caching
- Zod schema contracts for parsed MC payloads
- Prompt and resource registration contracts
- User-facing error formatting

## Baseline Suite for `bun run test`

### 1. Fast unit tests

- `src/config.ts`
  - Defaults are applied when env vars are absent
  - `MC_BASE_URL` trailing slash is stripped
- `src/mc-client.ts`
  - Successful JSON fetch
  - 401 / non-200 responses become `McApiError`
  - aborts become `McTimeoutError`
  - `getAllPages()` keeps paging until complete
  - `getCached()` reuses cached and in-flight work
- `src/shared/response.ts`
  - timeout errors get the narrowing hint
  - 401 errors get the credential-specific guidance

### 2. Schema fixture tests

- `src/shared/types.ts`
  - Representative fixtures for work orders, assets, parts, purchase orders, and PO line items still parse
  - Known nullable/ref edge cases stay allowed, especially `EntityRef.Name = null`

These are not a replacement for live smoke tests, but they prevent accidental tightening or drift in local code.

### 3. MCP server integration tests

- `GET /health` returns `200 ok`
- `/mcp` rejects:
  - missing auth header
  - invalid JSON bodies
  - GET requests without a session ID
- real MCP initialize handshake succeeds through the SDK client
- `listTools`, `listPrompts`, and `listResources` expose the expected surface area
- static resources like `mc://context/time` and `mc://context/datasets` read successfully
- prompt retrieval returns the expected scoping/context instructions
- invalid prompt arg combinations fail fast

### 4. Dynamic resource and tool-handler tests

- Each major tool domain is exercised through the MCP contract with a fake `McClient`
- Dynamic resources verify:
  - count aggregation
  - normalization behavior
  - grouping/sorting logic
  - readable error propagation
  - cache reuse on repeated reads

### 5. Optional live smoke tests

These are skipped by default and only run when explicitly enabled:

```bash
MC_LIVE_TESTS=true MC_BASIC_AUTH_ENCODED=... bun run test
```

They are intended as a quick confidence pass against a real tenant, not as always-on CI tests.

## Next Tests to Add

Once this baseline is stable, the next highest-value additions are:

1. Tool handler tests with fake `McClient` responses for each domain tool.
2. Resource loader tests for `summary`, `labors`, `asset-locations`, and `lookup-tables`.
3. Snapshot-style contract fixtures captured from real MC responses and scrubbed for safe local use.
4. Optional live smoke tests behind an env flag, for example:
   - `MC_LIVE_TESTS=true bun test`
   - ping
   - one list call per entity with `$top=1`
   - one resource read for each dynamic resource
5. Regression tests for future hardening features, especially automatic pagination metadata and rate limiting.

## Why This Shape Fits The Repo

The project direction is clear in the roadmap:

- reliability and timeout handling
- prompt/resource-guided analysis
- pagination and transport hardening
- stable MCP surface area for Claude/Desktop clients

So the suite should stay heavily weighted toward contract and transport tests, not browser-style end-to-end tests.
There is no UI here. The "product" is the API adapter behavior and the MCP contract it presents to the client.
