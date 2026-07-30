# Beta Readiness Roadmap

Tracks the four segments needed to reach a solid beta testing state. Update each segment as
work completes.

---

## Segment 1 — Reliability ✅

All three items implemented on `phase-4-and-auth-cleanup`.

- [x] **Request timeouts** — `McClient.get()` wraps every fetch with `AbortController` (30s
  default). Hung MC API requests now fail with a descriptive `McTimeoutError` instead of
  hanging forever.
- [x] **Clear credential errors** — `toToolError` detects MC 401s and surfaces
  "MC credentials rejected — verify your X-MC-Basic-Auth header..." instead of a raw JSON error.
- [x] **Basic logging** — `[mc]` lines on every outbound MC API call (path, status, duration);
  `[http]` lines on every `/mcp` request (method, session ID prefix, status, duration).

---

## Segment 2 — Deployment ✅

- [x] Choose hosting platform — Railway selected
- [x] Deploy server — live at `https://mc-mcp-production-d25a.up.railway.app`; `GET /health` returns `ok`
- [x] README updated with hosted URL; HTTPS handled by Railway

---

## Segment 3 — UX Quality

Not beta-blocking but critical before a real customer demo.

- [ ] **Pagination metadata** — Append `{ total, returned, nextSkip }` to all list tool
  responses so the LLM knows when more data exists and can offer "show more" rather than
  silently stopping at 500 records. Assets (33,639) and Parts (3,305) are the primary concern.
- [x] **End-user UX audit** — Sweep all tool descriptions (`src/tools/*.ts`), prompt templates
  (`src/prompts/*.ts`), and context resource descriptions (`src/resources/context.ts`) to
  ensure OData syntax and developer-facing terms never surface in user-facing replies. The LLM
  should silently translate intent to filters; users should see plain English.

---

## Segment 4 — Post-Launch Hardening

Can follow the first beta feedback round.

- [ ] **Rate limiting** — Per-session rolling window cap (~60 req/min). Return a tool error
  when exceeded rather than forwarding to MC API.
- [ ] **Tests** — At minimum: MCP `initialize` handshake with fake credentials, timeout error
  path, and 401 credential error path in `McClient`.
