import type {
  CreateUnitInput,
  InstallmentType,
  LeadraMediaFile,
  LeadraNote,
  LeadraUnit,
  LeadraUser,
  PaymentMethod,
  UnitStatus,
  UserRole,
} from './types'

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
  commission_percentage: number
  commission_amount: number
  installment_type: InstallmentType | null
  installment_years: number | null
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
  created_by: string
  creator?: JoinedCreator
  team_id: string
  branch_id: string
  created_at: string
  updated_at: string
  unit_media?: SupabaseMediaRow[]
  unit_notes?: SupabaseNoteRow[]
}

interface SupabaseMediaRow {
  id: string
  type: 'image' | 'video'
  storage_path: string
  file_name: string
  size_bytes: number
}

interface SupabaseNoteRow {
  id: string
  content: string
  created_by: string
  created_by_role: UserRole
  created_at: string
  creator?: JoinedCreator
}

export function toUnitInsertPayload(input: CreateUnitInput, actor: LeadraUser) {
  return {
    developer_id: input.developerId,
    project_id: input.projectId,
    destination_id: input.destinationId,
    unit_type: input.unitType,
    floor: input.floor,
    bua: input.bua,
    roof_garden_area: input.roofGardenArea ?? null,
    view_id: input.viewId,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    elevator: input.elevator,
    land_area: input.landArea ?? null,
    furnished: input.furnished,
    finish: input.finish,
    payment_method: input.paymentMethod,
    total_amount: input.totalAmount,
    down_payment: input.paymentMethod === 'installment' ? input.downPayment ?? 0 : null,
    installment_type: input.paymentMethod === 'installment' ? input.installmentType ?? 'custom' : null,
    installment_years: input.paymentMethod === 'installment' ? input.installmentYears ?? null : null,
    delivery_month: input.deliveryExpectancy.mode === 'month_year' ? input.deliveryExpectancy.month ?? null : null,
    delivery_year: input.deliveryExpectancy.year,
    original_owner_name: input.originalOwnerName,
    country_code: input.countryCode,
    original_owner_phone: input.originalOwnerPhone,
    sales_notes: input.salesNotes,
    created_by: actor.id,
    team_id: actor.teamId,
    branch_id: actor.branchId,
  }
}

export function toUnitViewModel(row: SupabaseUnitRow): LeadraUnit {
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
    floor: row.floor,
    bua: row.bua,
    roofGardenArea: row.roof_garden_area,
    viewId: row.view_id,
    viewName: row.view?.label ?? 'Open view',
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    elevator: row.elevator,
    landArea: row.land_area,
    furnished: row.furnished,
    finish: row.finish,
    paymentMethod: row.payment_method,
    totalAmount: row.total_amount,
    downPayment: row.down_payment,
    remainingPayment: row.remaining_payment,
    commissionPercentage: row.commission_percentage,
    commissionAmount: row.commission_amount,
    installmentType: row.installment_type,
    installmentYears: row.installment_years,
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
    createdBy: row.created_by,
    createdByName: row.creator?.full_name ?? 'Leadra user',
    teamId: row.team_id,
    branchId: row.branch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    media: (row.unit_media ?? []).map(toMediaViewModel),
    adminManagerNotes: (row.unit_notes ?? []).map(toNoteViewModel),
  }
}

function toMediaViewModel(row: SupabaseMediaRow): LeadraMediaFile {
  return {
    id: row.id,
    type: row.type,
    url: row.storage_path,
    name: row.file_name,
    sizeBytes: row.size_bytes,
  }
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
