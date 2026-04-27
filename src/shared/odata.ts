import { z } from 'zod'

/**
 * Shared OData query parameter shape. Spread into every list tool's input schema:
 *   server.tool('mc_list_X', 'desc', { ...odataShape, ...toolSpecificParams }, handler)
 */
export const odataShape = {
  $filter: z
    .string()
    .optional()
    .describe(
      'Filter records by field values. IMPORTANT: string values must use double quotes, not single quotes (MC API requirement). The tool description lists supported filter fields and their valid values.',
    ),
  $orderby: z.string().optional().describe('Sort results. Specify a field name followed by asc or desc, for example: TargetDate desc.'),
  $top: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe('Max records to return (1–500). Defaults to server page size.'),
  $skip: z.number().int().nonnegative().optional().describe('Number of records to skip for pagination. Use with $top.'),
  $fetchAll: z
    .boolean()
    .optional()
    .describe(
      'Fetch all pages automatically, up to 2000 records. ' +
      'Use on Work Orders (≈645), Parts (≈3305), and POs (≈74). ' +
      'Do NOT use on Assets (33k+) without a $filter that substantially reduces the set.',
    ),
} as const

export const FETCH_ALL_CAP = 2000

export type ODataParams = {
  $filter?: string
  $orderby?: string
  $top?: number
  $skip?: number
  $fetchAll?: boolean
}
