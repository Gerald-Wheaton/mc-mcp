import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McClient } from '@/mc-client.js'
import { DATASETS, DATASETS_TRANSITION_NOTE } from '@/shared/datasets.js'

const JSON_MIME_TYPE = 'application/json'
const TIME_RESOURCE_URI = 'mc://context/time'
const DATASETS_RESOURCE_URI = 'mc://context/datasets'

export function register(server: McpServer, _client: McClient): void {
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
