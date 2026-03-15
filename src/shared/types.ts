/**
 * MC API response envelope used by all list endpoints.
 * Fields are added here only as confirmed against real API responses.
 */
export interface McApiResponse<T = unknown> {
  Results: T[]
  Total: number
}

// Minimal known fields — expand as confirmed against real API responses

export interface WorkOrderSummary {
  PK: number
  ID: string
  Reason?: string
  Status?: string
  TargetDate?: string
  AssetPK?: number
}

export interface AssetSummary {
  PK: number
  ID: string
  Name?: string
  Status?: string
  ClassificationPK?: number
}

export interface PartSummary {
  PK: number
  ID: string
  Name?: string
  Status?: string
}

export interface PurchaseOrderSummary {
  PK: number
  ID: string
  Status?: string
  VendorPK?: number
}
