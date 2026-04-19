import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McApiError, type McClient } from '@/mc-client.js'
import { DATASETS, DATASETS_TRANSITION_NOTE } from '@/shared/datasets.js'
import { McApiResponseSchema } from '@/shared/types.js'

const JSON_MIME_TYPE = 'application/json'
const TIME_RESOURCE_URI = 'mc://context/time'
const DATASETS_RESOURCE_URI = 'mc://context/datasets'
const SUMMARY_RESOURCE_URI = 'mc://context/summary'
const SUMMARY_TTL_MS = 60 * 60 * 1000

const CountResponseSchema = McApiResponseSchema(z.unknown())

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
