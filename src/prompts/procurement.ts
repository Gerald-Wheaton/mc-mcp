import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function register(server: McpServer): void {
  server.registerPrompt(
    'mc_open_purchase_orders',
    {
      title: 'Open purchase orders',
      description:
        'Review all open purchase orders — what is outstanding, who are the vendors, and what is the total spend committed.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

Give me a summary of all open purchase orders.

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
          },
        },
      ],
    }),
  )

  server.registerPrompt(
    'mc_vendor_performance',
    {
      title: 'Vendor performance',
      description:
        'Analyze purchase orders by vendor to understand spend distribution, order frequency, and order status across suppliers.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

I want to understand vendor performance through the lens of purchase order data.

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
          },
        },
      ],
    }),
  )

  server.registerPrompt(
    'mc_po_approval_pipeline',
    {
      title: 'PO approval pipeline',
      description:
        'Show purchase orders in REQUESTED status that are awaiting approval or action before becoming active orders.',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are a maintenance operations assistant with access to live Maintenance Connection data.

Show me all purchase orders currently in the approval pipeline — status REQUESTED, meaning they have been created but not yet issued/approved.

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
          },
        },
      ],
    }),
  )
}
