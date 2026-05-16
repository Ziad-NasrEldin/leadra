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
import type { AnalyticsEventType, CreateUnitInput, LeadraUnit, LeadraUser, MessageParams, UnitEditInput, UnitFilters, UnitStatus, UserRole } from './types'

type FunctionErrorBody = { error?: string; message?: string }

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
      .filter((unit) => matchesUnitFilters(unit, filters))
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

  async recordPdfAction(
    actor: LeadraUser,
    unit: LeadraUnit,
    eventType: AnalyticsEventType,
    audit: { text: string; messageKey?: string | null; messageParams?: MessageParams | null },
    notification: {
      title: { text: string; messageKey?: string | null; messageParams?: MessageParams | null }
      body: { text: string; messageKey?: string | null; messageParams?: MessageParams | null }
    },
    audienceRoles: UserRole[],
  ): Promise<void> {
    const [auditResult, notificationResult, analyticsResult] = await Promise.all([
      this.client.from('audit_logs').insert({
        actor_id: actor.id,
        actor_role: actor.role,
        action_type: audit.text,
        message_key: audit.messageKey ?? null,
        message_params: audit.messageParams ?? null,
        related_unit_id: unit.id,
      }),
      this.client.from('notifications').insert(audienceRoles.map((role) => ({
        audience_role: role,
        title: notification.title.text,
        body: notification.body.text,
        message_key: notification.body.messageKey ?? null,
        message_params: notification.body.messageParams ?? null,
      }))),
      this.client.from('analytics_events').insert({
        event_type: eventType,
        actor_id: actor.id,
        actor_role: actor.role,
        team_id: actor.teamId || null,
        branch_id: actor.branchId || null,
        unit_id: unit.id,
        project_id: unit.projectId,
        developer_id: unit.developerId,
        destination_id: unit.destinationId,
        amount_value: unit.totalAmount,
        commission_value: unit.commissionAmount,
        metadata: { unitCode: unit.unitCode },
      }),
    ])

    if (auditResult.error) throw auditResult.error
    if (notificationResult.error) throw notificationResult.error
    if (analyticsResult.error) throw analyticsResult.error
  }

  async deleteSalesRepresentativeAfterReassignment(salesUserId: string, replacement: LeadraUser, actor: LeadraUser): Promise<void> {
    void actor
    const { data, error } = await this.client.functions.invoke<{ ok: boolean; error?: string }>('admin-deactivate-sales-rep', {
      body: {
        salesUserId,
        replacementSalesUserId: replacement.id,
      },
    })

    if (error) await throwFunctionError(error, 'Sales representative could not be deactivated.')
    if (!data?.ok) throw new Error(data?.error ?? 'Sales representative could not be deactivated.')
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

async function throwFunctionError(error: unknown, fallback: string): Promise<never> {
  const baseMessage = error instanceof Error ? error.message : fallback
  const context = typeof error === 'object' && error && 'context' in error
    ? (error as { context?: unknown }).context
    : null

  if (context instanceof Response) {
    const response = context.clone()
    const contentType = response.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      try {
        const body = await response.json() as FunctionErrorBody
        const message = body.error ?? body.message
        if (message) throw new Error(message)
      } catch (parseError) {
        if (parseError instanceof Error && parseError.name === 'Error') throw parseError
      }
    } else {
      const text = await response.text().catch(() => '')
      if (text.trim()) throw new Error(text.trim())
    }
  }

  throw new Error(baseMessage)
}

function compactUnitFilters(filters: UnitFilters): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== '' && value !== 'all'),
  )
}

function matchesUnitFilters(unit: LeadraUnit, filters: UnitFilters): boolean {
  if (filters.projectId && unit.projectId !== filters.projectId) return false
  if (filters.destinationId && unit.destinationId !== filters.destinationId) return false
  if (filters.status && filters.status !== 'all' && unit.status !== filters.status) return false
  if (filters.developerId && unit.developerId !== filters.developerId) return false
  if (filters.unitType && unit.unitType !== filters.unitType) return false
  if (filters.bedrooms && filters.bedrooms !== 'all' && unit.bedrooms !== filters.bedrooms) return false
  if (filters.bathrooms && filters.bathrooms !== 'all' && unit.bathrooms !== filters.bathrooms) return false
  if (filters.paymentMethod && filters.paymentMethod !== 'all' && unit.paymentMethod !== filters.paymentMethod) return false
  if (filters.deliveryYear && filters.deliveryYear !== 'all' && unit.deliveryExpectancy.year !== filters.deliveryYear) return false
  if (filters.deliveryMonth && filters.deliveryMonth !== 'all' && unit.deliveryExpectancy.month !== filters.deliveryMonth) return false
  if (filters.unitCode && !unit.unitCode.toLowerCase().includes(filters.unitCode.toLowerCase())) return false
  if (!matchesRange(unit.bua, filters.buaFrom, filters.buaTo)) return false
  if (!matchesRange(unit.landArea, filters.landAreaFrom, filters.landAreaTo)) return false
  if (!matchesRange(unit.gardenArea, filters.gardenAreaFrom, filters.gardenAreaTo)) return false
  if (!matchesRange(unit.terraceArea, filters.terraceAreaFrom, filters.terraceAreaTo)) return false
  if (!matchesRange(unit.totalAmount, filters.priceFrom, filters.priceTo)) return false
  if (!matchesRange(unit.paymentMethod === 'cash' ? unit.totalAmount : null, filters.cashPriceFrom, filters.cashPriceTo)) return false
  if (!matchesRange(unit.downPayment, filters.downPaymentFrom, filters.downPaymentTo)) return false
  if (!matchesRange(unit.remainingPayment, filters.remainingPaymentFrom, filters.remainingPaymentTo)) return false
  if (filters.installmentType && filters.installmentType !== 'all' && unit.installmentType !== filters.installmentType) return false
  if (!matchesRange(unit.installmentAmount, filters.installmentAmountFrom, filters.installmentAmountTo)) return false
  return true
}

function matchesRange(value: number | null, from?: number, to?: number): boolean {
  if (from !== undefined && (value === null || value < from)) return false
  if (to !== undefined && (value === null || value > to)) return false
  return true
}
