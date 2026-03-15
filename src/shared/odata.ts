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
      "OData filter expression. Examples: \"Status eq 'Open'\", \"AssetPK eq 12345\", \"TargetDate gt '2024-01-01'\"",
    ),
  $orderby: z
    .string()
    .optional()
    .describe("OData sort expression. Example: \"TargetDate desc\" or \"ID asc\""),
  $top: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe('Max records to return (1–500). Defaults to server page size.'),
  $skip: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Number of records to skip for pagination. Use with $top.'),
} as const

export type ODataParams = {
  $filter?: string
  $orderby?: string
  $top?: number
  $skip?: number
}
