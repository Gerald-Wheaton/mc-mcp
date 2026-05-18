import { z } from 'zod'

export interface RepairCenterArgs {
  repair_center_id?: string
  repair_center_name?: string
}

export const repairCenterArgsSchema = {
  repair_center_id: z
    .string()
    .optional()
    .describe('Exact repair center ID to scope the analysis to, such as M.'),
  repair_center_name: z
    .string()
    .optional()
    .describe('Exact repair center name to resolve case-insensitively before scoping the analysis.'),
} as const

interface BuildRepairCenterInstructionsOptions {
  args: RepairCenterArgs
  scopeLabel: string
  resolutionSampleLabel: string
  filterField?: string
  postResolveInstruction?: string
  excludeFollowupLookups?: boolean
}

function cleanArg(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function buildRepairCenterInstructions({
  args,
  scopeLabel,
  resolutionSampleLabel,
  filterField = 'RepairCenterID',
  postResolveInstruction,
  excludeFollowupLookups = false,
}: BuildRepairCenterInstructionsOptions): string | undefined {
  const repairCenterId = cleanArg(args.repair_center_id)
  const repairCenterName = cleanArg(args.repair_center_name)

  if (repairCenterId && repairCenterName) {
    throw new Error(
      'Provide only one repair center input. Use either repair_center_id or repair_center_name.',
    )
  }

  const scopedInstruction = `Keep ${scopeLabel} limited to repair center ID "${repairCenterId}" using the filter ${filterField} eq "${repairCenterId}".`
  const followupConstraint = excludeFollowupLookups
    ? ' Do not apply that repair-center scope to the part lookups.'
    : ''

  if (repairCenterId) {
    return `${scopedInstruction}${followupConstraint} If that scope cannot be applied confidently, stop and explain the limitation instead of guessing.`
  }

  if (repairCenterName) {
    const resolvedInstruction =
      postResolveInstruction ??
      `Once exactly one repair center is resolved, keep ${scopeLabel} limited to that repair center using the filter ${filterField} eq "{resolvedID}".`
    const followupLine = excludeFollowupLookups
      ? '- Do not apply the repair-center scope to the part lookups, and do not broaden the request if the repair center cannot be pinned down.'
      : '- Do not guess or broaden the scope if the repair center cannot be pinned down.'

    return `Resolve the repair center before the main analysis:
- Fetch a small sample of ${resolutionSampleLabel} that include repair center information.
- Build a distinct list of repair centers using the IDs and names returned in those records.
- Compare names after trimming whitespace and converting to lowercase.
- If zero exact matches are found for "${repairCenterName}", stop and say the repair center name could not be resolved.
- If more than one exact match is found for "${repairCenterName}", stop and say duplicate repair centers were found and the request is ambiguous.
- ${resolvedInstruction}
${followupLine}`
  }

  return undefined
}
