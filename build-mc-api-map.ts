// build-mc-api-map.ts
// Usage:
//   bun run build-mc-api-map.ts ./mc-api-swagger.json ./out
//
// Outputs:
//   ./out/mc-normalized-api-map.json
//   ./out/mc-llm-api-chunks.json

import fs from "node:fs";
import path from "node:path";

type HttpMethod =
  | "get"
  | "post"
  | "put"
  | "delete"
  | "patch"
  | "options"
  | "head";

type SwaggerRef = { $ref: string };

type SwaggerSchema = {
  type?: string;
  format?: string;
  items?: SwaggerSchema;
  properties?: Record<string, SwaggerSchema>;
  required?: string[];
  enum?: unknown[];
  allOf?: SwaggerSchema[];
  additionalProperties?: boolean | SwaggerSchema;
  description?: string;
} & Partial<SwaggerRef>;

type SwaggerParameter = {
  name: string;
  in: "query" | "path" | "body" | "header" | "formData";
  description?: string;
  required?: boolean;
  type?: string;
  format?: string;
  schema?: SwaggerSchema;
  items?: SwaggerSchema;
};

type SwaggerResponse = {
  description?: string;
  schema?: SwaggerSchema;
};

type SwaggerOperation = {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  consumes?: string[];
  produces?: string[];
  parameters?: SwaggerParameter[];
  responses?: Record<string, SwaggerResponse>;
};

type SwaggerPathItem = Partial<Record<HttpMethod, SwaggerOperation>>;

type SwaggerTag = {
  name: string;
  description?: string;
};

type SwaggerDoc = {
  swagger: string;
  host?: string;
  basePath?: string;
  schemes?: string[];
  consumes?: string[];
  produces?: string[];
  tags?: SwaggerTag[];
  paths: Record<string, SwaggerPathItem>;
  definitions?: Record<string, SwaggerSchema>;
};

type NormalizedParameter = {
  name: string;
  in: "query" | "path" | "body" | "header" | "formData";
  required: boolean;
  description?: string;
  type?: string;
  format?: string;
  schemaRef?: string;
  itemsRef?: string;
  rawSchema?: SwaggerSchema;
};

type NormalizedResponse = {
  statusCode: string;
  description?: string;
  schemaRef?: string;
  rawSchema?: SwaggerSchema;
};

type NormalizedOperation = {
  operationId: string;
  tag: string;
  method: string;
  path: string;
  summary: string;
  description?: string;
  consumes: string[];
  produces: string[];
  parameters: NormalizedParameter[];
  pathParams: NormalizedParameter[];
  queryParams: NormalizedParameter[];
  bodyParams: NormalizedParameter[];
  headerParams: NormalizedParameter[];
  formDataParams: NormalizedParameter[];
  requestBodySchemaRef?: string;
  responseSchemaRefs: string[];
  responses: NormalizedResponse[];
  supportsJsonBody: boolean;
  isMultipart: boolean;
  canonicalKey: string;
  resourceFamily: string;
  usageNotes: string[];
};

type NormalizedSchema = {
  name: string;
  type?: string;
  description?: string;
  required: string[];
  properties: Record<
    string,
    {
      type?: string;
      format?: string;
      description?: string;
      enum?: unknown[];
      ref?: string;
      itemsRef?: string;
      itemsType?: string;
      raw?: SwaggerSchema;
    }
  >;
  refs: string[];
  raw?: SwaggerSchema;
};

type NormalizedTag = {
  name: string;
  description?: string;
  operationIds: string[];
};

type NormalizedMap = {
  meta: {
    source: string;
    swaggerVersion: string;
    host?: string;
    basePath?: string;
    schemes: string[];
    defaultConsumes: string[];
    defaultProduces: string[];
    extractedAt: string;
  };
  tags: NormalizedTag[];
  operations: NormalizedOperation[];
  schemas: Record<string, NormalizedSchema>;
};

type LlmChunk = {
  id: string;
  type: "endpoint" | "schema";
  tag?: string;
  title: string;
  text: string;
  method?: string;
  path?: string;
  operationId?: string;
  relatedSchemas: string[];
  keywords: string[];
};

const HTTP_METHODS: HttpMethod[] = [
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "options",
  "head",
];

function main() {
  const inputPath = process.argv[2];
  const outputDir = process.argv[3] ?? "./out";

  if (!inputPath) {
    console.error("Missing input file path.");
    console.error(
      "Usage: bun run build-mc-api-map.ts ./mc-api-swagger.json ./out",
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const doc = JSON.parse(raw) as SwaggerDoc;

  validateSwaggerDoc(doc);

  const normalized = buildNormalizedMap(doc);
  const chunks = buildLlmChunks(normalized);

  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, "mc-normalized-api-map.json"),
    JSON.stringify(normalized, null, 2),
    "utf8",
  );

  fs.writeFileSync(
    path.join(outputDir, "mc-llm-api-chunks.json"),
    JSON.stringify(chunks, null, 2),
    "utf8",
  );

  console.log(`Wrote ${path.join(outputDir, "mc-normalized-api-map.json")}`);
  console.log(`Wrote ${path.join(outputDir, "mc-llm-api-chunks.json")}`);
}

function validateSwaggerDoc(doc: SwaggerDoc) {
  if (!doc || doc.swagger !== "2.0") {
    throw new Error("Expected a Swagger 2.0 document.");
  }
  if (!doc.paths || typeof doc.paths !== "object") {
    throw new Error("Swagger document is missing 'paths'.");
  }
}

function buildNormalizedMap(doc: SwaggerDoc): NormalizedMap {
  const operations: NormalizedOperation[] = [];
  const tagMap = new Map<string, NormalizedTag>();
  const defaultConsumes = doc.consumes ?? [];
  const defaultProduces = doc.produces ?? [];

  for (const [routePath, pathItem] of Object.entries(doc.paths)) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op) continue;

      const normalizedOp = normalizeOperation({
        routePath,
        method,
        operation: op,
        defaultConsumes,
        defaultProduces,
      });

      operations.push(normalizedOp);

      const existingTag = tagMap.get(normalizedOp.tag);
      if (existingTag) {
        existingTag.operationIds.push(normalizedOp.operationId);
      } else {
        tagMap.set(normalizedOp.tag, {
          name: normalizedOp.tag,
          description: doc.tags?.find((t) => t.name === normalizedOp.tag)
            ?.description,
          operationIds: [normalizedOp.operationId],
        });
      }
    }
  }

  const schemas = normalizeSchemas(doc.definitions ?? {});

  const tags = Array.from(tagMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  operations.sort((a, b) => {
    if (a.tag !== b.tag) return a.tag.localeCompare(b.tag);
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.method.localeCompare(b.method);
  });

  return {
    meta: {
      source: "Maintenance Connection Swagger 2.0",
      swaggerVersion: doc.swagger,
      host: doc.host,
      basePath: doc.basePath,
      schemes: doc.schemes ?? [],
      defaultConsumes,
      defaultProduces,
      extractedAt: new Date().toISOString(),
    },
    tags,
    operations,
    schemas,
  };
}

function normalizeOperation(args: {
  routePath: string;
  method: HttpMethod;
  operation: SwaggerOperation;
  defaultConsumes: string[];
  defaultProduces: string[];
}): NormalizedOperation {
  const { routePath, method, operation, defaultConsumes, defaultProduces } =
    args;

  const tag = operation.tags?.[0] ?? "Uncategorized";
  const operationId =
    operation.operationId ?? `${method.toUpperCase()}_${routePath}`;
  const consumes = operation.consumes ?? defaultConsumes;
  const produces = operation.produces ?? defaultProduces;

  const parameters = (operation.parameters ?? []).map(normalizeParameter);

  const pathParams = parameters.filter((p) => p.in === "path");
  const queryParams = parameters.filter((p) => p.in === "query");
  const bodyParams = parameters.filter((p) => p.in === "body");
  const headerParams = parameters.filter((p) => p.in === "header");
  const formDataParams = parameters.filter((p) => p.in === "formData");

  const requestBodySchemaRef = bodyParams.find((p) => p.schemaRef)?.schemaRef;

  const responses = Object.entries(operation.responses ?? {}).map(
    ([statusCode, response]) => ({
      statusCode,
      description: response.description,
      schemaRef: getSchemaRef(response.schema),
      rawSchema: response.schema,
    }),
  );

  const responseSchemaRefs = unique(
    responses.map((r) => r.schemaRef).filter(Boolean) as string[],
  );

  const supportsJsonBody = consumes.some((c) =>
    [
      "application/json",
      "text/json",
      "application/x-www-form-urlencoded",
    ].includes(c),
  );
  const isMultipart = consumes.includes("multipart/form-data");

  const usageNotes: string[] = [];
  if (isMultipart) usageNotes.push("Consumes multipart/form-data");
  if (supportsJsonBody) usageNotes.push("Supports JSON or form-encoded body");
  if (queryParams.some((p) => p.name.startsWith("$"))) {
    usageNotes.push("Supports OData-style query parameters");
  }
  if (pathParams.length > 0) {
    usageNotes.push(
      `Requires path params: ${pathParams.map((p) => p.name).join(", ")}`,
    );
  }

  return {
    operationId,
    tag,
    method: method.toUpperCase(),
    path: routePath,
    summary: operation.summary ?? "",
    description: operation.description,
    consumes,
    produces,
    parameters,
    pathParams,
    queryParams,
    bodyParams,
    headerParams,
    formDataParams,
    requestBodySchemaRef,
    responseSchemaRefs,
    responses,
    supportsJsonBody,
    isMultipart,
    canonicalKey: buildCanonicalKey(tag, method, routePath, operationId),
    resourceFamily: deriveResourceFamily(tag, routePath),
    usageNotes,
  };
}

function normalizeParameter(param: SwaggerParameter): NormalizedParameter {
  return {
    name: param.name,
    in: param.in,
    required: Boolean(param.required),
    description: param.description,
    type: param.type,
    format: param.format,
    schemaRef: getSchemaRef(param.schema),
    itemsRef: getSchemaRef(param.items),
    rawSchema: param.schema,
  };
}

function normalizeSchemas(
  definitions: Record<string, SwaggerSchema>,
): Record<string, NormalizedSchema> {
  const output: Record<string, NormalizedSchema> = {};

  for (const [name, schema] of Object.entries(definitions)) {
    const properties = schema.properties ?? {};
    const normalizedProperties: NormalizedSchema["properties"] = {};
    const refs = new Set<string>();

    for (const [propName, propSchema] of Object.entries(properties)) {
      const ref = getSchemaRef(propSchema);
      const itemsRef = getSchemaRef(propSchema.items);

      if (ref) refs.add(ref);
      if (itemsRef) refs.add(itemsRef);

      normalizedProperties[propName] = {
        type: propSchema.type,
        format: propSchema.format,
        description: propSchema.description,
        enum: propSchema.enum,
        ref,
        itemsRef,
        itemsType: propSchema.items?.type,
        raw: propSchema,
      };
    }

    const deepRefs = collectRefs(schema);
    for (const ref of deepRefs) refs.add(ref);

    output[name] = {
      name,
      type: schema.type,
      description: schema.description,
      required: schema.required ?? [],
      properties: normalizedProperties,
      refs: Array.from(refs).sort(),
      raw: schema,
    };
  }

  return output;
}

function buildLlmChunks(normalized: NormalizedMap): LlmChunk[] {
  const endpointChunks: LlmChunk[] = normalized.operations.map((op) => {
    const relatedSchemas = unique([
      ...op.responseSchemaRefs,
      ...(op.requestBodySchemaRef ? [op.requestBodySchemaRef] : []),
      ...op.parameters.map((p) => p.schemaRef).filter(Boolean),
      ...op.parameters.map((p) => p.itemsRef).filter(Boolean),
    ] as string[]);

    const textParts: string[] = [
      `${op.method} ${op.path}`,
      op.summary || "No summary provided.",
    ];

    if (op.pathParams.length) {
      textParts.push(
        `Path params: ${op.pathParams.map((p) => p.name).join(", ")}.`,
      );
    }
    if (op.queryParams.length) {
      textParts.push(
        `Query params: ${op.queryParams.map((p) => p.name).join(", ")}.`,
      );
    }
    if (op.requestBodySchemaRef) {
      textParts.push(`Request body schema: ${op.requestBodySchemaRef}.`);
    }
    if (op.responseSchemaRefs.length) {
      textParts.push(`Response schemas: ${op.responseSchemaRefs.join(", ")}.`);
    }
    if (op.consumes.length) {
      textParts.push(`Consumes: ${op.consumes.join(", ")}.`);
    }
    if (op.produces.length) {
      textParts.push(`Produces: ${op.produces.join(", ")}.`);
    }
    if (op.usageNotes.length) {
      textParts.push(`Notes: ${op.usageNotes.join("; ")}.`);
    }

    return {
      id: op.operationId,
      type: "endpoint",
      tag: op.tag,
      title: `${op.method} ${op.path}`,
      text: textParts.join(" "),
      method: op.method,
      path: op.path,
      operationId: op.operationId,
      relatedSchemas,
      keywords: unique([
        op.tag,
        op.method.toLowerCase(),
        op.path,
        op.resourceFamily,
        ...tokenizePath(op.path),
        ...relatedSchemas,
      ]),
    };
  });

  const schemaChunks: LlmChunk[] = Object.values(normalized.schemas).map(
    (schema) => {
      const props = Object.entries(schema.properties)
        .slice(0, 20)
        .map(([name, prop]) => {
          if (prop.ref) return `${name}: ref ${prop.ref}`;
          if (prop.itemsRef) return `${name}: array of ${prop.itemsRef}`;
          return `${name}: ${prop.type ?? "unknown"}`;
        });

      const text = [
        `Schema ${schema.name}.`,
        schema.description ?? "",
        schema.required.length
          ? `Required fields: ${schema.required.join(", ")}.`
          : "No required fields listed.",
        props.length
          ? `Properties: ${props.join("; ")}.`
          : "No properties listed.",
        schema.refs.length
          ? `Referenced schemas: ${schema.refs.join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");

      return {
        id: `schema:${schema.name}`,
        type: "schema",
        title: `Schema: ${schema.name}`,
        text,
        relatedSchemas: schema.refs,
        keywords: unique([
          schema.name,
          ...Object.keys(schema.properties),
          ...schema.refs,
        ]),
      };
    },
  );

  return [...endpointChunks, ...schemaChunks];
}

function getSchemaRef(schema?: SwaggerSchema): string | undefined {
  if (!schema?.$ref) return undefined;
  return schema.$ref.replace("#/definitions/", "");
}

function collectRefs(value: unknown, refs = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return refs;

  if (
    "$ref" in (value as Record<string, unknown>) &&
    typeof (value as Record<string, unknown>).$ref === "string"
  ) {
    refs.add(
      String((value as Record<string, unknown>).$ref).replace(
        "#/definitions/",
        "",
      ),
    );
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    collectRefs(nested, refs);
  }

  return refs;
}

function buildCanonicalKey(
  tag: string,
  method: HttpMethod,
  routePath: string,
  operationId: string,
): string {
  const cleanedPath = routePath
    .replace(/\{[^}]+\}/g, ":id")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "")
    .replace(/\//g, ".");

  return `${tag}.${method}.${cleanedPath || operationId}`.toLowerCase();
}

function deriveResourceFamily(tag: string, routePath: string): string {
  const firstSegment = routePath.split("/").filter(Boolean)[0];
  return firstSegment || tag;
}

function tokenizePath(routePath: string): string[] {
  return routePath
    .split("/")
    .filter(Boolean)
    .flatMap((segment) =>
      segment
        .replace(/[{}]/g, "")
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean),
    )
    .map((s) => s.toLowerCase());
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

main();
