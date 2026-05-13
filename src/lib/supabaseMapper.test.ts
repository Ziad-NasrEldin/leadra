import { describe, expect, it } from 'vitest'
import { toUnitInsertPayload, toUnitViewModel, type SupabaseUnitRow } from './supabaseMapper'
import type { CreateUnitInput, LeadraUser } from './types'

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
  installmentType: 'quarterly',
  installmentYears: 5,
  deliveryExpectancy: { mode: 'month_year', month: 3, year: 2028 },
  originalOwnerName: 'Owner',
  countryCode: '+20',
  originalOwnerPhone: '010 1234 5678',
  salesNotes: 'Serious lead.',
  media: [],
}

describe('Supabase mappers', () => {
  it('creates a snake_case unit insert payload that relies on database calculations', () => {
    expect(toUnitInsertPayload(input, actor)).toMatchObject({
      developer_id: 'dev-1',
      project_id: 'project-1',
      destination_id: 'dest-1',
      payment_method: 'installment',
      down_payment: 1_000_000,
      installment_type: 'quarterly',
      installment_years: 5,
      country_code: '+20',
      original_owner_phone: '010 1234 5678',
      garden_area: null,
      terrace_area: null,
      created_by: 'user-1',
      team_id: 'team-1',
      branch_id: 'branch-1',
    })
  })

  it('stores null team and branch IDs for unassigned sales representatives', () => {
    expect(toUnitInsertPayload(input, { ...actor, teamId: '', branchId: '' })).toMatchObject({
      created_by: 'user-1',
      team_id: null,
      branch_id: null,
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
      commission_percentage: 1.5,
      commission_amount: 75_000,
      installment_type: null,
      installment_years: null,
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
      created_by: 'user-1',
      creator: { full_name: 'Sales User' },
      team_id: null,
      branch_id: null,
      created_at: '2026-05-04T00:00:00.000Z',
      updated_at: '2026-05-04T00:00:00.000Z',
      unit_media: [],
      unit_notes: [],
    }

    expect(toUnitViewModel(row).projectName).toBe('New Cairo Estates')
    expect(toUnitViewModel(row).deliveryExpectancy).toEqual({ mode: 'year', year: 2028 })
    expect(toUnitViewModel(row).teamId).toBe('')
    expect(toUnitViewModel(row).branchId).toBe('')
  })
})
