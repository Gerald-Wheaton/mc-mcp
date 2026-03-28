import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function register(server: McpServer): void {
  server.registerPrompt(
    'mc_pm_compliance_review',
    {
      title: 'PM compliance review',
      description:
        'Review PM work order status to understand whether scheduled preventive maintenance is being completed on time or falling behind.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

Give me a PM compliance review — how well is scheduled preventive maintenance being completed?

Step 1: Fetch all PM-type work orders ($filter=Type eq "PM"), capturing Status and DateOpened for each. Tally by status: ISSUED, CLOSED, REQUESTED, CANCELED.

Step 2: Among open PMs (Status eq "ISSUED"), fetch the oldest ones ($orderby=DateOpened asc, $top=10). How long have they been open? Long-open PMs may signal overdue work.

Step 3: Among recently closed PMs (Status eq "CLOSED", $orderby=DateOpened desc, $top=20), what assets were maintained?

Summarize:
- Total PM work orders and status breakdown (as percentages)
- How many PMs are currently open, and how old is the oldest?
- Any patterns in which assets generate the most PMs?
- Plain-language compliance assessment: is PM work staying current or building up a backlog?`,
          },
        },
      ],
    }),
  )

  server.registerPrompt(
    'mc_inspection_summary',
    {
      title: 'Inspection summary',
      description:
        'Summarize open and recent inspection work orders to understand the state of scheduled inspections.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

Give me a summary of inspection work orders (Type eq "IN").

Step 1: Fetch all open inspections:
  $filter=Type eq "IN" and IsOpen eq true
  $orderby=Priority asc

Step 2: Fetch recently closed inspections:
  $filter=Type eq "IN" and Status eq "CLOSED"
  $orderby=DateOpened desc
  $top=20

For open inspections, summarize:
- Total count and priority breakdown
- How many are unassigned (IsAssigned eq false)?
- Which assets appear most frequently?
- Oldest open inspections (by DateOpened) — flag anything open more than 30 days

For recently closed, summarize:
- Count closed recently and which assets were inspected

Close with a plain-language assessment: are inspections being kept current, or is there a backlog building?`,
          },
        },
      ],
    }),
  )
}
