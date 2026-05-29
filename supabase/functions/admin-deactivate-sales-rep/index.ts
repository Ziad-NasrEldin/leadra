import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type UserRole = 'admin' | 'sub_admin' | 'manager' | 'sales'
type AccountStatus = 'active' | 'inactive'

type ProfileRow = {
  id: string
  role: UserRole
  status: AccountStatus
  team_id: string | null
  branch_id: string | null
  deleted_at: string | null
}

type DeactivateRequest = {
  salesUserId?: string
  replacementSalesUserId?: string
  userId?: string
  replacementUserId?: string
}

type AssignedUnitRow = {
  id: number
  team_id: string | null
  branch_id: string | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeUuid(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : ''
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, error: 'Auth administration is not configured.' }, 500)
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ ok: false, error: 'Unauthorized.' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const token = authorization.replace('Bearer ', '')
  const {
    data: { user: caller },
    error: authError,
  } = await userClient.auth.getUser(token)

  if (authError || !caller) return json({ ok: false, error: 'Unauthorized.' }, 401)

  const body = await request.json().catch(() => ({} as DeactivateRequest))
  const targetUserId = normalizeUuid(body.userId) || normalizeUuid(body.salesUserId)
  const replacementUserId = normalizeUuid(body.replacementUserId) || normalizeUuid(body.replacementSalesUserId)

  if (!targetUserId || !replacementUserId) {
    return json({ ok: false, error: 'Select a user to deactivate and an active replacement user.' }, 400)
  }

  if (targetUserId === replacementUserId) {
    return json({ ok: false, error: 'Replacement user must be different from the deactivated user.' }, 400)
  }

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('id, role, status, team_id, branch_id, deleted_at')
    .eq('id', caller.id)
    .single<ProfileRow>()

  if (callerProfileError || !callerProfile || callerProfile.status !== 'active' || callerProfile.deleted_at) {
    return json({ ok: false, error: 'Unauthorized.' }, 401)
  }

  if (!['admin', 'sub_admin'].includes(callerProfile.role)) {
    return json({ ok: false, error: 'Only Admin and Sub Admin can deactivate users.' }, 403)
  }

  const { data: targetProfile, error: targetError } = await adminClient
    .from('profiles')
    .select('id, role, status, team_id, branch_id, deleted_at')
    .eq('id', targetUserId)
    .single<ProfileRow>()

  if (targetError || !targetProfile || targetProfile.deleted_at) {
    return json({ ok: false, error: 'Select a user to deactivate.' }, 400)
  }

  if (targetProfile.role === 'admin') {
    return json({ ok: false, error: 'Admin accounts cannot be deactivated from user management.' }, 403)
  }

  const { data: replacementProfile, error: replacementError } = await adminClient
    .from('profiles')
    .select('id, role, status, team_id, branch_id, deleted_at')
    .eq('id', replacementUserId)
    .single<ProfileRow>()

  if (replacementError || !replacementProfile || replacementProfile.status !== 'active' || replacementProfile.deleted_at) {
    return json({ ok: false, error: 'Select an active replacement user.' }, 400)
  }

  const changedAt = new Date().toISOString()
  const { data: assignedUnits, error: unitsError } = await adminClient
    .from('units')
    .select('id, team_id, branch_id')
    .eq('created_by', targetUserId)
    .eq('archived', false)
    .returns<AssignedUnitRow[]>()

  if (unitsError) return json({ ok: false, error: unitsError.message }, 400)

  const historyRows = (assignedUnits ?? []).map((unit) => ({
    unit_id: unit.id,
    previous_sales_user_id: targetUserId,
    new_sales_user_id: replacementUserId,
    changed_by: caller.id,
    changed_at: changedAt,
    reason: 'user_deactivated_after_reassignment',
  }))

  if (historyRows.length > 0) {
    const { error: historyError } = await adminClient.from('unit_sales_assignment_history').insert(historyRows)
    if (historyError) return json({ ok: false, error: historyError.message }, 400)
  }

  for (const unit of assignedUnits ?? []) {
    const { error: unitsUpdateError } = await adminClient
      .from('units')
      .update({
        created_by: replacementUserId,
        team_id: replacementProfile.team_id ?? unit.team_id,
        branch_id: replacementProfile.branch_id ?? unit.branch_id,
        updated_at: changedAt,
      })
      .eq('id', unit.id)
    if (unitsUpdateError) return json({ ok: false, error: unitsUpdateError.message }, 400)
  }

  const { error: profileUpdateError } = await adminClient
    .from('profiles')
    .update({ status: 'inactive', deleted_at: changedAt })
    .eq('id', targetUserId)

  if (profileUpdateError) return json({ ok: false, error: profileUpdateError.message }, 400)

  await adminClient.from('audit_logs').insert({
    actor_id: caller.id,
    actor_role: callerProfile.role,
    action_type: 'User deactivated after reassignment',
    related_unit_id: null,
    previous_value: { user_id: targetUserId, assigned_units: historyRows.length },
    new_value: { replacement_user_id: replacementUserId, assigned_units: historyRows.length },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] ?? null,
  })

  return json({ ok: true, reassignedUnitCount: historyRows.length })
})
