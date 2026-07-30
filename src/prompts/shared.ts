export const CONTEXT_INSTRUCTIONS = {
  time: 'Read mc://context/time before querying tools so relative dates are anchored correctly.',
  labors: 'Read mc://context/labors before summarizing assignees or technician references.',
  laborsOnWorkOrders:
    'Read mc://context/labors before summarizing assignees or technician references on work orders.',
  assetLocations:
    'Read mc://context/asset-locations when you need to translate asset parent/location references.',
  assetLocationsBefore:
    'Read mc://context/asset-locations before translating asset parent/location references.',
  lookupTables:
    'Read mc://context/lookup-tables when you need lookup-backed labels or codes during the analysis.',
  lookupTablesDuringAudit:
    'Read mc://context/lookup-tables when you need lookup-backed labels or codes during the audit.',
  lookupTablesBeforeCategory:
    'Read mc://context/lookup-tables before resolving any category or other lookup-backed value.',
} as const

export function cleanArg(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function buildPromptText(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join('\n\n')
}

export function buildContextInstructions(lines: string[]): string {
  return `Before querying tools:
${lines.map((line) => `- ${line}`).join('\n')}`
}

export function buildAssetResolutionInstructions(assetName?: string): string | undefined {
  if (!assetName) {
    return undefined
  }

  return `Resolve the target asset before the main analysis:
- Use mc_list_assets to find candidates whose IDs or names match "${assetName}".
- Prefer an exact match when one exists.
- If multiple assets plausibly match, stop and ask the user to clarify which asset they want.
- Once one asset is resolved, use that asset's returned identifiers and name to keep the rest of the analysis focused on it.`
}

export function buildCategoryInstructions(category?: string): string | undefined {
  if (!category) {
    return undefined
  }

  return `Resolve the category before the main analysis:
- Use mc://context/lookup-tables and observed category values in live part data to find the exact category that matches "${category}".
- Compare category names after trimming whitespace and converting to lowercase.
- If zero exact matches are found, stop and say the category could not be resolved.
- If more than one exact match is found, stop and say the category is ambiguous.
- Once resolved, keep the remainder of the analysis focused on that category. If the results cannot be narrowed reliably, say so briefly and keep the scope in your reasoning instead of guessing.`
}

export function buildVendorResolutionInstructions(vendorName?: string): string | undefined {
  if (!vendorName) {
    return undefined
  }

  return `Resolve the target vendor before the main analysis:
- Use live purchase-order data to find vendors whose names match "${vendorName}".
- Prefer an exact match when one exists.
- If multiple vendors plausibly match, stop and ask the user to clarify which vendor they want.
- Once one vendor is resolved, use that vendor's exact name and identifiers from returned data to keep the rest of the analysis focused on it.`
}
