import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function register(server: McpServer): void {
  server.registerPrompt(
    'mc_asset_health_check',
    {
      title: 'Asset health check',
      description:
        'Identify which equipment assets have the most active open work orders — a proxy for assets under stress or nearing failure.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

I want to understand which equipment assets are generating the most maintenance activity right now.

Step 1: Fetch open corrective maintenance work orders (Type eq "CM" and IsOpen eq true). Collect the AssetRef (PK and Name) from each record.

Step 2: Tally open CM work orders per asset. Which assets appear most frequently?

Step 3: For the top 5 assets by open CM count, fetch the full asset record using mc_get_asset to get additional context: IsUp (is the asset currently operational?), LastMaintained, AssetLevel, ClassificationRef, and ParentRef (location).

Present a ranked list of the top assets by open CM work order count. For each asset, include:
- Asset name and ID
- Number of open CMs
- Is the asset currently up (IsUp)?
- Last maintained date
- Location / parent asset

Close with a plain-language assessment: which assets look like they may need proactive attention or investigation?`,
          },
        },
      ],
    }),
  )

  server.registerPrompt(
    'mc_location_equipment_breakdown',
    {
      title: 'Location & equipment breakdown',
      description:
        'Summarize the asset hierarchy — how many location nodes vs equipment records exist, and what does the top of the tree look like.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

Help me understand the shape of the asset hierarchy in this system.

Step 1: Fetch assets at the top of the hierarchy (AssetLevel eq 1 and AssetLevel eq 2) — these are the root and campus/site-level nodes. List their names and IDs.

Step 2: Fetch a sample of equipment assets (IsLocation eq false, $top=20) to show what the leaf-level records look like — include Name, ID, ClassificationRef, and ParentRef.

Step 3: Fetch a count of location-only assets ($filter=IsLocation eq true, use $top=1 and inspect Total in the response) vs equipment assets ($filter=IsLocation eq false).

Summarize:
- How many total assets are in the system (locations + equipment combined)?
- How many are pure location/structural nodes vs actual equipment?
- What does the top of the tree look like (site/campus names)?
- What types of equipment are represented in the sample?

This gives a quick orientation to the facility structure for someone new to this account.`,
          },
        },
      ],
    }),
  )
}
