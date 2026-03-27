import { z } from 'zod'

// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------

export const ValueDescriptionSchema = z.object({
  Value: z.string(),
  Description: z.string(),
})

// All *Ref fields (AssetRef, ShopRef, DepartmentRef, etc.) share this shape.
// Name is nullable — WorkOrderRef returns Name: null since WOs have no Name field.
export const EntityRefSchema = z.object({
  PK: z.number(),
  ID: z.string(),
  Name: z.string().nullable(),
  Uuid: z.string().nullable(),
})

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

export function McApiResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    Results: z.array(itemSchema),
    Total: z.number(),
  })
}

// ---------------------------------------------------------------------------
// Work Orders — confirmed against live prod API (2026-03-25, expanded 2026-03-26)
// ---------------------------------------------------------------------------

export const WorkOrderSummarySchema = z.object({
  PK: z.number(),
  ID: z.string(),
  WorkOrderUUID: z.string().nullable().optional(),
  Reason: z.string().optional(),
  Instructions: z.string().nullable().optional(),
  LaborReport: z.string().nullable().optional(),
  // Dates
  TargetDate: z.string().nullable().optional(),
  RequestedDate: z.string().nullable().optional(),
  IssuedDate: z.string().nullable().optional(),
  StatusDate: z.string().nullable().optional(),
  OnHoldDate: z.string().nullable().optional(),
  CompleteDate: z.string().nullable().optional(),
  ClosedDate: z.string().nullable().optional(),
  CanceledDate: z.string().nullable().optional(),
  DeniedDate: z.string().nullable().optional(),
  RespondedDate: z.string().nullable().optional(),
  FinalizedDate: z.string().nullable().optional(),
  LastModifiedDate: z.string().nullable().optional(),
  LastModifiedAction: z.string().nullable().optional(),
  // Hours / progress
  TargetHours: z.number().nullable().optional(),
  TargetDays: z.number().nullable().optional(),
  ActualHours: z.number().nullable().optional(),
  ResponseHours: z.number().nullable().optional(),
  CompletePercent: z.number().nullable().optional(),
  RouteOrder: z.number().nullable().optional(),
  // Booleans — useful for filtering
  IsOpen: z.boolean().optional(),
  IsAssigned: z.boolean().optional(),
  IsPartsReserved: z.boolean().optional(),
  IsFollowupWork: z.boolean().optional(),
  // Booleans — present but always false in this customer's data
  IsApproved: z.boolean().optional(),
  HasWarranty: z.boolean().optional(),
  IsChargeable: z.boolean().optional(),
  IsFailedWorkOrder: z.boolean().optional(),
  IsLockoutTagout: z.boolean().optional(),
  IsShutdownRequired: z.boolean().optional(),
  // Details (Value + Description)
  TypeDetails: ValueDescriptionSchema.nullable().optional(),
  StatusDetails: ValueDescriptionSchema.nullable().optional(),
  SubStatusDetails: ValueDescriptionSchema.nullable().optional(),
  PriorityDetails: ValueDescriptionSchema.nullable().optional(),
  AuthStatusDetails: ValueDescriptionSchema.nullable().optional(),
  ReferenceDetails: ValueDescriptionSchema.nullable().optional(),
  // Entity refs
  AssetRef: EntityRefSchema.nullable().optional(),
  PMRef: EntityRefSchema.nullable().optional(),
  ShopRef: EntityRefSchema.nullable().optional(),
  DepartmentRef: EntityRefSchema.nullable().optional(),
  RequesterRef: EntityRefSchema.nullable().optional(),
  ZoneRef: EntityRefSchema.nullable().optional(),
  AccountRef: EntityRefSchema.nullable().optional(),
  CategoryRef: EntityRefSchema.nullable().optional(),
  RepairCenterRef: EntityRefSchema.nullable().optional(),
  ProcedureRef: EntityRefSchema.nullable().optional(),
  ProblemRef: EntityRefSchema.nullable().optional(),
  FailureRef: EntityRefSchema.nullable().optional(),
  SolutionRef: EntityRefSchema.nullable().optional(),
  SupervisorRef: EntityRefSchema.nullable().optional(),
  TakenByRef: EntityRefSchema.nullable().optional(),
  StockRoomRef: EntityRefSchema.nullable().optional(),
  ToolRoomRef: EntityRefSchema.nullable().optional(),
  ProjectRef: EntityRefSchema.nullable().optional(),
  ShiftRef: EntityRefSchema.nullable().optional(),
  CustomerRef: EntityRefSchema.nullable().optional(),
  ExternalInterfaceRef: EntityRefSchema.nullable().optional(),
  // Requester contact (denormalized)
  RequesterName: z.string().nullable().optional(),
  RequesterEmail: z.string().nullable().optional(),
  RequesterPhone: z.string().nullable().optional(),
})

// ---------------------------------------------------------------------------
// Assets — confirmed against live prod API (2026-03-25)
// ---------------------------------------------------------------------------

export const AssetSummarySchema = z.object({
  PK: z.number(),
  ID: z.string(),
  Name: z.string(),
  IsLocation: z.boolean().optional(),
  IsUp: z.boolean().optional(),
  AssetLevel: z.number().optional(),
  LastMaintained: z.string().nullable().optional(),
  Model: z.string().nullable().optional(),
  Serial: z.string().nullable().optional(),
  SquareFootage: z.number().nullable().optional(),
  YearBuilt: z.number().nullable().optional(),
  LastModifiedDate: z.string().nullable().optional(),
  TypeDetails: ValueDescriptionSchema.nullable().optional(),
  StatusDetails: ValueDescriptionSchema.nullable().optional(),
  PriorityDetails: ValueDescriptionSchema.nullable().optional(),
  ClassificationRef: EntityRefSchema.nullable().optional(),
  ParentRef: EntityRefSchema.nullable().optional(),
  DepartmentRef: EntityRefSchema.nullable().optional(),
  RepairCenterRef: EntityRefSchema.nullable().optional(),
  ZoneRef: EntityRefSchema.nullable().optional(),
})

// ---------------------------------------------------------------------------
// Parts — confirmed against live prod API (2026-03-26, expanded 2026-03-26)
// Full field set verified against all 3305 records
// ---------------------------------------------------------------------------

export const PartSummarySchema = z.object({
  PK: z.number(),
  ID: z.string(),
  Name: z.string().optional(),
  PartDescription: z.string().nullable().optional(),
  Comments: z.string().nullable().optional(),
  Model: z.string().nullable().optional(),
  InternalPartNumber: z.string().nullable().optional(),
  ManufacturerNumber: z.string().nullable().optional(),
  PartURL: z.string().nullable().optional(),
  Photo: z.string().nullable().optional(),
  // Booleans — useful for filtering
  Active: z.boolean().optional(),
  DirectIssue: z.boolean().optional(),
  AvailableToRequester: z.boolean().optional(),
  // Booleans — constant for this customer (keep for multi-client use)
  Hazardous: z.boolean().optional(),
  RotatingPart: z.boolean().optional(),
  // Cost fields
  IssueUnitCost: z.number().optional(),
  IssueUnitChargePrice: z.number().optional(),
  IssueUnitChargePercentage: z.number().optional(),
  AverageOrderUnitPrice: z.number().optional(),
  LastOrderUnitPrice: z.number().nullable().optional(),
  ConversionToIssueUnits: z.number().optional(),
  // Physical properties
  ShelfLifeDays: z.number().optional(),
  ShippingWeight: z.number().optional(),
  WarrantyDays: z.number().nullable().optional(),
  // Dates
  LastOrdered: z.string().nullable().optional(),
  LastIssued: z.string().nullable().optional(),
  LastModifiedDate: z.string().nullable().optional(),
  // Last activity refs (PO and WO)
  LastOrderedPOPK: z.number().nullable().optional(),
  LastOrderedPOID: z.string().nullable().optional(),
  LastIssuedWOPK: z.number().nullable().optional(),
  LastIssuedWOID: z.string().nullable().optional(),
  // Details (Value + Description)
  IssueUnitsDetails: ValueDescriptionSchema.nullable().optional(),
  OrderUnitsDetails: ValueDescriptionSchema.nullable().optional(),
  CostRuleDetails: ValueDescriptionSchema.nullable().optional(),
  WarrantyFromDetails: ValueDescriptionSchema.nullable().optional(),
  // Entity refs
  CategoryRef: EntityRefSchema.nullable().optional(),
  ClassificationRef: EntityRefSchema.nullable().optional(),
  ManufacturerRef: EntityRefSchema.nullable().optional(),
})

// ---------------------------------------------------------------------------
// Purchase Orders — confirmed against all 74 live records (2026-03-26)
// ---------------------------------------------------------------------------

export const PurchaseOrderSummarySchema = z.object({
  PK: z.number(),
  ID: z.string(),
  Description: z.string().nullable().optional(),
  Comments: z.string().nullable().optional(),
  InvoiceNumber: z.string().nullable().optional(),
  // Dates
  OrderDate: z.string().nullable().optional(),
  StatusDate: z.string().nullable().optional(),
  FollowupDate: z.string().nullable().optional(),
  ShipDate: z.string().nullable().optional(),
  LastModifiedDate: z.string().nullable().optional(),
  // Booleans — useful for filtering
  IsOpen: z.boolean().optional(),
  IsPartsOrdered: z.boolean().optional(),
  // Booleans — low variance for this customer (keep for multi-client)
  IsApproved: z.boolean().optional(),
  IsAveraged: z.boolean().optional(),
  IsPrinted: z.boolean().optional(),
  // Cost fields
  Subtotal: z.number().optional(),
  SubTotalPreDiscount: z.number().optional(),
  SubTotalPostDiscount: z.number().optional(),
  Discount: z.number().optional(),
  DiscountPercentage: z.number().optional(),
  FreightCharge: z.number().optional(),
  TaxAmount: z.number().optional(),
  Total: z.number().optional(),
  Budget: z.number().nullable().optional(),
  Currency: z.string().nullable().optional(),
  CurrencySymbol: z.string().nullable().optional(),
  // Details (Value + Description)
  StatusDetails: ValueDescriptionSchema.nullable().optional(),
  SubStatusDetails: ValueDescriptionSchema.nullable().optional(),
  AuthStatusDetails: ValueDescriptionSchema.nullable().optional(),
  PriorityDetails: ValueDescriptionSchema.nullable().optional(),
  // Entity refs
  VendorRef: EntityRefSchema.nullable().optional(),
  RequesterRef: EntityRefSchema.nullable().optional(),
  BuyerRef: EntityRefSchema.nullable().optional(),
  BuyerCompanyRef: EntityRefSchema.nullable().optional(),
  DepartmentRef: EntityRefSchema.nullable().optional(),
  AccountRef: EntityRefSchema.nullable().optional(),
  RepairCenterRef: EntityRefSchema.nullable().optional(),
  CustomerRef: EntityRefSchema.nullable().optional(),
  // Requester contact (denormalized)
  RequesterEmail: z.string().nullable().optional(),
  RequesterPhone: z.string().nullable().optional(),
  // TakenBy (denormalized — no full EntityRef available)
  TakenByPK: z.number().nullable().optional(),
  TakenByInitials: z.string().nullable().optional(),
  // Shipping and billing nested objects — mostly null; use z.unknown() to avoid
  // rigid sub-schema while still passing through data to the LLM
  ShippingInfo: z.unknown().optional(),
  BillingInfo: z.unknown().optional(),
})

// ---------------------------------------------------------------------------
// Purchase Order Line Items — confirmed against live prod API (2026-03-27)
// Root endpoint: GET /PurchaseOrderLineItems (supports OData)
// ---------------------------------------------------------------------------

export const PurchaseOrderLineItemSummarySchema = z.object({
  PK: z.number(),
  PurchaseOrderPK: z.number(),
  LineItemNo: z.number(),
  // Quantities
  OrderUnitQty: z.number().optional(),
  OrderUnitQtyReceived: z.number().optional(),
  OrderUnitQtyBackOrdered: z.number().optional(),
  OrderUnitQtyCanceled: z.number().optional(),
  // Pricing
  OrderUnitPrice: z.number().optional(),
  Discount: z.number().optional(),
  Subtotal: z.number().optional(),
  FreightCharge: z.number().optional(),
  LineItemTotal: z.number().optional(),
  TaxRate: z.number().optional(),
  TaxAmount: z.number().optional(),
  IsTax: z.boolean().optional(),
  // Conversion / issue
  ConversionToIssueUnits: z.number().optional(),
  DirectIssue: z.boolean().optional(),
  // Dates
  LastModifiedDate: z.string().nullable().optional(),
  ReceiveDate: z.string().nullable().optional(),
  DueDate: z.string().nullable().optional(),
  // Text fields
  Bin: z.string().nullable().optional(),
  VendorPartNumber: z.string().nullable().optional(),
  Comments: z.string().nullable().optional(),
  SubAccountID: z.string().nullable().optional(),
  SubAccountName: z.string().nullable().optional(),
  SubAccountPK: z.number().nullable().optional(),
  WorkOrderPartPK: z.number().nullable().optional(),
  // Details — OrderUnitsDetails can be { Value: "", Description: "" } (not null)
  IssueUnitsDetails: ValueDescriptionSchema.nullable().optional(),
  OrderUnitsDetails: ValueDescriptionSchema.nullable().optional(),
  // Entity refs
  PartRef: EntityRefSchema.nullable().optional(),
  WorkOrderRef: EntityRefSchema.nullable().optional(),
  AssetRef: EntityRefSchema.nullable().optional(),
  LaborRef: EntityRefSchema.nullable().optional(),
  LocationRef: EntityRefSchema.nullable().optional(),
  AccountRef: EntityRefSchema.nullable().optional(),
})

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type ValueDescription = z.infer<typeof ValueDescriptionSchema>
export type EntityRef = z.infer<typeof EntityRefSchema>
export type WorkOrderSummary = z.infer<typeof WorkOrderSummarySchema>
export type AssetSummary = z.infer<typeof AssetSummarySchema>
export type PartSummary = z.infer<typeof PartSummarySchema>
export type PurchaseOrderSummary = z.infer<typeof PurchaseOrderSummarySchema>
export type PurchaseOrderLineItemSummary = z.infer<typeof PurchaseOrderLineItemSummarySchema>
