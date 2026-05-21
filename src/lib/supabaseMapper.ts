import type {
  CreateUnitInput,
  InstallmentType,
  LeadraMediaFile,
  LeadraNote,
  PaymentHistoryRow,
  PaymentScheduleRow,
  LeadraUnit,
  LeadraUser,
  PaymentMethod,
  UnitEditInput,
  UnitStatus,
  UserRole,
} from './types'
import { normalizeInstallmentMonth, normalizeUnitOutdoorFields } from './domain'

type JoinedLabel = { label?: string } | null
type JoinedCreator = { full_name?: string } | null

export interface SupabaseUnitRow {
  id: number
  unit_code: string
  developer_id: string
  developer?: JoinedLabel
  project_id: string
  project?: JoinedLabel
  destination_id: string
  destination?: JoinedLabel
  unit_type: string
  floor: string
  bua: number
  roof_garden_area: number | null
  garden_area?: number | null
  terrace_area?: number | null
  view_id: string
  view?: JoinedLabel
  bedrooms: number
  bathrooms: number
  elevator: boolean
  land_area: number | null
  furnished: boolean
  finish: string
  payment_method: PaymentMethod
  total_amount: number
  down_payment: number | null
  remaining_payment: number | null
  transfer_fees?: number | null
  maintenance_paid?: boolean | null
  maintenance_cost?: number | null
  maintenance_due_date?: string | null
  commission_percentage: number
  commission_amount: number
  installment_type: InstallmentType | null
  installment_years: number | null
  installment_start_month?: string | null
  installment_end_month?: string | null
  custom_installment_text?: string | null
  installment_amount: number | null
  delivery_month: number | null
  delivery_year: number
  original_owner_name: string | null
  country_code: string | null
  original_owner_phone: string | null
  normalized_owner_phone: string | null
  sales_notes: string | null
  status: UnitStatus
  archived: boolean
  is_special?: boolean | null
  special_marked_at?: string | null
  special_marked_by?: string | null
  created_by: string
  creator?: JoinedCreator
  team_id: string | null
  branch_id: string | null
  created_at: string
  updated_at: string
  unit_media?: SupabaseMediaRow[]
  unit_notes?: SupabaseNoteRow[]
  unit_payment_schedule?: SupabasePaymentScheduleRow[]
  unit_payment_history?: SupabasePaymentHistoryRow[]
}

export interface SafeUnitRpcRow {
  id: number
  unit_code: string
  developer_id: string
  developer_label: string | null
  project_id: string
  project_label: string | null
  destination_id: string
  destination_label: string | null
  unit_type: string
  floor: string
  bua: number
  roof_garden_area: number | null
  garden_area?: number | null
  terrace_area?: number | null
  view_id: string
  view_label: string | null
  bedrooms: number
  bathrooms: number
  elevator: boolean
  land_area: number | null
  furnished: boolean
  finish: string
  payment_method: PaymentMethod
  total_amount: number
  down_payment: number | null
  remaining_payment: number | null
  transfer_fees?: number | null
  maintenance_paid?: boolean | null
  maintenance_cost?: number | null
  maintenance_due_date?: string | null
  commission_percentage: number
  commission_amount: number
  installment_type: InstallmentType | null
  installment_years: number | null
  installment_start_month?: string | null
  installment_end_month?: string | null
  custom_installment_text?: string | null
  installment_amount: number | null
  delivery_month: number | null
  delivery_year: number
  original_owner_name: string | null
  country_code: string | null
  original_owner_phone: string | null
  normalized_owner_phone: string | null
  sales_notes: string | null
  status: UnitStatus
  archived: boolean
  is_special?: boolean | null
  special_marked_at?: string | null
  special_marked_by?: string | null
  created_by: string
  creator_full_name: string | null
  team_id: string | null
  branch_id: string | null
  created_at: string
  updated_at: string
  unit_media?: SupabaseMediaRow[]
  unit_notes?: SafeUnitRpcNoteRow[]
  unit_payment_schedule?: SupabasePaymentScheduleRow[]
  unit_payment_history?: SupabasePaymentHistoryRow[]
}

export interface SupabaseMediaRow {
  id: string
  type: 'image' | 'pdf' | 'video'
  storage_path: string
  file_name: string
  size_bytes: number
  include_in_pdf?: boolean | null
}

export interface SupabasePaymentScheduleRow {
  id: string
  unit_id: number
  payment_number: number
  due_month: string | null
  amount: number
  paid: boolean
  paid_at: string | null
  paid_by: string | null
  paid_by_profile?: JoinedCreator
}

export interface SupabasePaymentHistoryRow {
  id: string
  unit_id: number
  schedule_id: string
  action: 'paid' | 'unpaid'
  amount: number
  previous_remaining_value: number
  new_remaining_value: number
  actor_id: string
  actor_profile?: JoinedCreator
  created_at: string
}

interface SupabaseNoteRow {
  id: string
  content: string
  created_by: string
  created_by_role: UserRole
  created_at: string
  creator?: JoinedCreator
}

export interface SafeUnitRpcNoteRow {
  id: string
  content: string
  created_by: string
  created_by_role: UserRole
  created_at: string
  creator_full_name?: string | null
}

export function toUnitInsertPayload(input: CreateUnitInput, actor: LeadraUser) {
  const outdoorFields = normalizeUnitOutdoorFields(input)
  const installmentType = input.paymentMethod === 'installment' ? input.installmentType ?? 'custom' : null
  return {
    developer_id: input.developerId,
    project_id: input.projectId,
    destination_id: input.destinationId,
    unit_type: input.unitType,
    floor: outdoorFields.floor,
    bua: input.bua,
    roof_garden_area: outdoorFields.roofGardenArea,
    garden_area: outdoorFields.gardenArea,
    terrace_area: outdoorFields.terraceArea,
    view_id: input.viewId,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    elevator: input.elevator,
    land_area: outdoorFields.landArea,
    furnished: input.furnished,
    finish: input.finish,
    payment_method: input.paymentMethod,
    total_amount: input.totalAmount,
    down_payment: input.paymentMethod === 'installment' ? input.downPayment ?? 0 : null,
    transfer_fees: input.transferFees ?? null,
    maintenance_paid: input.maintenancePaid ?? false,
    maintenance_cost: input.maintenanceCost ?? null,
    maintenance_due_date: input.maintenancePaid ? input.maintenanceDueDate ?? null : null,
    installment_type: installmentType,
    installment_years: null,
    installment_start_month: installmentType && installmentType !== 'custom'
      ? normalizeInstallmentMonth(input.installmentStartMonth)
      : null,
    installment_end_month: installmentType && installmentType !== 'custom'
      ? normalizeInstallmentMonth(input.installmentEndMonth)
      : null,
    custom_installment_text: installmentType === 'custom' ? input.customInstallmentText?.trim() ?? null : null,
    delivery_month: input.deliveryExpectancy.mode === 'month_year' ? input.deliveryExpectancy.month ?? null : null,
    delivery_year: input.deliveryExpectancy.year,
    original_owner_name: input.originalOwnerName,
    country_code: input.countryCode,
    original_owner_phone: input.originalOwnerPhone,
    sales_notes: input.salesNotes,
    created_by: actor.id,
    team_id: actor.teamId || null,
    branch_id: actor.branchId || null,
  }
}

export function toUnitUpdatePayload(
  input: UnitEditInput,
  permissions: {
    canEditOwner: boolean
    canEditPricing: boolean
    canEditCommission: boolean
  },
) {
  const outdoorFields = normalizeUnitOutdoorFields(input)
  const installmentPatch =
    permissions.canEditPricing && hasInstallmentPayload(input)
      ? toInstallmentUpdatePayload(input)
      : {}
  return {
    developer_id: input.developerId,
    project_id: input.projectId,
    destination_id: input.destinationId,
    unit_type: input.unitType,
    floor: outdoorFields.floor,
    bua: input.bua,
    roof_garden_area: outdoorFields.roofGardenArea,
    garden_area: outdoorFields.gardenArea,
    terrace_area: outdoorFields.terraceArea,
    view_id: input.viewId,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    elevator: input.elevator,
    land_area: outdoorFields.landArea,
    furnished: input.furnished,
    finish: input.finish,
    delivery_month: input.deliveryExpectancy.mode === 'month_year' ? input.deliveryExpectancy.month ?? null : null,
    delivery_year: input.deliveryExpectancy.year,
    sales_notes: input.salesNotes,
    ...(permissions.canEditOwner
      ? {
          original_owner_name: input.originalOwnerName,
          country_code: input.countryCode,
          original_owner_phone: input.originalOwnerPhone,
        }
      : {}),
    ...(permissions.canEditPricing
      ? {
          ...(input.paymentMethod ? { payment_method: input.paymentMethod } : {}),
          total_amount: input.totalAmount,
          ...(input.paymentMethod === 'installment' ? { down_payment: input.downPayment ?? null } : {}),
          ...(input.paymentMethod === 'cash' ? { down_payment: null } : {}),
          ...(input.transferFees !== undefined ? { transfer_fees: input.transferFees } : {}),
          maintenance_paid: input.maintenancePaid ?? false,
          maintenance_cost: input.maintenanceCost ?? null,
          maintenance_due_date: input.maintenancePaid ? input.maintenanceDueDate ?? null : null,
          ...installmentPatch,
        }
      : {}),
    ...(permissions.canEditCommission ? { commission_percentage: input.commissionPercentage } : {}),
  }
}

function hasInstallmentPayload(input: UnitEditInput): boolean {
  return (
    input.installmentType !== undefined ||
    input.installmentStartMonth !== undefined ||
    input.installmentEndMonth !== undefined ||
    input.customInstallmentText !== undefined
  )
}

function toInstallmentUpdatePayload(input: UnitEditInput) {
  const installmentType = input.installmentType ?? 'custom'
  return {
    installment_type: installmentType,
    installment_years: null,
    installment_start_month: installmentType !== 'custom'
      ? normalizeInstallmentMonth(input.installmentStartMonth)
      : null,
    installment_end_month: installmentType !== 'custom'
      ? normalizeInstallmentMonth(input.installmentEndMonth)
      : null,
    custom_installment_text: installmentType === 'custom' ? input.customInstallmentText?.trim() ?? null : null,
  }
}

export function toUnitViewModel(row: SupabaseUnitRow): LeadraUnit {
  const outdoorFields = normalizeUnitOutdoorFields({
    unitType: row.unit_type,
    floor: row.floor,
    landArea: row.land_area,
    gardenArea: row.garden_area,
    terraceArea: row.terrace_area,
    roofGardenArea: row.roof_garden_area,
  })
  return {
    id: row.id,
    unitCode: row.unit_code,
    developerId: row.developer_id,
    developerName: row.developer?.label ?? 'Unknown developer',
    projectId: row.project_id,
    projectName: row.project?.label ?? 'Unknown project',
    destinationId: row.destination_id,
    destinationName: row.destination?.label ?? 'Unknown destination',
    unitType: row.unit_type,
    floor: outdoorFields.floor,
    bua: row.bua,
    roofGardenArea: outdoorFields.roofGardenArea,
    gardenArea: outdoorFields.gardenArea,
    terraceArea: outdoorFields.terraceArea,
    viewId: row.view_id,
    viewName: row.view?.label ?? 'Open view',
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    elevator: row.elevator,
    landArea: outdoorFields.landArea,
    furnished: row.furnished,
    finish: row.finish,
    paymentMethod: row.payment_method,
    totalAmount: row.total_amount,
    downPayment: row.down_payment,
    remainingPayment: row.remaining_payment,
    transferFees: row.transfer_fees ?? null,
    maintenancePaid: row.maintenance_paid ?? false,
    maintenanceCost: row.maintenance_cost ?? null,
    maintenanceDueDate: row.maintenance_due_date ?? null,
    commissionPercentage: row.commission_percentage,
    commissionAmount: row.commission_amount,
    installmentType: row.installment_type,
    installmentYears: row.installment_years,
    installmentStartMonth: row.installment_start_month ?? null,
    installmentEndMonth: row.installment_end_month ?? null,
    customInstallmentText: row.custom_installment_text ?? null,
    installmentAmount: row.installment_amount,
    deliveryExpectancy:
      row.delivery_month == null
        ? { mode: 'year', year: row.delivery_year }
        : { mode: 'month_year', month: row.delivery_month, year: row.delivery_year },
    originalOwnerName: row.original_owner_name,
    countryCode: row.country_code,
    originalOwnerPhone: row.original_owner_phone,
    normalizedOwnerPhone: row.normalized_owner_phone,
    salesNotes: row.sales_notes ?? '',
    status: row.status,
    archived: row.archived,
    isSpecial: row.is_special ?? false,
    specialMarkedAt: row.special_marked_at ?? null,
    specialMarkedBy: row.special_marked_by ?? null,
    createdBy: row.created_by,
    createdByName: row.creator?.full_name ?? 'Leadra user',
    teamId: row.team_id ?? '',
    branchId: row.branch_id ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    media: (row.unit_media ?? []).filter(isAllowedMediaRow).map(toMediaViewModel),
    adminManagerNotes: (row.unit_notes ?? []).map(toNoteViewModel),
    paymentSchedule: (row.unit_payment_schedule ?? []).map(toPaymentScheduleViewModel).sort(sortPaymentScheduleRows),
    paymentHistory: (row.unit_payment_history ?? []).map(toPaymentHistoryViewModel).sort(sortPaymentHistoryRows),
  }
}

export function toSafeUnitViewModel(row: SafeUnitRpcRow): LeadraUnit {
  const outdoorFields = normalizeUnitOutdoorFields({
    unitType: row.unit_type,
    floor: row.floor,
    landArea: row.land_area,
    gardenArea: row.garden_area,
    terraceArea: row.terrace_area,
    roofGardenArea: row.roof_garden_area,
  })
  return {
    id: row.id,
    unitCode: row.unit_code,
    developerId: row.developer_id,
    developerName: row.developer_label ?? 'Unknown developer',
    projectId: row.project_id,
    projectName: row.project_label ?? 'Unknown project',
    destinationId: row.destination_id,
    destinationName: row.destination_label ?? 'Unknown destination',
    unitType: row.unit_type,
    floor: outdoorFields.floor,
    bua: row.bua,
    roofGardenArea: outdoorFields.roofGardenArea,
    gardenArea: outdoorFields.gardenArea,
    terraceArea: outdoorFields.terraceArea,
    viewId: row.view_id,
    viewName: row.view_label ?? 'Open view',
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    elevator: row.elevator,
    landArea: outdoorFields.landArea,
    furnished: row.furnished,
    finish: row.finish,
    paymentMethod: row.payment_method,
    totalAmount: row.total_amount,
    downPayment: row.down_payment,
    remainingPayment: row.remaining_payment,
    transferFees: row.transfer_fees ?? null,
    maintenancePaid: row.maintenance_paid ?? false,
    maintenanceCost: row.maintenance_cost ?? null,
    maintenanceDueDate: row.maintenance_due_date ?? null,
    commissionPercentage: row.commission_percentage,
    commissionAmount: row.commission_amount,
    installmentType: row.installment_type,
    installmentYears: row.installment_years,
    installmentStartMonth: row.installment_start_month ?? null,
    installmentEndMonth: row.installment_end_month ?? null,
    customInstallmentText: row.custom_installment_text ?? null,
    installmentAmount: row.installment_amount,
    deliveryExpectancy:
      row.delivery_month == null
        ? { mode: 'year', year: row.delivery_year }
        : { mode: 'month_year', month: row.delivery_month, year: row.delivery_year },
    originalOwnerName: row.original_owner_name,
    countryCode: row.country_code,
    originalOwnerPhone: row.original_owner_phone,
    normalizedOwnerPhone: row.normalized_owner_phone,
    salesNotes: row.sales_notes ?? '',
    status: row.status,
    archived: row.archived,
    isSpecial: row.is_special ?? false,
    specialMarkedAt: row.special_marked_at ?? null,
    specialMarkedBy: row.special_marked_by ?? null,
    createdBy: row.created_by,
    createdByName: row.creator_full_name ?? 'Leadra user',
    teamId: row.team_id ?? '',
    branchId: row.branch_id ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    media: (row.unit_media ?? []).filter(isAllowedMediaRow).map(toMediaViewModel),
    adminManagerNotes: (row.unit_notes ?? []).map(toSafeNoteViewModel),
    paymentSchedule: (row.unit_payment_schedule ?? []).map(toPaymentScheduleViewModel).sort(sortPaymentScheduleRows),
    paymentHistory: (row.unit_payment_history ?? []).map(toPaymentHistoryViewModel).sort(sortPaymentHistoryRows),
  }
}

export function toMediaInsertPayload(file: LeadraMediaFile) {
  return {
    type: file.type === 'pdf' ? 'pdf' : 'image',
    storage_path: file.url,
    file_name: file.name,
    size_bytes: file.sizeBytes,
    include_in_pdf: file.type === 'image' ? file.includeInPdf !== false : false,
  }
}

function toMediaViewModel(row: SupabaseMediaRow & { type: 'image' | 'pdf' }): LeadraMediaFile {
  return {
    id: row.id,
    type: row.type,
    url: row.storage_path,
    name: row.file_name,
    sizeBytes: row.size_bytes,
    includeInPdf: row.type === 'image' ? row.include_in_pdf !== false : false,
  }
}

function isAllowedMediaRow(row: SupabaseMediaRow): row is SupabaseMediaRow & { type: 'image' | 'pdf' } {
  return row.type === 'image' || row.type === 'pdf'
}

function toNoteViewModel(row: SupabaseNoteRow): LeadraNote {
  return {
    id: row.id,
    content: row.content,
    createdBy: row.created_by,
    createdByName: row.creator?.full_name ?? 'Leadra user',
    role: row.created_by_role,
    createdAt: row.created_at,
  }
}

function toSafeNoteViewModel(row: SafeUnitRpcNoteRow): LeadraNote {
  return {
    id: row.id,
    content: row.content,
    createdBy: row.created_by,
    createdByName: row.creator_full_name ?? 'Leadra user',
    role: row.created_by_role,
    createdAt: row.created_at,
  }
}

export function toPaymentScheduleViewModel(row: SupabasePaymentScheduleRow): PaymentScheduleRow {
  return {
    id: row.id,
    unitId: row.unit_id,
    paymentNumber: row.payment_number,
    dueMonth: row.due_month,
    amount: Number(row.amount),
    paid: row.paid,
    paidAt: row.paid_at,
    paidBy: row.paid_by,
    paidByName: row.paid_by_profile?.full_name ?? null,
  }
}

export function toPaymentHistoryViewModel(row: SupabasePaymentHistoryRow): PaymentHistoryRow {
  return {
    id: row.id,
    unitId: row.unit_id,
    scheduleId: row.schedule_id,
    action: row.action,
    amount: Number(row.amount),
    previousRemainingValue: Number(row.previous_remaining_value),
    newRemainingValue: Number(row.new_remaining_value),
    actorId: row.actor_id,
    actorName: row.actor_profile?.full_name ?? 'Leadra user',
    createdAt: row.created_at,
  }
}

function sortPaymentScheduleRows(first: PaymentScheduleRow, second: PaymentScheduleRow): number {
  return first.paymentNumber - second.paymentNumber
}

function sortPaymentHistoryRows(first: PaymentHistoryRow, second: PaymentHistoryRow): number {
  return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
}
