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
  const salesUserId = normalizeUuid(body.salesUserId)
  const replacementSalesUserId = normalizeUuid(body.replacementSalesUserId)

  if (!salesUserId || !replacementSalesUserId) {
    return json({ ok: false, error: 'Select a sales representative and replacement.' }, 400)
  }

  if (salesUserId === replacementSalesUserId) {
    return json({ ok: false, error: 'Replacement sales representative must be different from the deactivated sales representative.' }, 400)
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
    return json({ ok: false, error: 'Only Admin and Sub Admin can deactivate sales representatives.' }, 403)
  }

  const { data: targetProfile, error: targetError } = await adminClient
    .from('profiles')
    .select('id, role, status, team_id, branch_id, deleted_at')
    .eq('id', salesUserId)
    .single<ProfileRow>()

  if (targetError || !targetProfile || targetProfile.role !== 'sales' || targetProfile.deleted_at) {
    return json({ ok: false, error: 'Select a sales representative to deactivate.' }, 400)
  }

  const { data: replacementProfile, error: replacementError } = await adminClient
    .from('profiles')
    .select('id, role, status, team_id, branch_id, deleted_at')
    .eq('id', replacementSalesUserId)
    .single<ProfileRow>()

  if (replacementError || !replacementProfile || replacementProfile.role !== 'sales' || replacementProfile.status !== 'active' || replacementProfile.deleted_at) {
    return json({ ok: false, error: 'Select an active replacement sales representative.' }, 400)
  }

  const changedAt = new Date().toISOString()
  const { data: assignedUnits, error: unitsError } = await adminClient
    .from('units')
    .select('id')
    .eq('created_by', salesUserId)

  if (unitsError) return json({ ok: false, error: unitsError.message }, 400)

  const historyRows = (assignedUnits ?? []).map((unit) => ({
    unit_id: unit.id,
    previous_sales_user_id: salesUserId,
    new_sales_user_id: replacementSalesUserId,
    changed_by: caller.id,
    changed_at: changedAt,
    reason: 'sales_rep_deactivated_after_reassignment',
  }))

  if (historyRows.length > 0) {
    const { error: historyError } = await adminClient.from('unit_sales_assignment_history').insert(historyRows)
    if (historyError) return json({ ok: false, error: historyError.message }, 400)
  }

  const { error: unitsUpdateError } = await adminClient
    .from('units')
    .update({
      created_by: replacementSalesUserId,
      team_id: replacementProfile.team_id,
      branch_id: replacementProfile.branch_id,
      updated_at: changedAt,
    })
    .eq('created_by', salesUserId)

  if (unitsUpdateError) return json({ ok: false, error: unitsUpdateError.message }, 400)

  const { error: profileUpdateError } = await adminClient
    .from('profiles')
    .update({ status: 'inactive', deleted_at: changedAt })
    .eq('id', salesUserId)

  if (profileUpdateError) return json({ ok: false, error: profileUpdateError.message }, 400)

  await adminClient.from('audit_logs').insert({
    actor_id: caller.id,
    actor_role: callerProfile.role,
    action_type: 'Sales representative deactivated after reassignment',
    related_unit_id: null,
    previous_value: { sales_user_id: salesUserId, assigned_units: historyRows.length },
    new_value: { replacement_sales_user_id: replacementSalesUserId, assigned_units: historyRows.length },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] ?? null,
  })

  return json({ ok: true, reassignedUnitCount: historyRows.length })
})
