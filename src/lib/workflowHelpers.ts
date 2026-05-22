import type { LeadraUnit, LeadraUser } from './types'

const editableAuditFields = [
  'developerId',
  'projectId',
  'destinationId',
  'unitType',
  'floor',
  'bua',
  'roofGardenArea',
  'gardenArea',
  'terraceArea',
  'viewId',
  'bedrooms',
  'bathrooms',
  'elevator',
  'landArea',
  'furnished',
  'finish',
  'deliveryExpectancy',
  'salesNotes',
  'totalAmount',
  'transferFees',
  'maintenancePaid',
  'maintenanceCost',
  'maintenanceDueDate',
  'installmentType',
  'installmentStartMonth',
  'installmentEndMonth',
  'customInstallmentText',
  'commissionPercentage',
  'originalOwnerName',
  'countryCode',
  'originalOwnerPhone',
] as const

export function diffUnitEditFields(before: LeadraUnit, after: LeadraUnit): string[] {
  return editableAuditFields.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
}

export function pickUnitEditAuditValue(unit: LeadraUnit, fields: string[]): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((field) => [field, unit[field as keyof LeadraUnit]]),
  )
}

export function isAdminActor(actor: LeadraUser): boolean {
  return actor.role === 'admin' || actor.role === 'sub_admin'
}

export function emptyUser(): LeadraUser {
  return {
    id: '',
    fullName: '',
    email: '',
    role: 'sales',
    jobTitle: '',
    phoneNumber: '',
    teamId: '',
    branchId: '',
    status: 'inactive',
  }
}
