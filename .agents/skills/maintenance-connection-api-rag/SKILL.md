---
name: maintenance-connection-api-rag
description: Use normalized API map + LLM chunks to answer Maintenance Connection API questions with a retrieve-then-lookup workflow.
---

# Maintenance Connection API RAG Skill

## Contracts

Read `.Codex/skills/maintenance-connection-api-rag/contracts.json` at the start of this skill. It defines the required artifacts, preferred workflow order, and response requirements that must be followed.

## When to use this skill

Use this skill when the user asks about:

- Maintenance Connection API endpoints
- request or response schemas
- which endpoint to use for a task
- parameters required for a route
- related endpoints in the same resource family
- translating fuzzy API questions into exact endpoint details

Use this skill only when the available local API artifacts exist:

- `mc-normalized-api-map.json`
- `mc-llm-api-chunks.json`

## Core idea

Use a two-stage process:

1. **Semantic discovery** from `mc-llm-api-chunks.json`
   - Use this for fuzzy user intent.
   - Find the most likely endpoints, schemas, and resource families.

2. **Deterministic verification** from `mc-normalized-api-map.json`
   - Use this to confirm exact method, path, parameters, request body schema, and responses.
   - Prefer normalized-map facts over chunk summaries when they differ.

Never answer endpoint questions from chunk text alone when exact details matter.

## Mental model

- `mc-normalized-api-map.json` = structured source of truth
- `mc-llm-api-chunks.json` = semantic retrieval layer

## Goals

- Find likely endpoints quickly
- Confirm exact details before answering
- Reduce hallucinations
- Surface related schemas and neighboring operations

## Workflow

### A. Classify the question

First determine which category the request fits:

1. **Discovery question**
   Example: "How do I upload a document to an asset?"
   Action: Search chunks first, then verify in normalized map.

2. **Exact endpoint question**
   Example: "What does `GET /Assets/{PK}` require?"
   Action: Go directly to normalized map lookup if path/method is exact.

3. **Schema question**
   Example: "What fields are on WorkOrderCreate?"
   Action: Look up schema in normalized map. Use chunks only if needed to find the schema name.

4. **Comparison question**
   Example: "What is the difference between the asset documents endpoints?"
   Action: Find sibling operations in the same path/resource family, then compare normalized records.

### B. Retrieve candidate operations

For fuzzy questions, search chunk text using:

- nouns from the user’s task
- likely API resource names
- likely verbs such as get, create, update, delete, upload, attach, list
- nearby concepts from the user’s wording

Prefer chunks of type:

- `endpoint`
- then `schema`

Rank candidates by:

1. semantic closeness to the task
2. matching resource family
3. matching HTTP verb semantics
4. presence of relevant related schemas

### C. Verify with normalized map

Once candidate operations are found, verify:

- method
- path
- tag
- summary
- path params
- query params
- body params
- requestBodySchemaRef
- responseSchemaRefs
- produces / consumes
- usageNotes

If the question is about fields, also inspect the referenced schema(s).

### D. Answer format

When answering, include:

- best candidate endpoint(s)
- exact method + path
- what it appears to do
- required params
- body schema, if any
- notable response schemas
- caveats or uncertainty when multiple candidates exist

When useful, include a short “Why this endpoint” note.

## Reliability rules

- Prefer normalized map over chunk text for exact facts.
- Preserve exact method names, paths, parameter names, and schema names.
- Do not invent undocumented parameters.
- If multiple endpoints are plausible, present the top 2–3 and explain the distinction.
- If the schema is nested, mention the main schema and key referenced schemas rather than guessing all nested fields from memory.

## Recommended lookup helpers

If helper functions are available, use or emulate:

- `findOperations(query)`
- `getOperationById(operationId)`
- `getOperationByMethodAndPath(method, path)`
- `getSchema(name)`
- `getOperationsForSchema(name)`
- `getSiblingOperations(operation)`

## Query strategies

### Fuzzy task -> endpoint

User: "How do I attach a file to an asset?"
Process:

1. Search chunk text for `attach file asset`, `upload document asset`, `asset documents`
2. Select top endpoint chunk candidates
3. Verify exact routes in normalized map
4. Inspect request body or multipart details
5. Return the best endpoint and alternates if needed

### Exact route -> full details

User: "Tell me about POST /Assets/{assetPK}/Documents"
Process:

1. Directly lookup by method and path in normalized map
2. Extract params, consumes, body, responses
3. Return exact details

### Schema field question

User: "What fields does ApiResponse contain?"
Process:

1. Lookup schema in normalized map
2. Return required fields, key properties, and refs

## Output style

Be concise but exact.
Use bullet sections only when they improve clarity.

## Failure mode handling

If no endpoint is an obvious match:

- say that the match is uncertain
- list the closest candidates
- explain what is missing
- avoid pretending certainty

If chunks and normalized map appear inconsistent:

- trust normalized map
- mention that the chunk appears stale or simplified

## Example

User question: "How do I create a work order?"

Good response shape:

1. Likely endpoint: `POST /WorkOrders`
2. Purpose: creates a work order
3. Request body: `<SchemaName>`
4. Path params: none / or list them
5. Responses: `<ResponseSchemas>`
6. Nearby alternatives: `PUT /WorkOrders/{PK}` for updates

## Anti-patterns

Do not:

- answer from semantic chunks alone when exactness matters
- dump the raw schema without selecting relevant fields
- confuse sibling endpoints with similar resource names
- assume POST always means create without checking summary/path
