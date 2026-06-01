import { describe, expect, it } from 'vitest'
import { demoUsers, seedUnits } from '../data/seed'
import { LeadraRepository } from './repository'
import type { SafeUnitRpcRow } from './supabaseMapper'
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

function safeUnitRpcRow(overrides: Partial<SafeUnitRpcRow> = {}): SafeUnitRpcRow {
  return {
    id: 101,
    unit_code: 'ZE4BR',
    developer_id: 'developer-1',
    developer_label: 'Ora',
    project_id: 'project-zed-east',
    project_label: 'Zed East',
    destination_id: 'dest-sheikh-zayed',
    destination_label: 'Sheikh Zayed',
    unit_type: 'Apartment',
    floor: '4th',
    bua: 180,
    roof_garden_area: null,
    garden_area: null,
    terrace_area: null,
    view_id: 'view-1',
    view_label: 'Garden',
    bedrooms: 4,
    bathrooms: 3,
    elevator: true,
    land_area: null,
    furnished: false,
    finish: 'Fully Finished',
    payment_method: 'cash',
    total_amount: 5_000_000,
    down_payment: null,
    remaining_payment: null,
    transfer_fees: null,
    maintenance_paid: false,
    maintenance_cost: null,
    maintenance_due_date: null,
    commission_percentage: 1.5,
    commission_amount: 75_000,
    installment_type: null,
    installment_years: null,
    installment_start_month: null,
    installment_end_month: null,
    custom_installment_text: null,
    installment_amount: null,
    delivery_month: null,
    delivery_year: 2029,
    original_owner_name: null,
    country_code: null,
    original_owner_phone: null,
    normalized_owner_phone: null,
    sales_notes: null,
    status: 'available',
    archived: false,
    is_special: false,
    special_marked_at: null,
    special_marked_by: null,
    created_by: 'sales-1',
    creator_full_name: 'Sales User',
    team_id: 'team-1',
    branch_id: 'branch-1',
    created_at: '2026-05-04T00:00:00.000Z',
    updated_at: '2026-05-04T01:00:00.000Z',
    unit_media: [],
    unit_notes: [],
    unit_payment_schedule: [],
    unit_payment_history: [],
    ...overrides,
  }
}

function emptyPaymentRecordQuery() {
  return {
    select() {
      return {
        in() {
          return {
            order() {
              return Promise.resolve({ data: [], error: null })
            },
          }
        },
      }
    },
  }
}

function createUnitInput(overrides: Partial<CreateUnitInput> = {}): CreateUnitInput {
  return {
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
    ...overrides,
  }
}

describe('LeadraRepository', () => {
  it('preserves archived units returned by safe listing for admin/sub-admin remote views', async () => {
    const client = {
      rpc(fn: string) {
        expect(fn).toBe('list_units_safe')
        return Promise.resolve({
          error: null,
          data: [
            safeUnitRpcRow({ id: 101, unit_code: 'ACTIVE', archived: false, created_at: '2026-05-04T00:00:00.000Z' }),
            safeUnitRpcRow({ id: 102, unit_code: 'ARCHIVED', archived: true, created_at: '2026-05-05T00:00:00.000Z' }),
          ],
        })
      },
      from(table: string) {
        expect(['unit_payment_schedule', 'unit_payment_history']).toContain(table)
        return {
          select() {
            return {
              in(column: string, values: number[]) {
                expect(column).toBe('unit_id')
                expect(values).toEqual([102, 101])
                return {
                  order() {
                    return Promise.resolve({ data: [], error: null })
                  },
                }
              },
            }
          },
        }
      },
    }

    const result = await new LeadraRepository(client as never).listUnits()

    expect(result.map((unit) => ({ code: unit.unitCode, archived: unit.archived }))).toEqual([
      { code: 'ARCHIVED', archived: true },
      { code: 'ACTIVE', archived: false },
    ])
  })

  it('preserves archived units returned by safe search while still applying requested filters', async () => {
    const client = {
      rpc(fn: string) {
        expect(fn).toBe('search_units_safe')
        return Promise.resolve({
          error: null,
          data: [
            safeUnitRpcRow({ id: 101, unit_code: 'ARCHIVED_MATCH', archived: true, project_id: 'project-zed-east' }),
            safeUnitRpcRow({ id: 102, unit_code: 'ARCHIVED_OTHER_PROJECT', archived: true, project_id: 'project-other' }),
          ],
        })
      },
      from(table: string) {
        expect(['unit_payment_schedule', 'unit_payment_history']).toContain(table)
        return {
          select() {
            return {
              in(column: string, values: number[]) {
                expect(column).toBe('unit_id')
                expect(values).toEqual([101])
                return {
                  order() {
                    return Promise.resolve({ data: [], error: null })
                  },
                }
              },
            }
          },
        }
      },
    }

    const result = await new LeadraRepository(client as never).searchUnits({ projectId: 'project-zed-east', status: 'all' })

    expect(result.map((unit) => ({ code: unit.unitCode, archived: unit.archived }))).toEqual([
      { code: 'ARCHIVED_MATCH', archived: true },
    ])
  })

  it('keeps remote unit search scoped to the requested project and destination', async () => {
    const calls: Array<{ fn: string; args: unknown }> = []
    const client = {
      rpc(fn: string, args: unknown) {
        calls.push({ fn, args })
        return Promise.resolve({
          error: null,
          data: [
            safeUnitRpcRow({ id: 101, unit_code: 'ZE4BR' }),
            safeUnitRpcRow({ id: 102, unit_code: 'NC3BR', project_id: 'project-new-cairo' }),
            safeUnitRpcRow({ id: 103, unit_code: 'SV3BR', destination_id: 'dest-new-cairo' }),
          ],
        })
      },
      from(table: string) {
        expect(['unit_payment_schedule', 'unit_payment_history']).toContain(table)
        return {
          select() {
            return {
              in(column: string, values: number[]) {
                expect(column).toBe('unit_id')
                expect(values).toEqual([101])
                return {
                  order() {
                    return Promise.resolve({ data: [], error: null })
                  },
                }
              },
            }
          },
        }
      },
    }

    const result = await new LeadraRepository(client as never).searchUnits({
      destinationId: 'dest-sheikh-zayed',
      projectId: 'project-zed-east',
      status: 'all',
    })

    expect(calls).toEqual([
      {
        fn: 'search_units_safe',
        args: {
          filters: { destinationId: 'dest-sheikh-zayed', projectId: 'project-zed-east' },
          limit_count: 500,
          offset_count: 0,
        },
      },
    ])
    expect(result.map((unit) => unit.unitCode)).toEqual(['ZE4BR'])
  })

  it('creates units through the atomic create RPC and uses the database-generated PRD code', async () => {
    const calls: Array<{ fn: string; args: unknown }> = []
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
      media: [
        {
          id: 'local-image',
          type: 'image',
          url: 'data:image/png;base64,abc',
          name: 'living-room.png',
          sizeBytes: 1024,
          includeInPdf: false,
        },
        {
          id: 'local-pdf',
          type: 'pdf',
          url: 'data:application/pdf;base64,abc',
          name: 'floor-plan.pdf',
          sizeBytes: 2048,
          includeInPdf: true,
        },
      ],
    }
    const client = {
      rpc(fn: string, args: unknown) {
        calls.push({ fn, args })
        if (fn === 'create_unit_with_media') return Promise.resolve({ error: null, data: 105 })
        if (fn === 'list_units_safe') {
          return Promise.resolve({
            error: null,
            data: [
              safeUnitRpcRow({
                id: 105,
                unit_code: 'MV3BR',
                developer_id: 'dev-1',
                developer_label: 'Palm Hills',
                project_id: 'project-1',
                project_label: 'Mountain View',
                destination_id: 'dest-1',
                destination_label: 'New Cairo',
                unit_type: 'Apartment',
                floor: '3rd',
                bua: 188,
                view_id: 'view-1',
                view_label: 'Garden',
                bedrooms: 3,
                bathrooms: 2,
                finish: 'Fully Finished',
                total_amount: 5_500_000,
                commission_amount: 82_500,
                original_owner_name: 'Owner',
                country_code: '+20',
                original_owner_phone: '01033334444',
                normalized_owner_phone: '+201033334444',
                sales_notes: 'Updated notes.',
                created_by: 'sales-replacement',
                creator_full_name: 'Replacement Sales',
                team_id: 'team-b',
                branch_id: 'branch-b',
              }),
            ],
          })
        }
        throw new Error(`Unexpected RPC ${fn}`)
      },
      from(table: string) {
        expect(['unit_payment_schedule', 'unit_payment_history']).toContain(table)
        return {
          select() {
            return {
              in(column: string, value: number[]) {
                expect(column).toBe('unit_id')
                expect(value).toEqual([105])
                return {
                  order() {
                    return Promise.resolve({ error: null, data: [] })
                  }
                }
              },
            }
          },
        }
      },
    }

    const result = await new LeadraRepository(client as never).createUnit(salesUser(), input)

    expect(calls).toHaveLength(2)
    expect(calls[0].fn).toBe('create_unit_with_media')
    expect(calls[1]).toEqual({ fn: 'list_units_safe', args: { limit_count: 500, offset_count: 0 } })
    expect(calls[0].args).toMatchObject({
      unit_payload: {
        developer_id: 'dev-1',
        project_id: 'project-1',
        created_by: 'sales-replacement',
      },
      media_payload: [
        {
          type: 'image',
          storage_path: 'data:image/png;base64,abc',
          file_name: 'living-room.png',
          size_bytes: 1024,
          include_in_pdf: false,
        },
        {
          type: 'pdf',
          storage_path: 'data:application/pdf;base64,abc',
          file_name: 'floor-plan.pdf',
          size_bytes: 2048,
          include_in_pdf: false,
        },
      ],
    })
    expect(calls[0].args).not.toMatchObject({ unit_payload: { unit_code: expect.anything() } })
    expect(result.unitCode).toBe('MV3BR')
    expect(result.unitCode).not.toContain('Ba')
    expect(result.unitCode).not.toContain(String(result.id))
  })

  it('updates unit details through the guarded RPC instead of direct table updates', async () => {
    const calls: Array<{ fn: string; args: unknown }> = []
    const input: UnitEditInput = {
      ...createUnitInput(),
      commissionPercentage: 2,
    }
    const client = {
      rpc(fn: string, args: unknown) {
        calls.push({ fn, args })
        if (fn === 'update_unit_details') return Promise.resolve({ error: null, data: null })
        if (fn === 'list_units_safe') return Promise.resolve({ error: null, data: [safeUnitRpcRow({ id: 101, bedrooms: 4, commission_percentage: 2 })] })
        throw new Error(`unexpected rpc ${fn}`)
      },
      from(table: string) {
        expect(['unit_payment_schedule', 'unit_payment_history']).toContain(table)
        return emptyPaymentRecordQuery()
      },
    }

    const result = await new LeadraRepository(client as never).updateUnitDetails(salesUser(), 101, input, {
      canEditOwner: true,
      canEditPricing: true,
      canEditCommission: true,
    })

    expect(calls[0]).toMatchObject({
      fn: 'update_unit_details',
      args: {
        target_unit_id: 101,
        unit_payload: expect.objectContaining({
          bedrooms: 3,
          original_owner_name: 'Owner',
          total_amount: 5_500_000,
          commission_percentage: 2,
        }),
      },
    })
    expect(result.commissionPercentage).toBe(2)
  })

  it('does not reload a unit when atomic create RPC fails with an unrelated error', async () => {
    const createError = { code: '42501', message: 'permission denied for table units' }
    const client = {
      rpc() {
        return Promise.resolve({ error: createError, data: null })
      },
      from() {
        throw new Error('reload should not run after create failure')
      },
    }

    await expect(new LeadraRepository(client as never).createUnit(salesUser(), createUnitInput())).rejects.toBe(createError)
  })

  it('falls back to direct inserts when the atomic create RPC is missing from PostgREST cache', async () => {
    const calls: Array<{ table: string; payload?: unknown }> = []
    const input = createUnitInput()
    const client = {
      rpc(fn: string) {
        if (fn === 'list_units_safe') {
          return Promise.resolve({
            error: null,
            data: [safeUnitRpcRow({ id: 105, unit_code: 'MV3BR' })],
          })
        }
        return Promise.resolve({
          error: {
            code: 'PGRST202',
            message: 'Could not find the function public.create_unit_with_media(media_payload, unit_payload) in the schema cache',
          },
          data: null,
        })
      },
      from(table: string) {
        return {
          insert(payload: unknown) {
            calls.push({ table, payload })
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ error: null, data: { id: 105 } })
                  },
                }
              },
            }
          },
          select() {
            return {
              in() {
                return {
                  order() {
                    return Promise.resolve({ error: null, data: [] })
                  },
                }
              },
            }
          },
        }
      },
    }

    const result = await new LeadraRepository(client as never).createUnit(salesUser(), input)

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ table: 'units' })
    expect(result.id).toBe(105)
  })

  it('rejects unsupported media before calling the atomic create RPC', async () => {
    const client = {
      rpc() {
        throw new Error('rpc should not run with unsupported media')
      },
    }

    await expect(new LeadraRepository(client as never).createUnit(salesUser(), createUnitInput({
      media: [{ id: 'video-1', type: 'video', url: '/tour.mp4', name: 'tour.mp4', sizeBytes: 1024 }],
    }))).rejects.toThrow('Videos are not allowed')
  })

  it('rejects PDF-only media before calling the atomic create RPC', async () => {
    const client = {
      rpc() {
        throw new Error('rpc should not run with invalid media')
      },
    }

    await expect(new LeadraRepository(client as never).createUnit(salesUser(), createUnitInput({
      media: [{ id: 'pdf-1', type: 'pdf', url: '/plan.pdf', name: 'plan.pdf', sizeBytes: 1024 }],
    }))).rejects.toThrow('A PDF attachment requires at least one related photo')
  })

  it('rolls back the direct unit insert when fallback media insert fails', async () => {
    const calls: string[] = []
    const mediaError = { code: '23514', message: 'violates check constraint on unit_media' }
    const client = {
      rpc() {
        return Promise.resolve({
          error: {
            code: 'PGRST202',
            message: 'Could not find the function public.create_unit_with_media(media_payload, unit_payload) in the schema cache',
          },
          data: null,
        })
      },
      from(table: string) {
        return {
          insert() {
            calls.push(`insert:${table}`)
            if (table === 'unit_media') return Promise.resolve({ error: mediaError })
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ error: null, data: { id: 105 } })
                  },
                }
              },
            }
          },
          delete() {
            calls.push(`delete:${table}`)
            return {
              eq(column: string, value: number) {
                expect(column).toBe('id')
                expect(value).toBe(105)
                return Promise.resolve({ error: null })
              },
            }
          },
        }
      },
    }

    await expect(new LeadraRepository(client as never).createUnit(salesUser(), createUnitInput({
      media: [{ id: 'image-1', type: 'image', url: '/living.png', name: 'living.png', sizeBytes: 1024 }],
    }))).rejects.toThrow('Unit media attachments could not be saved')
    expect(calls).toEqual(['insert:units', 'insert:unit_media', 'delete:units'])
  })

  it('surfaces reload failures separately after atomic create succeeds', async () => {
    const reloadError = new Error('created unit could not be reloaded')
    const client = {
      rpc() {
        return Promise.resolve({ error: null, data: 105 })
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
                    return Promise.resolve({ error: reloadError, data: null })
                  },
                }
              },
            }
          },
        }
      },
    }

    await expect(new LeadraRepository(client as never).createUnit(salesUser(), createUnitInput())).rejects.toThrow('Unit was created but could not be loaded')
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
      rpc(fn: string, args: unknown) {
        if (fn === 'update_unit_details') {
          updates.push(args)
          return Promise.resolve({ error: null, data: null })
        }
        expect(fn).toBe('list_units_safe')
        expect(args).toEqual({ limit_count: 500, offset_count: 0 })
        return Promise.resolve({
          error: null,
          data: [
            safeUnitRpcRow({
              id: 105,
              unit_code: 'NC3BR',
              developer_id: 'dev-1',
              developer_label: 'Palm Hills',
              project_id: 'project-1',
              project_label: 'New Cairo Estates',
              destination_id: 'dest-1',
              destination_label: 'New Cairo',
              bua: 188,
              total_amount: 5_500_000,
              original_owner_name: 'Updated Owner',
              original_owner_phone: '01033334444',
            }),
          ],
        })
      },
      from(table: string) {
        expect(['unit_payment_schedule', 'unit_payment_history']).toContain(table)
        return emptyPaymentRecordQuery()
      },
    }

    const result = await new LeadraRepository(client as never).updateUnitDetails(salesUser(), 105, input, {
      canEditOwner: true,
      canEditPricing: true,
      canEditCommission: false,
    })

    expect(result.bua).toBe(188)
    expect(updates[0]).toMatchObject({
      target_unit_id: 105,
      unit_payload: { bua: 188, total_amount: 5_500_000, original_owner_phone: '01033334444' },
    })
    expect(updates[0]).not.toMatchObject({ unit_payload: expect.objectContaining({ remaining_payment: expect.anything() }) })
    expect(updates[0]).not.toMatchObject({ unit_payload: expect.objectContaining({ payment_method: expect.anything() }) })
    expect(updates[0]).not.toMatchObject({ unit_payload: expect.objectContaining({ commission_percentage: expect.anything() }) })
  })

  it('persists authorized payment method changes to cash while leaving remaining value to database triggers', async () => {
    const updates: unknown[] = []
    const input: UnitEditInput = {
      ...createUnitInput({ paymentMethod: 'cash', downPayment: null, installmentType: null }),
      deliveryExpectancy: { mode: 'year', year: 2029 },
      commissionPercentage: 1.5,
    }
    const client = {
      rpc(fn: string, args: unknown) {
        if (fn === 'update_unit_details') {
          updates.push(args)
          return Promise.resolve({ error: null, data: null })
        }
        expect(fn).toBe('list_units_safe')
        expect(args).toEqual({ limit_count: 500, offset_count: 0 })
        return Promise.resolve({
          error: null,
          data: [
            safeUnitRpcRow({
              id: 105,
              payment_method: 'cash',
              down_payment: null,
              remaining_payment: null,
              installment_type: null,
              installment_amount: null,
            }),
          ],
        })
      },
      from(table: string) {
        expect(['unit_payment_schedule', 'unit_payment_history']).toContain(table)
        return emptyPaymentRecordQuery()
      },
    }

    await new LeadraRepository(client as never).updateUnitDetails(salesUser(), 105, input, {
      canEditOwner: true,
      canEditPricing: true,
      canEditCommission: false,
    })

    expect(updates[0]).toMatchObject({ target_unit_id: 105, unit_payload: { payment_method: 'cash', down_payment: null } })
    expect(updates[0]).not.toMatchObject({ unit_payload: expect.objectContaining({ remaining_payment: expect.anything() }) })
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

  it('persists unit archive with a write-only update under the safe units permission model', async () => {
    const updates: unknown[] = []
    const filters: Array<{ column: string; value: number }> = []
    const client = {
      from(table: string) {
        expect(table).toBe('units')
        return {
          update(payload: unknown) {
            updates.push(payload)
            return {
              eq(column: string, value: number) {
                filters.push({ column, value })
                return Promise.resolve({ error: null, data: null })
              },
            }
          },
        }
      },
    }

    await new LeadraRepository(client as never).archiveUnit(105)

    expect(updates).toEqual([{ archived: true }])
    expect(filters).toEqual([{ column: 'id', value: 105 }])
  })

  it('persists shared special unit state through the protected RPC and reloads the unit', async () => {
    const calls: Array<{ fn: string; args: unknown }> = []
    const client = {
      rpc(fn: string, args: unknown) {
        calls.push({ fn, args })
        if (fn === 'list_units_safe') {
          return Promise.resolve({
            error: null,
            data: [safeUnitRpcRow({
              id: 105,
              is_special: true,
              special_marked_at: '2026-05-05T00:00:00.000Z',
              special_marked_by: 'admin-1',
            })],
          })
        }
        return Promise.resolve({ error: null })
      },
      from(table: string) {
        expect(['unit_payment_schedule', 'unit_payment_history']).toContain(table)
        return {
          select() {
            return {
              in() {
                return {
                  order() {
                    return Promise.resolve({ error: null, data: [] })
                  },
                }
              },
            }
          },
        }
      },
    }

    const result = await new LeadraRepository(client as never).setUnitSpecial(105, true)

    expect(calls).toEqual([
      { fn: 'set_unit_special', args: { target_unit_id: 105, mark_special: true } },
      { fn: 'list_units_safe', args: { limit_count: 500, offset_count: 0 } },
    ])
    expect(result).toMatchObject({ id: 105, isSpecial: true, specialMarkedBy: 'admin-1' })
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
                        is_special: false,
                        special_marked_at: null,
                        special_marked_by: null,
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

  it('delegates due payment reconciliation to the Supabase RPC', async () => {
    const calls: Array<{ fn: string; args?: unknown }> = []
    const client = {
      rpc(fn: string, args?: unknown) {
        calls.push({ fn, args })
        return Promise.resolve({ data: 2, error: null })
      },
    }

    await new LeadraRepository(client as never).reconcileDueUnitPayments()

    expect(calls).toEqual([{ fn: 'reconcile_due_unit_payments', args: undefined }])
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
          userId: 'sales-old',
          replacementUserId: 'sales-new',
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
