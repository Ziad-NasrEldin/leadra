import { describe, expect, it } from 'vitest'
import { demoUsers, seedUnits } from '../data/seed'
import { LeadraRepository } from './repository'
import type { CreateUnitInput, LeadraUser, UnitEditInput } from './types'

function salesUser(overrides: Partial<LeadraUser> = {}): LeadraUser {
  return {
    id: 'sales-replacement',
    fullName: 'Replacement Sales',
    email: 'replacement@leadra.test',
    role: 'sales',
    jobTitle: 'Sales Representative',
    phoneNumber: '+201000000000',
    teamId: 'team-b',
    branchId: 'branch-b',
    status: 'active',
    ...overrides,
  }
}

describe('LeadraRepository', () => {
  it('creates units without sending a display code and uses the database-generated PRD code', async () => {
    const inserts: unknown[] = []
    const input: CreateUnitInput = {
      developerId: 'dev-1',
      developerName: 'Palm Hills',
      projectId: 'project-1',
      projectName: 'Mountain View',
      destinationId: 'dest-1',
      destinationName: 'New Cairo',
      unitType: 'Apartment',
      floor: '3rd',
      bua: 188,
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
      paymentMethod: 'cash',
      totalAmount: 5_500_000,
      downPayment: null,
      installmentType: null,
      installmentYears: null,
      deliveryExpectancy: { mode: 'year', year: 2029 },
      originalOwnerName: 'Owner',
      countryCode: '+20',
      originalOwnerPhone: '01033334444',
      salesNotes: 'Updated notes.',
      media: [],
    }
    const client = {
      from(table: string) {
        expect(table).toBe('units')
        return {
          insert(payload: unknown) {
            inserts.push(payload)
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({
                      error: null,
                      data: {
                        id: 105,
                        unit_code: 'MV3BR',
                        developer_id: 'dev-1',
                        developer: { label: 'Palm Hills' },
                        project_id: 'project-1',
                        project: { label: 'Mountain View' },
                        destination_id: 'dest-1',
                        destination: { label: 'New Cairo' },
                        unit_type: 'Apartment',
                        floor: '3rd',
                        bua: 188,
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
                        total_amount: 5_500_000,
                        down_payment: null,
                        remaining_payment: null,
                        commission_percentage: 1.5,
                        commission_amount: 82_500,
                        installment_type: null,
                        installment_years: null,
                        installment_amount: null,
                        delivery_month: null,
                        delivery_year: 2029,
                        original_owner_name: 'Owner',
                        country_code: '+20',
                        original_owner_phone: '01033334444',
                        normalized_owner_phone: '+201033334444',
                        sales_notes: 'Updated notes.',
                        status: 'available',
                        archived: false,
                        created_by: 'sales-replacement',
                        creator: { full_name: 'Replacement Sales' },
                        team_id: 'team-b',
                        branch_id: 'branch-b',
                        created_at: '2026-05-04T00:00:00.000Z',
                        updated_at: '2026-05-04T01:00:00.000Z',
                        unit_media: [],
                        unit_notes: [],
                      },
                    })
                  },
                }
              },
            }
          },
        }
      },
    }

    const result = await new LeadraRepository(client as never).createUnit(salesUser(), input)

    expect(inserts[0]).not.toHaveProperty('unit_code')
    expect(result.unitCode).toBe('MV3BR')
    expect(result.unitCode).not.toContain('Ba')
    expect(result.unitCode).not.toContain(String(result.id))
  })

  it('persists unit detail updates through the protected update payload', async () => {
    const updates: unknown[] = []
    const input: UnitEditInput = {
      developerId: 'dev-1',
      developerName: 'Palm Hills',
      projectId: 'project-1',
      projectName: 'New Cairo Estates',
      destinationId: 'dest-1',
      destinationName: 'New Cairo',
      unitType: 'Apartment',
      floor: '3rd',
      bua: 188,
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
      deliveryExpectancy: { mode: 'year', year: 2029 },
      originalOwnerName: 'Updated Owner',
      countryCode: '+20',
      originalOwnerPhone: '01033334444',
      salesNotes: 'Updated notes.',
      totalAmount: 5_500_000,
      commissionPercentage: 1.5,
    }
    const client = {
      from(table: string) {
        expect(table).toBe('units')
        return {
          update(payload: unknown) {
            updates.push(payload)
            return {
              eq(column: string, value: number) {
                expect(column).toBe('id')
                expect(value).toBe(105)
                return {
                  select() {
                    return {
                      single() {
                        return Promise.resolve({
                          error: null,
                          data: {
                            id: 105,
                            unit_code: 'NC3BR',
                            developer_id: 'dev-1',
                            developer: { label: 'Palm Hills' },
                            project_id: 'project-1',
                            project: { label: 'New Cairo Estates' },
                            destination_id: 'dest-1',
                            destination: { label: 'New Cairo' },
                            unit_type: 'Apartment',
                            floor: '3rd',
                            bua: 188,
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
                            payment_method: 'installment',
                            total_amount: 5_500_000,
                            down_payment: 1_000_000,
                            remaining_payment: 4_000_000,
                            commission_percentage: 1.5,
                            commission_amount: 82_500,
                            installment_type: 'quarterly',
                            installment_years: 5,
                            installment_amount: 200_000,
                            delivery_month: null,
                            delivery_year: 2029,
                            original_owner_name: 'Updated Owner',
                            country_code: '+20',
                            original_owner_phone: '01033334444',
                            normalized_owner_phone: '+201033334444',
                            sales_notes: 'Updated notes.',
                            status: 'available',
                            archived: false,
                            created_by: 'sales-1',
                            creator: { full_name: 'Sales User' },
                            team_id: 'team-1',
                            branch_id: 'branch-1',
                            created_at: '2026-05-04T00:00:00.000Z',
                            updated_at: '2026-05-04T01:00:00.000Z',
                            unit_media: [],
                            unit_notes: [],
                          },
                        })
                      },
                    }
                  },
                }
              },
            }
          },
        }
      },
    }

    const result = await new LeadraRepository(client as never).updateUnitDetails(salesUser(), 105, input, {
      canEditOwner: true,
      canEditPricing: true,
      canEditCommission: false,
    })

    expect(result.bua).toBe(188)
    expect(updates[0]).toMatchObject({ bua: 188, total_amount: 5_500_000, original_owner_phone: '01033334444' })
    expect(updates[0]).not.toHaveProperty('remaining_payment')
    expect(updates[0]).not.toHaveProperty('payment_method')
    expect(updates[0]).not.toHaveProperty('commission_percentage')
  })

  it('surfaces split sold status enum errors instead of collapsing to legacy sold', async () => {
    const updates: unknown[] = []
    const client = {
      from(table: string) {
        expect(table).toBe('units')
        return {
          update(payload: unknown) {
            updates.push(payload)
            return {
              eq() {
                return Promise.resolve({ error: { code: '22P02', message: 'invalid input value for enum public.unit_status: "sold_by_us"' } })
              },
            }
          },
        }
      },
    }

    await expect(new LeadraRepository(client as never).updateUnitStatus(5, 'sold_by_us')).rejects.toMatchObject({
      code: '22P02',
    })

    expect(updates).toEqual([{ status: 'sold_by_us' }])
  })

  it('does not hide non-enum status persistence errors', async () => {
    const client = {
      from() {
        return {
          update() {
            return {
              eq() {
                return Promise.resolve({ error: new Error('permission denied') })
              },
            }
          },
        }
      },
    }

    await expect(new LeadraRepository(client as never).updateUnitStatus(5, 'hold')).rejects.toThrow('permission denied')
  })

  it('persists payment timetable paid/unpaid actions through the protected RPC', async () => {
    const calls: Array<{ fn: string; args: unknown }> = []
    const client = {
      rpc(fn: string, args: unknown) {
        calls.push({ fn, args })
        return Promise.resolve({ error: null })
      },
      from(table: string) {
        expect(table).toBe('units')
        return {
          select() {
            return {
              eq(column: string, value: number) {
                expect(column).toBe('id')
                expect(value).toBe(105)
                return {
                  single() {
                    return Promise.resolve({
                      error: null,
                      data: {
                        id: 105,
                        unit_code: 'NC3BR',
                        developer_id: 'dev-1',
                        developer: { label: 'Palm Hills' },
                        project_id: 'project-1',
                        project: { label: 'New Cairo Estates' },
                        destination_id: 'dest-1',
                        destination: { label: 'New Cairo' },
                        unit_type: 'Apartment',
                        floor: '3rd',
                        bua: 188,
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
                        payment_method: 'installment',
                        total_amount: 5_000_000,
                        down_payment: 1_000_000,
                        remaining_payment: 3_800_000,
                        commission_percentage: 1.5,
                        commission_amount: 75_000,
                        installment_type: 'quarterly',
                        installment_years: null,
                        installment_start_month: '2026-03-01',
                        installment_end_month: '2026-12-01',
                        custom_installment_text: null,
                        installment_amount: 1_000_000,
                        delivery_month: null,
                        delivery_year: 2029,
                        original_owner_name: 'Owner',
                        country_code: '+20',
                        original_owner_phone: '01033334444',
                        normalized_owner_phone: '+201033334444',
                        sales_notes: 'Updated notes.',
                        status: 'available',
                        archived: false,
                        created_by: 'sales-1',
                        creator: { full_name: 'Sales User' },
                        team_id: 'team-1',
                        branch_id: 'branch-1',
                        created_at: '2026-05-04T00:00:00.000Z',
                        updated_at: '2026-05-04T01:00:00.000Z',
                        unit_media: [],
                        unit_notes: [],
                        unit_payment_schedule: [
                          {
                            id: 'schedule-1',
                            unit_id: 105,
                            payment_number: 1,
                            due_month: '2026-03-01',
                            amount: 1_000_000,
                            paid: true,
                            paid_at: '2026-05-15T10:00:00.000Z',
                            paid_by: 'admin-1',
                            paid_by_profile: { full_name: 'Admin User' },
                          },
                        ],
                        unit_payment_history: [],
                      },
                    })
                  },
                }
              },
            }
          },
        }
      },
    }

    const result = await new LeadraRepository(client as never).updatePaymentSchedule(105, 'schedule-1', true)

    expect(calls).toEqual([
      {
        fn: 'set_unit_payment_paid',
        args: { target_unit_id: 105, target_schedule_id: 'schedule-1', mark_paid: true },
      },
    ])
    expect(result.paymentSchedule?.[0]).toMatchObject({ id: 'schedule-1', paid: true, paidByName: 'Admin User' })
  })

  it('delegates sales representative deactivation and reassignment to the durable history RPC', async () => {
    const calls: Array<{ fn: string; body: unknown }> = []
    const client = {
      functions: {
        invoke(fn: string, { body }: { body: unknown }) {
          calls.push({ fn, body })
          return Promise.resolve({ data: { ok: true }, error: null })
        },
      },
    }

    await new LeadraRepository(client as never).deleteSalesRepresentativeAfterReassignment(
      'sales-old',
      salesUser({ id: 'sales-new' }),
      salesUser({ id: 'admin-1', role: 'admin' }),
    )

    expect(calls).toEqual([
      {
        fn: 'admin-deactivate-sales-rep',
        body: {
          salesUserId: 'sales-old',
          replacementSalesUserId: 'sales-new',
        },
      },
    ])
  })

  it('surfaces RPC errors when reassignment persistence fails', async () => {
    const client = {
      functions: {
        invoke() {
          return Promise.resolve({ data: { ok: false, error: 'Select an active replacement sales representative.' }, error: null })
        },
      },
    }

    await expect(
      new LeadraRepository(client as never).deleteSalesRepresentativeAfterReassignment(
        'sales-old',
        salesUser({ id: 'sales-new' }),
        salesUser({ id: 'admin-1', role: 'admin' }),
      ),
    ).rejects.toThrow('Select an active replacement sales representative.')
  })

  it('persists pdf audit, admin notifications, and analytics rows', async () => {
    const inserts: Array<{ table: string; payload: unknown }> = []
    const client = {
      from(table: string) {
        return {
          insert(payload: unknown) {
            inserts.push({ table, payload })
            return Promise.resolve({ error: null })
          },
        }
      },
    }

    await new LeadraRepository(client as never).recordPdfAction(
      demoUsers[3],
      seedUnits[0],
      'pdf_generated',
      { text: 'PDF generated', messageKey: 'message.audit.pdfGenerated', messageParams: { unitCode: seedUnits[0].unitCode } },
      {
        title: { text: 'PDF generated', messageKey: 'message.notification.pdfGenerated.title' },
        body: { text: 'PDF generated for unit.', messageKey: 'message.notification.pdfGenerated.body', messageParams: { unitCode: seedUnits[0].unitCode } },
      },
      ['admin', 'sub_admin'],
    )

    expect(inserts.map((item) => item.table)).toEqual(['audit_logs', 'notifications', 'analytics_events'])
    expect(inserts[0].payload).toMatchObject({ actor_id: demoUsers[3].id, related_unit_id: seedUnits[0].id })
    expect(inserts[1].payload).toEqual([
      expect.objectContaining({ audience_role: 'admin' }),
      expect.objectContaining({ audience_role: 'sub_admin' }),
    ])
    expect(inserts[2].payload).toMatchObject({ event_type: 'pdf_generated', unit_id: seedUnits[0].id })
  })

})
