# Open Questions

These must be answered before the relevant work can proceed.

1. ~~What auth scheme does the MC API use?~~ **Resolved:** HTTP Basic, `base64(CONNECTION_KEY:API_KEY)`
2. ~~Which 3–5 entities are highest priority?~~ **Resolved:** Assets, Work Orders (CM), PMs (PM), Work Requests (SR)
3. DEV environment — does it use a different base URL? Is the DEV connection key provisioned?
4. ~~Which MCP client will connect first? (Claude Desktop, VS Code extension, custom?)~~ **Resolved:** Claude Desktop will be first
5. ~~Are there PII or data sensitivity rules that constrain what we expose?~~ **Resolve:** Not as of now
6. Natural-language-only filtering, structured filters, or both?

## UX Design Concern: Never Expose OData to End Users

**Brainstorm needed.** End users are facility managers and maintenance techs — not developers. The LLM must never suggest OData filter syntax in its replies (e.g. `IsLocation eq false`). That phrasing is meaningless to the target audience and actively harmful if they try to act on it.

The right pattern: if the LLM wants to offer a filtered view, it should say "I can show you equipment only if you'd like" and then apply the filter itself on the next tool call. The OData mechanics stay entirely on the backend.

Example of what went wrong:
> "If you want a meaningful equipment-only count, filtering `IsLocation eq false` would trim that significantly."

What it should say instead:
> "That 33,639 total includes location nodes (buildings, campuses, floors), not just equipment. Want me to pull the equipment-only count?"

This likely requires revisiting prompt template wording and tool descriptions to ensure the LLM is instructed to handle filter translation itself rather than delegating that to the user.
