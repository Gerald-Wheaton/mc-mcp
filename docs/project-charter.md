# Maintenance Connection MCP Server

## Goal

Build an MCP server that connects to the company's Maintenance Connection API and exposes read-only operational data to LLM clients in a safe, discoverable way.

## Initial Scope

- Connect to Maintenance Connection through its API
- Expose table-like data as MCP resources and/or tools
- Provide read-only query tools
- Provide prompt templates for common data analysis tasks
- Provide a lookup/discovery tool so the LLM can find the correct tools and datasets
- Document requirements, implementation decisions, usage, and build process

## Non-Goals For First Iteration

- Direct database connections unless the API proves insufficient
- Write/update/delete operations
- Autonomous actions in Maintenance Connection
- Broad unrestricted SQL execution

## Working Principles

- Read-only by default
- Small, testable increments
- Document every material decision
- Prefer explicit schemas over ad hoc payloads
- Keep the first release usable before making it comprehensive

## Open Questions

- Which Maintenance Connection API is available, and how is it authenticated?
- Which entities matter first?
- What query patterns need to be supported?
- Who will use this MCP server and from which MCP clients?
- What safety rules must constrain data access?
