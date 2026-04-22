import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McApiError, type McClient } from '@/mc-client.js'
import { DATASETS, DATASETS_TRANSITION_NOTE } from '@/shared/datasets.js'
import { AssetSummarySchema, EntityRefSchema, McApiResponseSchema } from '@/shared/types.js'

const JSON_MIME_TYPE = 'application/json'
const TIME_RESOURCE_URI = 'mc://context/time'
const DATASETS_RESOURCE_URI = 'mc://context/datasets'
const SUMMARY_RESOURCE_URI = 'mc://context/summary'
const LABORS_RESOURCE_URI = 'mc://context/labors'
const ASSET_LOCATIONS_RESOURCE_URI = 'mc://context/asset-locations'
const LOOKUP_TABLES_RESOURCE_URI = 'mc://context/lookup-tables'
const SUMMARY_TTL_MS = 60 * 60 * 1000
const SLOW_CONTEXT_TTL_MS = 12 * 60 * 60 * 1000

const CountResponseSchema = McApiResponseSchema(z.unknown())
const LaborContextSchema = z.object({
  PK: z.number(),
  ID: z.string(),
  Name: z.string(),
  Active: z.boolean().optional(),
  Initials: z.string().nullable().optional(),
  RepairCenterRef: EntityRefSchema.nullable().optional(),
  ShopRef: EntityRefSchema.nullable().optional(),
})
const LaborListSchema = McApiResponseSchema(LaborContextSchema)
const AssetListSchema = McApiResponseSchema(AssetSummarySchema)
const LookupTableContextSchema = z.object({
  LookupTableID: z.string(),
  Description: z.string().nullable().optional(),
  CodeWidth: z.number().nullable().optional(),
  DescriptionWidth: z.number().nullable().optional(),
  Internal: z.boolean().optional(),
  Enabled: z.boolean().optional(),
  SkipValidation: z.boolean().optional(),
  CanModify: z.boolean().optional(),
  NoCascadeUpdate: z.boolean().optional(),
  LastModifiedDate: z.string().nullable().optional(),
})
const LookupTableValueContextSchema = z.object({
  LookupTableID: z.string(),
  CodeName: z.string(),
  CodeDesc: z.string().nullable().optional(),
  CodeValue: z.number().nullable().optional(),
  SystemCode: z.boolean().optional(),
  AvailableToRequester: z.boolean().optional(),
  LastModifiedDate: z.string().nullable().optional(),
})
const LookupTableListSchema = McApiResponseSchema(LookupTableContextSchema)
const LookupTableValueListSchema = McApiResponseSchema(LookupTableValueContextSchema)

export function register(server: McpServer, client: McClient): void {
  server.registerResource(
    'mc-context-time',
    TIME_RESOURCE_URI,
    {
      title: 'MC Context: Time',
      description: 'Live time context for date-aware Maintenance Connection analysis.',
      mimeType: JSON_MIME_TYPE,
    },
    async () => toJsonResource(TIME_RESOURCE_URI, buildTimeContext()),
  )

  server.registerResource(
    'mc-context-datasets',
    DATASETS_RESOURCE_URI,
    {
      title: 'MC Context: Datasets',
      description:
        'Static dataset orientation resource. Prefer this resource over mc_list_datasets when the MCP client supports resources.',
      mimeType: JSON_MIME_TYPE,
    },
    async () =>
      toJsonResource(DATASETS_RESOURCE_URI, {
        preferredInterface: DATASETS_RESOURCE_URI,
        compatibilityTool: 'mc_list_datasets',
        transitionNote: DATASETS_TRANSITION_NOTE,
        datasets: DATASETS,
      }),
  )

  server.registerResource(
    'mc-context-summary',
    SUMMARY_RESOURCE_URI,
    {
      title: 'MC Context: Summary',
      description: 'Session-tier summary counts for the major MC entities exposed by this server.',
      mimeType: JSON_MIME_TYPE,
    },
    async () => readResource(SUMMARY_RESOURCE_URI, () => readSummaryContext(client)),
  )

  server.registerResource(
    'mc-context-labors',
    LABORS_RESOURCE_URI,
    {
      title: 'MC Context: Labors',
      description: 'Cached labor roster for resolving assignee and technician references.',
      mimeType: JSON_MIME_TYPE,
    },
    async () => readResource(LABORS_RESOURCE_URI, () => readLaborContext(client)),
  )

  server.registerResource(
    'mc-context-asset-locations',
    ASSET_LOCATIONS_RESOURCE_URI,
    {
      title: 'MC Context: Asset Locations',
      description: 'Cached location-only asset hierarchy context for translating parent/location references.',
      mimeType: JSON_MIME_TYPE,
    },
    async () => readResource(ASSET_LOCATIONS_RESOURCE_URI, () => readAssetLocationContext(client)),
  )

  server.registerResource(
    'mc-context-lookup-tables',
    LOOKUP_TABLES_RESOURCE_URI,
    {
      title: 'MC Context: Lookup Tables',
      description: 'Cached lookup table metadata and values for customer-configured dropdowns and codes.',
      mimeType: JSON_MIME_TYPE,
    },
    async () => readResource(LOOKUP_TABLES_RESOURCE_URI, () => readLookupTablesContext(client)),
  )
}

function toJsonResource(uri: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: JSON_MIME_TYPE,
        text: JSON.stringify(data, null, 2),
      },
    ],
  }
}

async function readResource(uri: string, loader: () => Promise<unknown>) {
  try {
    return toJsonResource(uri, await loader())
  } catch (err) {
    throw new Error(formatResourceError(err))
  }
}

function buildTimeContext() {
  const now = new Date()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const zonedNow = new Date(now.toLocaleString('en-US', { timeZone }))

  return {
    generatedAt: now.toISOString(),
    timezone: timeZone,
    today: formatDateInTimeZone(zonedNow, timeZone),
    yesterday: formatDateInTimeZone(addDays(zonedNow, -1), timeZone),
    tomorrow: formatDateInTimeZone(addDays(zonedNow, 1), timeZone),
    daysAgo: {
      days7: formatDateInTimeZone(addDays(zonedNow, -7), timeZone),
      days30: formatDateInTimeZone(addDays(zonedNow, -30), timeZone),
      days90: formatDateInTimeZone(addDays(zonedNow, -90), timeZone),
      days365: formatDateInTimeZone(addDays(zonedNow, -365), timeZone),
    },
    anchors: {
      startOfWeek: formatDateInTimeZone(startOfWeek(zonedNow), timeZone),
      startOfMonth: formatDateInTimeZone(startOfMonth(zonedNow), timeZone),
    },
  }
}

async function readSummaryContext(client: McClient) {
  return client.getCached('context:summary', SUMMARY_TTL_MS, async () => {
    const [
      workOrders,
      assets,
      locationAssets,
      equipmentAssets,
      parts,
      purchaseOrders,
      purchaseOrderLineItems,
    ] = await Promise.all([
      countRecords(client, '/workorders'),
      countRecords(client, '/Assets'),
      countRecords(client, '/Assets', 'IsLocation eq true'),
      countRecords(client, '/Assets', 'IsLocation eq false'),
      countRecords(client, '/Parts'),
      countRecords(client, '/purchaseorders'),
      countRecords(client, '/PurchaseOrderLineItems'),
    ])

    return {
      generatedAt: new Date().toISOString(),
      cacheTtlMs: SUMMARY_TTL_MS,
      counts: {
        workOrders,
        assets: {
          total: assets,
          locations: locationAssets,
          equipment: equipmentAssets,
        },
        parts,
        purchaseOrders,
        purchaseOrderLineItems,
      },
    }
  })
}

async function readLaborContext(client: McClient) {
  return client.getCached('context:labors', SLOW_CONTEXT_TTL_MS, async () => {
    const raw = await client.getAllPages<z.infer<typeof LaborContextSchema>>('/Labors', {
      params: {
        $orderby: 'Name asc',
      },
    })
    const data = LaborListSchema.parse(raw)
    const labors = data.Results.map((labor) => ({
      PK: labor.PK,
      ID: labor.ID,
      Name: labor.Name,
      Active: labor.Active ?? true,
      Initials: labor.Initials ?? null,
      RepairCenterRef: labor.RepairCenterRef ?? null,
      ShopRef: labor.ShopRef ?? null,
    }))

    return {
      generatedAt: new Date().toISOString(),
      cacheTtlMs: SLOW_CONTEXT_TTL_MS,
      total: data.Total,
      activeCount: labors.filter((labor) => labor.Active).length,
      inactiveCount: labors.filter((labor) => !labor.Active).length,
      labors,
    }
  })
}

async function readAssetLocationContext(client: McClient) {
  return client.getCached('context:asset-locations', SLOW_CONTEXT_TTL_MS, async () => {
    const raw = await client.getAllPages<z.infer<typeof AssetSummarySchema>>('/Assets', {
      params: {
        $filter: 'IsLocation eq true',
        $orderby: 'Name asc',
      },
    })
    const data = AssetListSchema.parse(raw)
    const locations = data.Results.map((asset) => ({
      PK: asset.PK,
      ID: asset.ID,
      Name: asset.Name,
      IsLocation: asset.IsLocation ?? true,
      AssetLevel: asset.AssetLevel ?? null,
      ParentRef: asset.ParentRef ?? null,
    }))
    const levels = new Map<number, number>()

    for (const location of locations) {
      if (location.AssetLevel !== null) {
        levels.set(location.AssetLevel, (levels.get(location.AssetLevel) ?? 0) + 1)
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      cacheTtlMs: SLOW_CONTEXT_TTL_MS,
      total: data.Total,
      assetLevels: Array.from(levels.entries())
        .sort(([left], [right]) => left - right)
        .map(([assetLevel, count]) => ({ assetLevel, count })),
      locations,
    }
  })
}

async function readLookupTablesContext(client: McClient) {
  return client.getCached('context:lookup-tables', SLOW_CONTEXT_TTL_MS, async () => {
    const [rawTables, rawValues] = await Promise.all([
      client.getAllPages<z.infer<typeof LookupTableContextSchema>>('/LookupTables', {
        params: {
          $orderby: 'LookupTableID asc',
        },
      }),
      client.getAllPages<z.infer<typeof LookupTableValueContextSchema>>('/LookupTableValues', {
        params: {
          $orderby: 'LookupTableID asc, CodeName asc',
        },
      }),
    ])

    const tables = LookupTableListSchema.parse(rawTables)
    const values = LookupTableValueListSchema.parse(rawValues)
    const valuesByTable = new Map<string, z.infer<typeof LookupTableValueContextSchema>[]>()

    for (const value of values.Results) {
      const existing = valuesByTable.get(value.LookupTableID)
      if (existing) {
        existing.push(value)
      } else {
        valuesByTable.set(value.LookupTableID, [value])
      }
    }

    const normalizedTables = tables.Results.map((table) => {
      const tableValues = (valuesByTable.get(table.LookupTableID) ?? [])
        .slice()
        .sort((left, right) => left.CodeName.localeCompare(right.CodeName))
        .map((value) => ({
          codeName: value.CodeName,
          description: value.CodeDesc ?? null,
          numericValue: value.CodeValue ?? null,
          systemCode: value.SystemCode ?? false,
          availableToRequester: value.AvailableToRequester ?? false,
          lastModifiedDate: value.LastModifiedDate ?? null,
        }))

      return {
        lookupTableID: table.LookupTableID,
        description: table.Description ?? null,
        enabled: table.Enabled ?? true,
        internal: table.Internal ?? false,
        canModify: table.CanModify ?? false,
        skipValidation: table.SkipValidation ?? false,
        noCascadeUpdate: table.NoCascadeUpdate ?? false,
        codeWidth: table.CodeWidth ?? null,
        descriptionWidth: table.DescriptionWidth ?? null,
        lastModifiedDate: table.LastModifiedDate ?? null,
        valueCount: tableValues.length,
        values: tableValues,
      }
    })

    return {
      generatedAt: new Date().toISOString(),
      cacheTtlMs: SLOW_CONTEXT_TTL_MS,
      totalTables: normalizedTables.length,
      totalValues: normalizedTables.reduce((sum, table) => sum + table.valueCount, 0),
      enabledTables: normalizedTables.filter((table) => table.enabled).length,
      internalTables: normalizedTables.filter((table) => table.internal).length,
      tables: normalizedTables,
    }
  })
}

async function countRecords(client: McClient, path: string, filter?: string): Promise<number> {
  const raw = await client.get(path, {
    params: {
      $top: 1,
      ...(filter ? { $filter: filter } : {}),
    },
  })
  const data = CountResponseSchema.parse(raw)
  return data.Total
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
  const month = parts.find((part) => part.type === 'month')?.value ?? '00'
  const day = parts.find((part) => part.type === 'day')?.value ?? '00'

  return `${year}-${month}-${day}`
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfWeek(date: Date): Date {
  const next = new Date(date)
  const dayOfWeek = next.getDay()
  const distanceFromMonday = (dayOfWeek + 6) % 7
  next.setDate(next.getDate() - distanceFromMonday)
  return next
}

function startOfMonth(date: Date): Date {
  const next = new Date(date)
  next.setDate(1)
  return next
}

function formatResourceError(err: unknown): string {
  if (err instanceof McApiError) {
    return `MC API error ${err.status}: ${err.body || err.message}`
  }

  if (err instanceof Error) {
    return err.message
  }

  return String(err)
}
