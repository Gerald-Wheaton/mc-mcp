import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

interface RepairCenterArgs {
  repair_center_id?: string
  repair_center_name?: string
}

interface VendorArgs extends RepairCenterArgs {
  vendor_name?: string
}

const repairCenterArgsSchema = {
  repair_center_id: z
    .string()
    .optional()
    .describe('Exact repair center ID to scope the analysis to, such as M.'),
  repair_center_name: z
    .string()
    .optional()
    .describe('Exact repair center name to resolve case-insensitively before scoping the analysis.'),
}

const vendorNameArgSchema = {
  vendor_name: z
    .string()
    .optional()
    .describe('Vendor name or partial name to resolve before focusing the analysis on one vendor.'),
}

export function register(server: McpServer): void {
  server.registerPrompt(
    'mc_open_purchase_orders',
    {
      title: 'Open purchase orders',
      description:
        'Review all open purchase orders — what is outstanding, who are the vendors, and what is the total spend committed.',
      argsSchema: {
        ...repairCenterArgsSchema,
        ...vendorNameArgSchema,
      },
    },
    (args: VendorArgs) => {
      const vendorName = cleanArg(args.vendor_name)

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                'You are a maintenance operations assistant with access to live Maintenance Connection data.',
                buildContextInstructions([
                  'Read mc://context/time before querying tools so relative dates are anchored correctly.',
                  'Read mc://context/lookup-tables when you need lookup-backed labels or codes during the analysis.',
                ]),
                buildRepairCenterInstructions(args),
                buildVendorResolutionInstructions(vendorName),
                vendorName
                  ? `Give me a summary of open purchase orders for the resolved vendor matching "${vendorName}".

Step 1: Resolve the vendor first from live purchase-order data. If multiple vendors plausibly match, stop and ask the user to clarify which vendor they mean.

Step 2: Fetch open purchase orders for that resolved vendor. Use the vendor information available in returned data and do not invent unsupported vendor filter paths.

Summarize:
- Total number of open POs and combined dollar value for this vendor
- Breakdown by status (ISSUED vs REQUESTED)
- Whether parts are already ordered or still pending
- Oldest open POs by OrderDate

Close with a plain-language summary of whether purchasing with this vendor appears healthy or stalled.`
                  : `Give me a summary of all open purchase orders.

Step 1: Fetch all open POs:
  $filter=IsOpen eq true
  $orderby=OrderDate asc

For each PO capture: ID, Description, VendorRef (name), Total, OrderDate, Status, IsPartsOrdered, InvoiceNumber.

Step 2: Summarize:
- Total number of open POs and combined dollar value (sum of Total)
- Breakdown by status (ISSUED vs REQUESTED)
- Which vendors have the most open POs?
- How many POs have parts already ordered (IsPartsOrdered eq true) vs not yet ordered?
- Oldest open POs by OrderDate — flag any that have been open unusually long

Close with a plain-language summary of the procurement pipeline: is purchasing moving smoothly, or are there stalled orders that need follow-up?`,
              ]
                .filter(Boolean)
                .join('\n\n'),
            },
          },
        ],
      }
    },
  )

  server.registerPrompt(
    'mc_vendor_performance',
    {
      title: 'Vendor performance',
      description:
        'Analyze purchase orders by vendor to understand spend distribution, order frequency, and order status across suppliers.',
      argsSchema: {
        ...repairCenterArgsSchema,
        ...vendorNameArgSchema,
      },
    },
    (args: VendorArgs) => {
      const vendorName = cleanArg(args.vendor_name)

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                'You are a maintenance operations assistant with access to live Maintenance Connection data.',
                buildContextInstructions([
                  'Read mc://context/time before querying tools so relative dates are anchored correctly.',
                  'Read mc://context/lookup-tables when you need lookup-backed labels or codes during the analysis.',
                ]),
                buildRepairCenterInstructions(args),
                buildVendorResolutionInstructions(vendorName),
                vendorName
                  ? `I want to understand the performance of the resolved vendor matching "${vendorName}" through the lens of purchase order data.

Step 1: Resolve the vendor first from live purchase-order data. If multiple vendors plausibly match, stop and ask the user to clarify which vendor they mean.

Step 2: Fetch purchase orders for that vendor across statuses. Use the vendor information available in returned data and do not invent unsupported vendor filter paths.

Summarize:
- Number of POs (total, open, closed, canceled)
- Total spend and average PO value
- How many POs have parts ordered vs not
- Whether there are any canceled POs or other concerning patterns

Close with a plain-language assessment of whether this vendor looks reliable and significant, or whether there are warning signs.`
                  : `I want to understand vendor performance through the lens of purchase order data.

Step 1: Fetch all POs (no status filter, to get the full picture):
  $top=200
Capture VendorRef (name and PK), Total, Status, OrderDate, IsPartsOrdered for each.

Step 2: Group by vendor. For each vendor calculate:
- Number of POs (total, open, closed, canceled)
- Total spend (sum of Total across all POs)
- Average PO value
- How many POs have parts ordered vs not

Step 3: Rank vendors by total spend (highest first). Present the top 10 vendors with their metrics.

Step 4: Flag any vendors with canceled POs — these may signal fulfillment issues.

Close with a plain-language summary: which vendors are the primary suppliers, is spend concentrated or distributed, and are there any vendors with concerning patterns?`,
              ]
                .filter(Boolean)
                .join('\n\n'),
            },
          },
        ],
      }
    },
  )

  server.registerPrompt(
    'mc_po_approval_pipeline',
    {
      title: 'PO approval pipeline',
      description:
        'Show purchase orders in REQUESTED status that are awaiting approval or action before becoming active orders.',
      argsSchema: {
        ...repairCenterArgsSchema,
      },
    },
    (args: RepairCenterArgs) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are a maintenance operations assistant with access to live Maintenance Connection data.',
              buildContextInstructions([
                'Read mc://context/time before querying tools so relative dates are anchored correctly.',
                'Read mc://context/lookup-tables when you need lookup-backed labels or codes during the analysis.',
              ]),
              buildRepairCenterInstructions(args),
              `Show me all purchase orders currently in the approval pipeline — status REQUESTED, meaning they have been created but not yet issued/approved.

Step 1: Fetch all REQUESTED POs:
  $filter=Status eq "REQUESTED"
  $orderby=OrderDate asc

For each PO capture: ID, Description, VendorRef (name), Total, OrderDate, and whether parts are already flagged as ordered (IsPartsOrdered).

Step 2: Fetch line items for the top 5 largest REQUESTED POs (by Total) using mc_list_po_line_items with $filter=PurchaseOrderPK eq {pk}. Summarize what is being ordered.

Summarize:
- How many POs are awaiting approval and their combined value?
- Which vendors are involved?
- How old are the oldest REQUESTED POs (by OrderDate)? Flag anything over 14 days old.
- What are the biggest pending orders about (from line item detail)?

Close with a plain-language assessment: is the approval queue healthy or are there orders stalled and waiting?`,
            ]
              .filter(Boolean)
              .join('\n\n'),
          },
        },
      ],
    }),
  )
}

function cleanArg(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function buildContextInstructions(lines: string[]): string {
  return `Before querying tools:
${lines.map((line) => `- ${line}`).join('\n')}`
}

function buildRepairCenterInstructions(args: RepairCenterArgs): string | undefined {
  const repairCenterId = cleanArg(args.repair_center_id)
  const repairCenterName = cleanArg(args.repair_center_name)

  if (repairCenterId && repairCenterName) {
    throw new Error(
      'Provide only one repair center input. Use either repair_center_id or repair_center_name.',
    )
  }

  if (repairCenterId) {
    return `Scope all relevant purchase-order queries to repair center ID "${repairCenterId}" using the filter RepairCenterID eq "${repairCenterId}". Do not use RepairCenterRef navigation paths in filters.`
  }

  if (repairCenterName) {
    return `Resolve the repair center before the main analysis:
- Fetch a small sample of work orders or assets that include RepairCenterRef values.
- Build a distinct list of repair centers using each record's RepairCenterRef.ID and RepairCenterRef.Name.
- Compare names after trimming whitespace and converting to lowercase.
- If zero exact matches are found for "${repairCenterName}", stop and say the repair center name could not be resolved.
- If more than one exact match is found for "${repairCenterName}", stop and say duplicate repair centers were found and the request is ambiguous.
- Once exactly one repair center is resolved, use its ID and scope all subsequent purchase-order queries with RepairCenterID eq "{resolvedID}".
- Do not use RepairCenterRef/PK or RepairCenterRef/ID navigation filters.`
  }

  return undefined
}

function buildVendorResolutionInstructions(vendorName?: string): string | undefined {
  if (!vendorName) {
    return undefined
  }

  return `Resolve the target vendor before the main analysis:
- Use live purchase-order data to find vendors whose names match "${vendorName}".
- Prefer an exact match when one exists.
- If multiple vendors plausibly match, stop and ask the user to clarify which vendor they want.
- Once one vendor is resolved, use that vendor's exact name and identifiers from returned data to keep the rest of the analysis focused on it.`
}
