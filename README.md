MCP TypeScript SDK
[!IMPORTANT] This is the main branch which contains v2 of the SDK (currently in development, pre-alpha).

We anticipate a stable v2 release in Q1 2026. Until then, v1.x remains the recommended version for production use. v1.x will continue to receive bug fixes and security updates for at least 6 months after v2 ships to give people time to upgrade.

For v1 documentation, see the V1 API docs. For v2 API docs, see /v2/.

NPM Version NPM Version MIT licensed

Table of Contents
Overview
The Model Context Protocol (MCP) allows applications to provide context for LLMs in a standardized way, separating the concerns of providing context from the actual LLM interaction.

This repository contains the TypeScript SDK implementation of the MCP specification. It runs on Node.js, Bun, and Deno, and ships:

MCP server libraries (tools/resources/prompts, Streamable HTTP, stdio, auth helpers)
MCP client libraries (transports, high-level helpers, OAuth helpers)
Optional middleware packages for specific runtimes/frameworks (Express, Hono, Node.js HTTP)
Runnable examples (under examples/)
Packages
This monorepo publishes split packages:

@modelcontextprotocol/server: build MCP servers
@modelcontextprotocol/client: build MCP clients
Both packages have a required peer dependency on zod for schema validation. The SDK uses Zod v4.

Middleware packages (optional)
The SDK also publishes small "middleware" packages under packages/middleware/ that help you wire MCP into a specific runtime or web framework.

They are intentionally thin adapters: they should not introduce new MCP functionality or business logic. See packages/middleware/README.md for details.

@modelcontextprotocol/node: Node.js Streamable HTTP transport wrapper for IncomingMessage / ServerResponse
@modelcontextprotocol/express: Express helpers (app defaults + Host header validation)
@modelcontextprotocol/hono: Hono helpers (app defaults + JSON body parsing hook + Host header validation)
Installation
Server
npm install @modelcontextprotocol/server zod

# or

bun add @modelcontextprotocol/server zod

# or

deno add npm:@modelcontextprotocol/server npm:zod
Client
npm install @modelcontextprotocol/client zod

# or

bun add @modelcontextprotocol/client zod

# or

deno add npm:@modelcontextprotocol/client npm:zod
Optional middleware packages
The SDK also publishes optional “middleware” packages that help you wire MCP into a specific runtime or web framework (for example Express, Hono, or Node.js http).

These packages are intentionally thin adapters and should not introduce additional MCP features or business logic. See packages/middleware/README.md for details.

# Node.js HTTP (IncomingMessage/ServerResponse) Streamable HTTP transport:

npm install @modelcontextprotocol/node

# Express integration:

npm install @modelcontextprotocol/express express

# Hono integration:

npm install @modelcontextprotocol/hono hono
Quick Start (runnable examples)
The runnable examples live under examples/ and are kept in sync with the docs.

Install dependencies (from repo root):
pnpm install
Run a Streamable HTTP example server:
pnpm --filter @modelcontextprotocol/examples-server exec tsx src/simpleStreamableHttp.ts
Alternatively, from within the example package:

cd examples/server
pnpm tsx src/simpleStreamableHttp.ts
Run the interactive client in another terminal:
pnpm --filter @modelcontextprotocol/examples-client exec tsx src/simpleStreamableHttp.ts
Alternatively, from within the example package:

cd examples/client
pnpm tsx src/simpleStreamableHttp.ts
Next steps:

Server examples index: examples/server/README.md
Client examples index: examples/client/README.md
Guided walkthroughs: docs/server.md and docs/client.md
Documentation
Local SDK docs:
docs/server.md – building MCP servers, transports, tools/resources/prompts, sampling, elicitation, tasks, and deployment patterns.
docs/client.md – building MCP clients: connecting, tools, resources, prompts, server-initiated requests, and error handling
docs/faq.md – frequently asked questions and troubleshooting
External references:
SDK API documentation
Model Context Protocol documentation
MCP Specification
Example Servers
Building docs locally
To generate the API reference documentation locally:

pnpm docs # Generate V2 docs only (output: tmp/docs/)
pnpm docs:multi # Generate combined V1 + V2 docs (output: tmp/docs-combined/)
The docs:multi script checks out both the v1.x and main branches via git worktrees, builds each, and produces a combined site with V1 docs at the root and V2 docs under /v2/.

v1 (legacy) documentation and fixes
If you are using the v1 generation of the SDK, the v1 API documentation is available at https://ts.sdk.modelcontextprotocol.io/. The v1 source code and any v1-specific fixes live on the long-lived v1.x branch. V2 API docs are at /v2/.

Contributing
Issues and pull requests are welcome on GitHub at https://github.com/modelcontextprotocol/typescript-sdk.

License
This project is licensed under the Apache License 2.0 for new contributions, with existing code under MIT. See the LICENSE file for details.
