import { z } from 'zod'

/**
 * Shared list-query parameter shape. Spread into every list tool's input schema:
 *   server.tool('mc_list_X', 'desc', { ...odataShape, ...toolSpecificParams }, handler)
 */
export const odataShape = {
  $filter: z
    .string()
    .optional()
    .describe(
      'Optional narrowing for the result set. Use only when earlier context gives you a reliable way to target the right records.',
    ),
  $orderby: z
    .string()
    .optional()
    .describe('Optional sort order for the result set.'),
  $top: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe('Optional page size from 1 to 500 records.'),
  $skip: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Optional offset for continuing through a longer result set.'),
  $fetchAll: z
    .boolean()
    .optional()
    .describe(
      'Automatically collect multiple pages when the result set is small enough to do so safely. Avoid this on large asset lists unless the scope is already narrow.',
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
