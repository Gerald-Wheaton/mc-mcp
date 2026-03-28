import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function register(server: McpServer): void {
  server.registerPrompt(
    'mc_daily_maintenance_review',
    {
      title: 'Daily maintenance review',
      description:
        "Get a summary of today's maintenance activity — open high-priority work orders, recently completed work, and anything that needs immediate attention.",
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

Give me a daily maintenance review. Cover the following:

1. **Emergency and high-priority open work orders** — fetch open work orders with priority 0 ("Emergency / Immediate Response"). List each one with its ID, reason/description, asset, and how long it has been open (use DateOpened).

2. **Unassigned open work orders** — fetch open work orders that are not yet assigned (IsAssigned eq false). How many are there? Break them down by type (CM, PM, IN, SR, etc.).

3. **Recently closed work orders** — fetch work orders with Status eq "CLOSED". How many were closed? Any notable patterns (type mix, assets involved)?

4. **Follow-up work orders** — fetch any open work orders of type FO (follow-up). These signal unresolved issues that needed a second pass.

Summarize your findings in plain language a maintenance manager would understand. Flag anything that looks urgent or out of the ordinary.`,
          },
        },
      ],
    }),
  )

  server.registerPrompt(
    'mc_open_work_order_backlog',
    {
      title: 'Open work order backlog',
      description:
        'Analyze the full backlog of open work orders by type and priority to understand where effort is concentrated.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

Pull the full open work order backlog and analyze it. Walk through each work order type using $filter=IsOpen eq true, fetching each type separately if needed (CM, PM, IN, SR, CAP, ADMN, FO, PC).

For each type present in the data:
- How many open work orders exist?
- What is the priority distribution (0=Emergency, 2=Normal, 3=Low)?
- How many are unassigned (IsAssigned eq false)?
- Are any overdue or notably old based on DateOpened?

After the per-type breakdown, give me a one-paragraph executive summary: where is the backlog concentrated, and what should the team focus on first?`,
          },
        },
      ],
    }),
  )

  server.registerPrompt(
    'mc_unassigned_work_orders',
    {
      title: 'Unassigned work orders',
      description:
        'Show all open work orders that have not been assigned to a technician, sorted by priority.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

Fetch all open, unassigned work orders using:
  $filter=IsOpen eq true and IsAssigned eq false
  $orderby=Priority asc

List each work order with:
- ID and reason/description
- Type (CM, PM, IN, SR, etc.)
- Priority (0=Emergency, 2=Normal, 3=Low)
- Asset name and location (if available)
- Date opened

Group the results by priority. For any Priority 0 items, call them out explicitly at the top of your response — these require immediate attention.

Finish with a count summary: how many unassigned WOs by type and priority.`,
          },
        },
      ],
    }),
  )

  server.registerPrompt(
    'mc_emergency_work_orders',
    {
      title: 'Emergency work orders',
      description:
        'Surface all open emergency (Priority 0) work orders that require immediate response.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

Fetch all open work orders at Priority 0 (Emergency / Immediate Response) using:
  $filter=IsOpen eq true and Priority eq 0

For each one, tell me:
- Work order ID and reason/description
- Type (CM, IN, SR, etc.)
- Asset involved (name, ID, location if available)
- Date opened — how many days has this been open?
- Whether it is assigned (IsAssigned) and to whom if that field is populated

If there are no open emergency work orders, say so clearly — that is a good sign worth noting.

Close with a plain-language assessment: is the emergency situation under control, or are there items that have been sitting open too long?`,
          },
        },
      ],
    }),
  )
}
