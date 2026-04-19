# Open Questions

These must be answered before the relevant work can proceed.

1. ~~What auth scheme does the MC API use?~~ **Resolved:** HTTP Basic, `base64(CONNECTION_KEY:API_KEY)`
2. ~~Which 3–5 entities are highest priority?~~ **Resolved:** Assets, Work Orders (CM), PMs (PM), Work Requests (SR)
3. DEV environment — does it use a different base URL? Is the DEV connection key provisioned?
4. ~~Which MCP client will connect first? (Claude Desktop, VS Code extension, custom?)~~ **Resolved:** Claude Desktop will be first
5. Are there PII or data sensitivity rules that constrain what we expose?
6. Natural-language-only filtering, structured filters, or both?
