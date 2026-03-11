# Interview Log

This file records the questions, answers, and decisions collected while shaping the MCP server.

## Session 1 - 2026-03-11

### Current Known Requirements

- Need an MCP server for Maintenance Connection data
- Must connect through the company API
- Must expose data from underlying tables
- Must provide read-only query tools
- Must provide prompts for common analysis tasks
- Must provide a lookup/discovery tool for the LLM
- Must document setup, usage, and build process

### Open Questions

- What exact Maintenance Connection product/API is in use?
- What auth method is required?
- Is there a sandbox or test environment?
- Which tables or business domains are highest priority?
- Are there compliance or PII constraints?
- What MCP client(s) will connect to this server?
