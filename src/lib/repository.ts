import type { SupabaseClient } from '@supabase/supabase-js'
import {
  toPaymentHistoryViewModel,
  toPaymentScheduleViewModel,
  toSafeUnitViewModel,
  toMediaInsertPayload,
  toUnitInsertPayload,
  toUnitUpdatePayload,
  toUnitViewModel,
  type SafeUnitRpcRow,
  type SupabasePaymentHistoryRow,
  type SupabasePaymentScheduleRow,
  type SupabaseUnitRow,
} from './supabaseMapper'
import type { CreateUnitInput, LeadraUnit, LeadraUser, UnitEditInput, UnitFilters, UnitStatus } from './types'

const unitSelect = `
  *,
  developer:lookup_values!units_developer_id_fkey(label),
  project:lookup_values!units_project_id_fkey(label),
  destination:lookup_values!units_destination_id_fkey(label),
  view:lookup_values!units_view_id_fkey(label),
  creator:profiles!units_created_by_fkey(full_name),
  unit_media(*),
  unit_notes(*, creator:profiles!unit_notes_created_by_fkey(full_name)),
  unit_payment_schedule(*, paid_by_profile:profiles!unit_payment_schedule_paid_by_fkey(full_name)),
  unit_payment_history(*, actor_profile:profiles!unit_payment_history_actor_id_fkey(full_name))
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
    const units = ((data ?? []) as unknown as SafeUnitRpcRow[])
      .map(toSafeUnitViewModel)
      .filter((unit) => !unit.archived)
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
    return this.withPaymentRecords(units)
  }

  async searchUnits(filters: UnitFilters): Promise<LeadraUnit[]> {
    const { data, error } = await this.client.rpc('search_units_safe', {
      filters: compactUnitFilters(filters),
      limit_count: unitListLimit,
      offset_count: 0,
    })

    if (error) throw error
    const units = ((data ?? []) as unknown as SafeUnitRpcRow[])
      .map(toSafeUnitViewModel)
      .filter((unit) => !unit.archived)
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
    return this.withPaymentRecords(units)
  }

  async createUnit(actor: LeadraUser, input: CreateUnitInput): Promise<LeadraUnit> {
    const { data, error } = await this.client
      .from('units')
      .insert(toUnitInsertPayload(input, actor))
      .select(unitSelect)
      .single()

    if (error) throw error
    const unit = toUnitViewModel(data as unknown as SupabaseUnitRow)
    const media = input.media.filter((file) => file.type === 'image' || file.type === 'pdf')
    if (media.length === 0) return unit

    const { error: mediaError } = await this.client
      .from('unit_media')
      .insert(media.map((file) => toMediaInsertPayload(unit.id, file)))
    if (mediaError) throw mediaError

    const { data: mediaData, error: reloadError } = await this.client
      .from('units')
      .select(unitSelect)
      .eq('id', unit.id)
      .single()

    if (reloadError) throw reloadError
    return toUnitViewModel(mediaData as unknown as SupabaseUnitRow)
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

  async updatePaymentSchedule(unitId: number, scheduleId: string, paid: boolean): Promise<LeadraUnit> {
    const { error } = await this.client.rpc('set_unit_payment_paid', {
      target_unit_id: unitId,
      target_schedule_id: scheduleId,
      mark_paid: paid,
    })
    if (error) throw error
    const { data, error: loadError } = await this.client
      .from('units')
      .select(unitSelect)
      .eq('id', unitId)
      .single()
    if (loadError) throw loadError
    return toUnitViewModel(data as unknown as SupabaseUnitRow)
  }

  async deleteUnitMedia(mediaId: string): Promise<void> {
    const { error } = await this.client.from('unit_media').delete().eq('id', mediaId)
    if (error) throw error
  }

  async updateUnitMediaPdfVisibility(mediaId: string, includeInPdf: boolean): Promise<void> {
    const { error } = await this.client
      .from('unit_media')
      .update({ include_in_pdf: includeInPdf })
      .eq('id', mediaId)
      .eq('type', 'image')
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

  private async withPaymentRecords(units: LeadraUnit[]): Promise<LeadraUnit[]> {
    if (units.length === 0) return units
    const unitIds = units.map((unit) => unit.id)
    const [scheduleResult, historyResult] = await Promise.all([
      this.client
        .from('unit_payment_schedule')
        .select('*, paid_by_profile:profiles!unit_payment_schedule_paid_by_fkey(full_name)')
        .in('unit_id', unitIds)
        .order('payment_number'),
      this.client
        .from('unit_payment_history')
        .select('*, actor_profile:profiles!unit_payment_history_actor_id_fkey(full_name)')
        .in('unit_id', unitIds)
        .order('created_at', { ascending: false }),
    ])
    if (scheduleResult.error) throw scheduleResult.error
    if (historyResult.error) throw historyResult.error

    const scheduleByUnit = new Map<number, ReturnType<typeof toPaymentScheduleViewModel>[]>()
    for (const row of (scheduleResult.data ?? []) as unknown as SupabasePaymentScheduleRow[]) {
      const item = toPaymentScheduleViewModel(row)
      scheduleByUnit.set(item.unitId, [...(scheduleByUnit.get(item.unitId) ?? []), item])
    }

    const historyByUnit = new Map<number, ReturnType<typeof toPaymentHistoryViewModel>[]>()
    for (const row of (historyResult.data ?? []) as unknown as SupabasePaymentHistoryRow[]) {
      const item = toPaymentHistoryViewModel(row)
      historyByUnit.set(item.unitId, [...(historyByUnit.get(item.unitId) ?? []), item])
    }

    return units.map((unit) => ({
      ...unit,
      paymentSchedule: scheduleByUnit.get(unit.id) ?? unit.paymentSchedule,
      paymentHistory: historyByUnit.get(unit.id) ?? unit.paymentHistory,
    }))
  }
}

function compactUnitFilters(filters: UnitFilters): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== '' && value !== 'all'),
  )
}
