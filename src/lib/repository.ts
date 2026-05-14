import type { SupabaseClient } from '@supabase/supabase-js'
import { toSafeUnitViewModel, toUnitInsertPayload, toUnitUpdatePayload, toUnitViewModel, type SafeUnitRpcRow, type SupabaseUnitRow } from './supabaseMapper'
import type { CreateUnitInput, LeadraUnit, LeadraUser, UnitEditInput, UnitFilters, UnitStatus } from './types'

const unitSelect = `
  *,
  developer:lookup_values!units_developer_id_fkey(label),
  project:lookup_values!units_project_id_fkey(label),
  destination:lookup_values!units_destination_id_fkey(label),
  view:lookup_values!units_view_id_fkey(label),
  creator:profiles!units_created_by_fkey(full_name),
  unit_media(*),
  unit_notes(*, creator:profiles!unit_notes_created_by_fkey(full_name))
`
const unitListLimit = 500

export class LeadraRepository {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async listUnits(): Promise<LeadraUnit[]> {
    const { data, error } = await this.client.rpc('list_units_safe', {
      limit_count: unitListLimit,
      offset_count: 0,
    })

    if (error) throw error
    return ((data ?? []) as unknown as SafeUnitRpcRow[])
      .map(toSafeUnitViewModel)
      .filter((unit) => !unit.archived)
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
  }

  async searchUnits(filters: UnitFilters): Promise<LeadraUnit[]> {
    const { data, error } = await this.client.rpc('search_units_safe', {
      filters: compactUnitFilters(filters),
      limit_count: unitListLimit,
      offset_count: 0,
    })

    if (error) throw error
    return ((data ?? []) as unknown as SafeUnitRpcRow[])
      .map(toSafeUnitViewModel)
      .filter((unit) => !unit.archived)
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
  }

  async createUnit(actor: LeadraUser, input: CreateUnitInput): Promise<LeadraUnit> {
    const { data, error } = await this.client
      .from('units')
      .insert(toUnitInsertPayload(input, actor))
      .select(unitSelect)
      .single()

    if (error) throw error
    return toUnitViewModel(data as unknown as SupabaseUnitRow)
  }

  async updateUnitDetails(
    actor: LeadraUser,
    unitId: number,
    input: UnitEditInput,
    permissions: { canEditOwner: boolean; canEditPricing: boolean; canEditCommission: boolean },
  ): Promise<LeadraUnit> {
    void actor
    const { data, error } = await this.client
      .from('units')
      .update(toUnitUpdatePayload(input, permissions))
      .eq('id', unitId)
      .select(unitSelect)
      .single()

    if (error) throw error
    return toUnitViewModel(data as unknown as SupabaseUnitRow)
  }

  async archiveUnit(unitId: number): Promise<void> {
    const { error } = await this.client.from('units').update({ archived: true }).eq('id', unitId)
    if (error) throw error
  }

  async updateUnitStatus(unitId: number, status: UnitStatus): Promise<void> {
    const { error } = await this.client.from('units').update({ status }).eq('id', unitId)
    if (error) throw error
  }

  async deleteUnitMedia(mediaId: string): Promise<void> {
    const { error } = await this.client.from('unit_media').delete().eq('id', mediaId)
    if (error) throw error
  }

  async deleteSalesRepresentativeAfterReassignment(salesUserId: string, replacement: LeadraUser, actor: LeadraUser): Promise<void> {
    void actor
    const { error } = await this.client.rpc('deactivate_sales_representative_after_reassignment', {
      target_sales_user_id: salesUserId,
      replacement_sales_user_id: replacement.id,
    })

    if (error) throw error
  }

  async deleteManagedUser(userId: string): Promise<void> {
    const { error } = await this.client
      .from('profiles')
      .update({ status: 'inactive' })
      .eq('id', userId)

    if (error) throw error
  }

  async generateUnitPdf(unitId: number): Promise<Blob> {
    void unitId
    throw new Error('The generate-unit-pdf edge function is retired. Use the localized printable brief export in the web client.')
  }
}

function compactUnitFilters(filters: UnitFilters): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== '' && value !== 'all'),
  )
}
