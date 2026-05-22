import { describe, expect, it } from 'vitest'
import { toMediaInsertPayload, toUnitInsertPayload, toUnitUpdatePayload, toUnitViewModel, type SupabaseUnitRow } from './supabaseMapper'
import type { CreateUnitInput, LeadraUser, UnitEditInput } from './types'

const actor: LeadraUser = {
  id: 'user-1',
  fullName: 'Sales User',
  email: 'sales@leadra.test',
  role: 'sales',
  jobTitle: 'Sales',
  phoneNumber: '+201000000000',
  teamId: 'team-1',
  branchId: 'branch-1',
  status: 'active',
}

const input: CreateUnitInput = {
  developerId: 'dev-1',
  developerName: 'Palm Hills',
  projectId: 'project-1',
  projectName: 'New Cairo Estates',
  destinationId: 'dest-1',
  destinationName: 'New Cairo',
  unitType: 'Apartment',
  floor: '2nd',
  bua: 150,
  roofGardenArea: null,
  gardenArea: null,
  terraceArea: null,
  viewId: 'view-1',
  viewName: 'Garden',
  bedrooms: 3,
  bathrooms: 2,
  elevator: true,
  landArea: null,
  furnished: false,
  finish: 'Fully Finished',
  paymentMethod: 'installment',
  totalAmount: 5_000_000,
  downPayment: 1_000_000,
  transferFees: 125_000,
  maintenancePaid: true,
  maintenanceCost: null,
  maintenanceDueDate: null,
  installmentType: 'quarterly',
  installmentYears: 5,
  installmentStartMonth: '2026-03-01',
  installmentEndMonth: '2030-03-01',
  customInstallmentText: null,
  deliveryExpectancy: { mode: 'month_year', month: 3, year: 2028 },
  originalOwnerName: 'Owner',
  countryCode: '+20',
  originalOwnerPhone: '010 1234 5678',
  salesNotes: 'Serious lead.',
  media: [],
}

const editInput: UnitEditInput = {
  developerId: 'dev-2',
  developerName: 'SODIC',
  projectId: 'project-2',
  projectName: 'ZED East',
  destinationId: 'dest-2',
  destinationName: 'Sheikh Zayed',
  unitType: 'Penthouse',
  floor: 'Ground',
  bua: 180,
  roofGardenArea: null,
  gardenArea: null,
  terraceArea: 40,
  viewId: 'view-2',
  viewName: 'Sea',
  bedrooms: 4,
  bathrooms: 3,
  elevator: true,
  landArea: null,
  furnished: true,
  finish: 'Semi Finished',
  deliveryExpectancy: { mode: 'year', year: 2029 },
  originalOwnerName: 'Updated Owner',
  countryCode: '+971',
  originalOwnerPhone: '0501234568',
  salesNotes: 'Updated notes.',
  totalAmount: 6_500_000,
  transferFees: null,
  maintenancePaid: false,
  maintenanceCost: null,
  maintenanceDueDate: null,
  installmentType: 'custom',
  customInstallmentText: '10% on contract, balance by owner agreement.',
  commissionPercentage: 2,
}

describe('Supabase mappers', () => {
  it('creates a snake_case unit insert payload that relies on database calculations', () => {
    const payload = toUnitInsertPayload(input, actor)

    expect(payload).toMatchObject({
      developer_id: 'dev-1',
      project_id: 'project-1',
      destination_id: 'dest-1',
      payment_method: 'installment',
      down_payment: 1_000_000,
      transfer_fees: 125_000,
      maintenance_paid: true,
      maintenance_cost: null,
      maintenance_due_date: null,
      installment_type: 'quarterly',
      installment_years: null,
      installment_start_month: '2026-03-01',
      installment_end_month: '2030-03-01',
      custom_installment_text: null,
      country_code: '+20',
      original_owner_phone: '010 1234 5678',
      garden_area: null,
      terrace_area: null,
      created_by: 'user-1',
      team_id: 'team-1',
      branch_id: 'branch-1',
    })
    expect(payload).not.toHaveProperty('unit_code')
  })

  it('stores null team and branch IDs for unassigned sales representatives', () => {
    expect(toUnitInsertPayload(input, { ...actor, teamId: '', branchId: '' })).toMatchObject({
      created_by: 'user-1',
      team_id: null,
      branch_id: null,
    })
  })

  it('keeps unpaid maintenance cost and due date on insert', () => {
    expect(toUnitInsertPayload({
      ...input,
      maintenancePaid: false,
      maintenanceCost: 45_000,
      maintenanceDueDate: '2028-03-01',
    }, actor)).toMatchObject({
      maintenance_paid: false,
      maintenance_cost: 45_000,
      maintenance_due_date: '2028-03-01',
    })
  })

  it('creates a snake_case unit update payload without protected fields', () => {
    const payload = toUnitUpdatePayload(editInput, {
      canEditOwner: true,
      canEditPricing: true,
      canEditCommission: true,
    })

    expect(payload).toMatchObject({
      developer_id: 'dev-2',
      project_id: 'project-2',
      destination_id: 'dest-2',
      unit_type: 'Penthouse',
      terrace_area: 40,
      original_owner_name: 'Updated Owner',
      country_code: '+971',
      original_owner_phone: '0501234568',
      total_amount: 6_500_000,
      transfer_fees: null,
      maintenance_paid: false,
      maintenance_cost: null,
      maintenance_due_date: null,
      installment_type: 'custom',
      installment_years: null,
      installment_start_month: null,
      installment_end_month: null,
      custom_installment_text: '10% on contract, balance by owner agreement.',
      commission_percentage: 2,
    })
    expect(payload).not.toHaveProperty('remaining_payment')
    expect(payload).not.toHaveProperty('payment_method')
    expect(payload).not.toHaveProperty('down_payment')
    expect(payload).not.toHaveProperty('created_by')
    expect(payload).not.toHaveProperty('unit_code')
  })

  it('omits owner and pricing fields from update payloads when permissions do not allow them', () => {
    const payload = toUnitUpdatePayload(editInput, {
      canEditOwner: false,
      canEditPricing: false,
      canEditCommission: false,
    })

    expect(payload).not.toHaveProperty('original_owner_name')
    expect(payload).not.toHaveProperty('country_code')
    expect(payload).not.toHaveProperty('original_owner_phone')
    expect(payload).not.toHaveProperty('total_amount')
    expect(payload).not.toHaveProperty('transfer_fees')
    expect(payload).not.toHaveProperty('maintenance_paid')
    expect(payload).not.toHaveProperty('maintenance_cost')
    expect(payload).not.toHaveProperty('maintenance_due_date')
    expect(payload).not.toHaveProperty('installment_type')
    expect(payload).not.toHaveProperty('installment_start_month')
    expect(payload).not.toHaveProperty('installment_end_month')
    expect(payload).not.toHaveProperty('custom_installment_text')
    expect(payload).not.toHaveProperty('commission_percentage')
    expect(payload).toMatchObject({ bua: 180, sales_notes: 'Updated notes.' })
  })

  it('omits transfer fee updates when the legacy field is absent from edit input', () => {
    const inputWithoutTransferFees: UnitEditInput = { ...editInput }
    delete inputWithoutTransferFees.transferFees

    const payload = toUnitUpdatePayload(inputWithoutTransferFees, {
      canEditOwner: true,
      canEditPricing: true,
      canEditCommission: true,
    })

    expect(payload).not.toHaveProperty('transfer_fees')
  })

  it('maps image PDF visibility into media inserts and leaves database ids server-generated', () => {
    const payload = toMediaInsertPayload({
      id: 'media-1',
      type: 'image',
      url: 'units/105/media-1.jpg',
      name: 'media-1.jpg',
      sizeBytes: 1024,
      includeInPdf: true,
    })

    expect(payload).toMatchObject({
      type: 'image',
      storage_path: 'units/105/media-1.jpg',
      file_name: 'media-1.jpg',
      size_bytes: 1024,
      include_in_pdf: true,
    })
    expect(payload).not.toHaveProperty('id')
    expect(payload).not.toHaveProperty('unit_id')
  })

  it('keeps PDF attachments out of generated unit PDFs when persisting media', () => {
    expect(toMediaInsertPayload({
      id: 'media-pdf',
      type: 'pdf',
      url: 'units/105/floor-plan.pdf',
      name: 'floor-plan.pdf',
      sizeBytes: 2048,
      includeInPdf: true,
    })).toMatchObject({
      type: 'pdf',
      storage_path: 'units/105/floor-plan.pdf',
      file_name: 'floor-plan.pdf',
      size_bytes: 2048,
      include_in_pdf: false,
    })
  })

  it('maps joined Supabase rows back to the app unit model', () => {
    const row: SupabaseUnitRow = {
      id: 105,
      unit_code: 'NC3BR',
      developer_id: 'dev-1',
      developer: { label: 'Palm Hills' },
      project_id: 'project-1',
      project: { label: 'New Cairo Estates' },
      destination_id: 'dest-1',
      destination: { label: 'New Cairo' },
      unit_type: 'Apartment',
      floor: '2nd',
      bua: 150,
      roof_garden_area: null,
      garden_area: null,
      terrace_area: null,
      view_id: 'view-1',
      view: { label: 'Garden' },
      bedrooms: 3,
      bathrooms: 2,
      elevator: true,
      land_area: null,
      furnished: false,
      finish: 'Fully Finished',
      payment_method: 'cash',
      total_amount: 5_000_000,
      down_payment: null,
      remaining_payment: null,
      transfer_fees: 150_000,
      maintenance_paid: true,
      maintenance_cost: 55_000,
      maintenance_due_date: '2028-06-15',
      commission_percentage: 1.5,
      commission_amount: 75_000,
      installment_type: null,
      installment_years: null,
      installment_start_month: null,
      installment_end_month: null,
      custom_installment_text: null,
      installment_amount: null,
      delivery_month: null,
      delivery_year: 2028,
      original_owner_name: 'Owner',
      country_code: '+20',
      original_owner_phone: '01012345678',
      normalized_owner_phone: '+201012345678',
      sales_notes: 'Serious lead.',
      status: 'available',
      archived: false,
      is_special: true,
      special_marked_at: '2026-05-05T00:00:00.000Z',
      special_marked_by: 'admin-1',
      created_by: 'user-1',
      creator: { full_name: 'Sales User' },
      team_id: null,
      branch_id: null,
      created_at: '2026-05-04T00:00:00.000Z',
      updated_at: '2026-05-04T00:00:00.000Z',
      unit_media: [
        { id: 'image-1', type: 'image', storage_path: '/image.jpg', file_name: 'image.jpg', size_bytes: 1000 },
        { id: 'video-1', type: 'video', storage_path: '/video.mp4', file_name: 'video.mp4', size_bytes: 1000 },
      ],
      unit_notes: [],
    }

    expect(toUnitViewModel(row).projectName).toBe('New Cairo Estates')
    expect(toUnitViewModel(row).deliveryExpectancy).toEqual({ mode: 'year', year: 2028 })
    expect(toUnitViewModel(row).transferFees).toBe(150_000)
    expect(toUnitViewModel(row).maintenancePaid).toBe(true)
    expect(toUnitViewModel(row).maintenanceCost).toBe(55_000)
    expect(toUnitViewModel(row).maintenanceDueDate).toBe('2028-06-15')
    expect(toUnitViewModel(row).installmentStartMonth).toBeNull()
    expect(toUnitViewModel(row).customInstallmentText).toBeNull()
    expect(toUnitViewModel(row).isSpecial).toBe(true)
    expect(toUnitViewModel(row).specialMarkedAt).toBe('2026-05-05T00:00:00.000Z')
    expect(toUnitViewModel(row).specialMarkedBy).toBe('admin-1')
    expect(toUnitViewModel(row).teamId).toBe('')
    expect(toUnitViewModel(row).branchId).toBe('')
    expect(toUnitViewModel(row).media).toEqual([
      { id: 'image-1', type: 'image', url: '/image.jpg', name: 'image.jpg', sizeBytes: 1000, includeInPdf: true },
    ])
  })
})
