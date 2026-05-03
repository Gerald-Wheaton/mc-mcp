export const DATASETS = [
  {
    name: 'Work Orders',
    description:
      'Reactive, preventive, inspection, follow-up, and other maintenance tasks tracked in the system.',
    tools: ['mc_list_work_orders', 'mc_get_work_order'],
    bestFor: [
      'Open backlog and daily operations reviews',
      'Unassigned or emergency work',
      'Corrective vs preventive workload comparisons',
      'Work tied to a specific asset or repair center',
    ],
    notes: ['PM-linked work orders usually carry a preventive-maintenance reference back to the source plan.'],
  },
  {
    name: 'Assets',
    description:
      'Equipment, facilities, and location nodes arranged in a hierarchy.',
    tools: ['mc_list_assets', 'mc_get_asset'],
    bestFor: [
      'Equipment health and repeat-maintenance analysis',
      'Facility hierarchy orientation',
      'Separating physical equipment from structural location records',
    ],
    notes: ['The asset list mixes real equipment with location nodes such as campuses, buildings, and floors.'],
  },
  {
    name: 'Parts',
    description: 'Part master records and catalog details for inventory items.',
    tools: ['mc_list_parts', 'mc_get_part'],
    bestFor: [
      'Catalog cleanup and requester-availability reviews',
      'Slow-moving parts analysis',
      'Reserved-parts audits after work orders identify which parts are tied up',
    ],
    notes: ['This dataset is best for catalog data, not by-location stock balances or on-hand quantities.'],
  },
  {
    name: 'Purchase Orders',
    description: 'Procurement records covering open commitments, vendor activity, and approval flow.',
    tools: ['mc_list_purchase_orders', 'mc_get_purchase_order'],
    bestFor: [
      'Open purchasing pipeline reviews',
      'Vendor performance summaries',
      'Approval-queue and ordered-vs-pending analysis',
    ],
    notes: ['Use the PO line-items tool when you need to see what was ordered on a specific purchase order.'],
  },
] as const
