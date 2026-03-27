import { z } from 'zod';
// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------
export const ValueDescriptionSchema = z.object({
    Value: z.string(),
    Description: z.string(),
});
// All *Ref fields (AssetRef, ShopRef, DepartmentRef, etc.) share this shape
export const EntityRefSchema = z.object({
    PK: z.number(),
    ID: z.string(),
    Name: z.string(),
    Uuid: z.string().nullable(),
});
// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------
export function McApiResponseSchema(itemSchema) {
    return z.object({
        Results: z.array(itemSchema),
        Total: z.number(),
    });
}
// ---------------------------------------------------------------------------
// Work Orders — confirmed against live prod API (2026-03-25)
// ---------------------------------------------------------------------------
export const WorkOrderSummarySchema = z.object({
    PK: z.number(),
    ID: z.string(),
    Reason: z.string().optional(),
    TargetDate: z.string().nullable().optional(),
    RequestedDate: z.string().nullable().optional(),
    IssuedDate: z.string().nullable().optional(),
    CompleteDate: z.string().nullable().optional(),
    ClosedDate: z.string().nullable().optional(),
    IsOpen: z.boolean().optional(),
    IsApproved: z.boolean().optional(),
    IsAssigned: z.boolean().optional(),
    TargetHours: z.number().nullable().optional(),
    ActualHours: z.number().nullable().optional(),
    TypeDetails: ValueDescriptionSchema.nullable().optional(),
    StatusDetails: ValueDescriptionSchema.nullable().optional(),
    PriorityDetails: ValueDescriptionSchema.nullable().optional(),
    AssetRef: EntityRefSchema.nullable().optional(),
    PMRef: EntityRefSchema.nullable().optional(),
    ShopRef: EntityRefSchema.nullable().optional(),
    DepartmentRef: EntityRefSchema.nullable().optional(),
    RequesterRef: EntityRefSchema.nullable().optional(),
    ZoneRef: EntityRefSchema.nullable().optional(),
});
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
});
// ---------------------------------------------------------------------------
// Parts — placeholder, expand once confirmed against live API
// ---------------------------------------------------------------------------
export const PartSummarySchema = z.object({
    PK: z.number(),
    ID: z.string(),
    Name: z.string().optional(),
    Status: z.string().optional(),
});
// ---------------------------------------------------------------------------
// Purchase Orders — placeholder, expand once confirmed against live API
// ---------------------------------------------------------------------------
export const PurchaseOrderSummarySchema = z.object({
    PK: z.number(),
    ID: z.string(),
    Status: z.string().optional(),
    VendorPK: z.number().optional(),
});
