import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { toToolText } from '@/shared/response.js'

const DATASETS = [
  {
    name: 'Work Orders',
    description:
      'Maintenance tasks of all types. Each record includes TypeDetails.Value to distinguish types: CM (Corrective Maintenance), PM (Preventive Maintenance), SR (Service Request / Work Request), PC (Part Checkout).',
    tools: ['mc_list_work_orders', 'mc_get_work_order'],
    usableFilters: ['IsOpen eq true', 'IsAssigned eq false', 'IsApproved eq true', 'Type eq "CM"', 'Type eq "PM"', 'Type eq "SR"'],
    note: 'String filters require double quotes: Type eq "CM", not single quotes.',
  },
  {
    name: 'Assets',
    description:
      'Equipment, facilities, and locations in a hierarchical tree. AssetLevel indicates depth (1=root, 2=campus, deeper=buildings/equipment). IsLocation=true means a location node, not physical equipment. TypeDetails.Value="L" means Location.',
    tools: ['mc_list_assets', 'mc_get_asset'],
    usableFilters: ['IsLocation eq false', 'IsUp eq true'],
  },
  {
    name: 'Parts',
    description: 'Inventory items and parts catalog.',
    tools: ['mc_list_parts', 'mc_get_part'],
    usableFilters: ['Active eq true', 'Hazardous eq true', 'DirectIssue eq true', 'ID eq "12528812"'],
  },
  {
    name: 'Purchase Orders',
    description: 'Procurement records with line items, receipts, and invoice status.',
    tools: ['mc_list_purchase_orders', 'mc_get_purchase_order'],
    usableFilters: ['IsOpen eq true', 'IsApproved eq true', 'StatusDetails/Value eq "ISSUED"'],
  },
]

export function register(server: McpServer): void {
  server.registerTool(
    'mc_list_datasets',
    {
      description:
        'List all available Maintenance Connection data sets and the tools used to query them. Call this first to orient yourself before deciding which tool to use.',
    },
    async () => toToolText(DATASETS),
  )
}
