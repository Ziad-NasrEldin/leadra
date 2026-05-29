import type { SupabaseClient } from '@supabase/supabase-js'
import { validateMediaUpload } from './domain'
import { throwFunctionError } from './functionErrors'
import { compactUnitFilters, createUnitRemoteError, isMissingAtomicCreateRpc, matchesUnitFilters } from './repositoryHelpers'
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
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
    return this.withSignedMediaUrls(await this.withPaymentRecords(units))
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
      .filter((unit) => matchesUnitFilters(unit, filters))
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
    return this.withSignedMediaUrls(await this.withPaymentRecords(units))
  }

  async createUnit(actor: LeadraUser, input: CreateUnitInput): Promise<LeadraUnit> {
    const mediaValidation = validateMediaUpload(input.media)
    if (!mediaValidation.ok) {
      throw new Error(mediaValidation.message ?? 'Upload failed. Invalid media upload.')
    }
    const media = input.media.filter((file) => file.type === 'image' || file.type === 'pdf')
    const mediaPayload = await Promise.all(media.map((file) => this.toStoredMediaInsertPayload(file, actor)))
    const { data: createdUnitId, error } = await this.client.rpc('create_unit_with_media', {
      unit_payload: toUnitInsertPayload(input, actor),
      media_payload: mediaPayload,
    })

    if (isMissingAtomicCreateRpc(error)) {
      return this.createUnitWithoutAtomicRpc(actor, input, media)
    }
    if (error) throw error
    try {
      return await this.loadCreatedUnit(createdUnitId as number)
    } catch (loadError) {
      throw createUnitRemoteError('reload', loadError)
    }
  }

  private async createUnitWithoutAtomicRpc(actor: LeadraUser, input: CreateUnitInput, media: CreateUnitInput['media']): Promise<LeadraUnit> {
    const { data: createdUnit, error: createError } = await this.client
      .from('units')
      .insert(toUnitInsertPayload(input, actor))
      .select('id')
      .single()

    if (createError) throw createError
    const createdUnitId = (createdUnit as { id: number }).id

    if (media.length > 0) {
      const mediaPayload = media.map((file) => {
        const mediaInsert = toMediaInsertPayload(file)
        const payload = {
          type: mediaInsert.type,
          storage_path: mediaInsert.storage_path,
          file_name: mediaInsert.file_name,
          size_bytes: mediaInsert.size_bytes,
        }
        return { ...payload, unit_id: createdUnitId }
      })
      const { error: mediaError } = await this.client.from('unit_media').insert(mediaPayload)
      if (mediaError) {
        const rollbackError = await this.deleteCreatedUnitAfterMediaFailure(createdUnitId)
        throw createUnitRemoteError('media', mediaError, rollbackError)
      }
    }

    try {
      return await this.loadCreatedUnit(createdUnitId)
    } catch (error) {
      throw createUnitRemoteError('reload', error)
    }
  }

  private async deleteCreatedUnitAfterMediaFailure(unitId: number): Promise<unknown> {
    try {
      const { error } = await this.client.from('units').delete().eq('id', unitId)
      return error ?? null
    } catch (error) {
      return error
    }
  }

  private async loadCreatedUnit(unitId: number): Promise<LeadraUnit> {
    const { data, error } = await this.client.rpc('list_units_safe', {
      limit_count: unitListLimit,
      offset_count: 0,
    })

    if (error) throw error
    const unit = ((data ?? []) as unknown as SafeUnitRpcRow[])
      .map(toSafeUnitViewModel)
      .find((item) => item.id === unitId && !item.archived)
    if (!unit) throw new Error('Created unit was not visible after save.')
    return (await this.withSignedMediaUrls(await this.withPaymentRecords([unit])))[0]
  }

  async updateUnitDetails(
    actor: LeadraUser,
    unitId: number,
    input: UnitEditInput,
    permissions: { canEditOwner: boolean; canEditPricing: boolean; canEditCommission: boolean },
  ): Promise<LeadraUnit> {
    void actor
    const { error } = await this.client
      .from('units')
      .update(toUnitUpdatePayload(input, permissions))
      .eq('id', unitId)

    if (error) throw error
    return this.loadCreatedUnit(unitId)
  }

  async archiveUnit(unitId: number): Promise<void> {
    const { error } = await this.client.from('units').update({ archived: true }).eq('id', unitId)
    if (error) throw error
  }

  async updateUnitStatus(unitId: number, status: UnitStatus): Promise<void> {
    const { error } = await this.client.from('units').update({ status }).eq('id', unitId)
    if (error) throw error
  }

  async setUnitSpecial(unitId: number, special: boolean): Promise<LeadraUnit> {
    const { error } = await this.client.rpc('set_unit_special', {
      target_unit_id: unitId,
      mark_special: special,
    })
    if (error) throw error
    return this.loadCreatedUnit(unitId)
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

  async reconcileDueUnitPayments(): Promise<void> {
    const { error } = await this.client.rpc('reconcile_due_unit_payments')
    if (error) throw error
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
        userId: salesUserId,
        replacementUserId: replacement.id,
      },
    })

    if (error) await throwFunctionError(error, 'User could not be deactivated.')
    if (!data?.ok) throw new Error(data?.error ?? 'User could not be deactivated.')
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

  private async toStoredMediaInsertPayload(file: CreateUnitInput['media'][number], actor: LeadraUser) {
    const payload = toMediaInsertPayload(file)
    if (!file.url.startsWith('data:') || !('storage' in this.client)) return payload

    const extension = file.type === 'pdf' ? 'pdf' : mediaExtension(file.name, file.url)
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || `media.${extension}`
    const path = `pending/${actor.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`
    const blob = await fetch(file.url).then((response) => response.blob())
    const { error } = await this.client.storage.from('unit-media').upload(path, blob, {
      contentType: blob.type || (file.type === 'pdf' ? 'application/pdf' : `image/${extension}`),
      upsert: false,
    })
    if (error) throw error
    return { ...payload, storage_path: path }
  }

  private async withSignedMediaUrls(units: LeadraUnit[]): Promise<LeadraUnit[]> {
    return Promise.all(units.map((unit) => this.withSignedMediaUrlsForUnit(unit)))
  }

  private async withSignedMediaUrlsForUnit(unit: LeadraUnit): Promise<LeadraUnit> {
    if (!('storage' in this.client) || unit.media.length === 0) return unit
    const media = await Promise.all(unit.media.map(async (file) => {
      if (isRenderableMediaUrl(file.url)) return file
      const { data, error } = await this.client.storage.from('unit-media').createSignedUrl(file.url, 60 * 60)
      return error || !data?.signedUrl ? file : { ...file, url: data.signedUrl }
    }))
    return { ...unit, media }
  }
}

function isRenderableMediaUrl(url: string): boolean {
  return url.startsWith('data:') || url.startsWith('http:') || url.startsWith('https:') || url.startsWith('blob:')
}

function mediaExtension(fileName: string, url: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (extension && /^[a-z0-9]+$/.test(extension)) return extension
  if (url.startsWith('data:image/jpeg')) return 'jpg'
  if (url.startsWith('data:image/webp')) return 'webp'
  return 'png'
}
