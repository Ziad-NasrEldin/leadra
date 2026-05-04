import type { SupabaseClient } from '@supabase/supabase-js'
import { toSafeUnitViewModel, toUnitInsertPayload, toUnitViewModel, type SafeUnitRpcRow, type SupabaseUnitRow } from './supabaseMapper'
import type { CreateUnitInput, LeadraUnit, LeadraUser, UnitStatus } from './types'

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

  async createUnit(actor: LeadraUser, input: CreateUnitInput): Promise<LeadraUnit> {
    const { data, error } = await this.client
      .from('units')
      .insert(toUnitInsertPayload(input, actor))
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

  async generateUnitPdf(unitId: number): Promise<Blob> {
    void unitId
    throw new Error('The generate-unit-pdf edge function is retired. Use the localized printable brief export in the web client.')
  }
}
