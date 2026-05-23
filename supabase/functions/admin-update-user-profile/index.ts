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
  email: string
}

type UpdateRequest = {
  userId?: string
  fullName?: string
  email?: string
  role?: UserRole
  jobTitle?: string
  phoneNumber?: string
  teamId?: string
  branchId?: string
  status?: AccountStatus
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeRequiredText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableUuid(value: string) {
  if (!value) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
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

  const body = await request.json().catch(() => ({} as UpdateRequest))
  const userId = normalizeRequiredText(body.userId)
  const fullName = normalizeRequiredText(body.fullName)
  const email = normalizeRequiredText(body.email).toLowerCase()
  const jobTitle = normalizeRequiredText(body.jobTitle)
  const phoneNumber = normalizeRequiredText(body.phoneNumber)
  const teamId = normalizeRequiredText(body.teamId)
  const branchId = normalizeRequiredText(body.branchId)
  const role = body.role
  const status = body.status

  if (!userId || !fullName || !email || !jobTitle || !phoneNumber || !role || !status) {
    return json({ ok: false, error: 'All required user fields must be provided.' }, 400)
  }

  if (!['admin', 'sub_admin', 'manager', 'sales'].includes(role)) {
    return json({ ok: false, error: 'Invalid user role.' }, 400)
  }

  if (!['active', 'inactive'].includes(status)) {
    return json({ ok: false, error: 'Invalid account status.' }, 400)
  }

  const teamUuid = asNullableUuid(teamId)
  const branchUuid = asNullableUuid(branchId)

  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, status, email')
    .eq('id', caller.id)
    .single<ProfileRow>()

  if (profileError || !callerProfile || callerProfile.status !== 'active') {
    return json({ ok: false, error: 'Unauthorized.' }, 401)
  }

  if (!['admin', 'sub_admin'].includes(callerProfile.role)) {
    return json({ ok: false, error: 'Only admins can update users.' }, 403)
  }

  const { data: targetProfile, error: targetError } = await adminClient
    .from('profiles')
    .select('id, email')
    .eq('id', userId)
    .single<{ id: string; email: string }>()

  if (targetError || !targetProfile) return json({ ok: false, error: 'User not found.' }, 404)

  const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
    ...(targetProfile.email !== email ? { email, email_confirm: true } : {}),
    user_metadata: {
      full_name: fullName,
      job_title: jobTitle,
      phone_number: phoneNumber,
    },
    app_metadata: {
      role,
      team_id: teamUuid,
      branch_id: branchUuid,
    },
  })
  if (authUpdateError) return json({ ok: false, error: authUpdateError.message }, 400)

  const { data: updatedProfile, error: updateError } = await adminClient
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      role,
      job_title: jobTitle,
      phone_number: phoneNumber,
      team_id: teamUuid,
      branch_id: branchUuid,
      status,
    })
    .eq('id', userId)
    .select('id, full_name, email, role, job_title, phone_number, team_id, branch_id, status, theme_preference, created_at, last_login_at')
    .single()

  if (updateError || !updatedProfile) {
    return json({ ok: false, error: updateError?.message ?? 'Profile update failed.' }, 400)
  }

  await adminClient.from('audit_logs').insert({
    actor_id: caller.id,
    actor_role: callerProfile.role,
    action_type: 'User profile updated',
    previous_value: null,
    new_value: { target_user_id: userId },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] ?? null,
  })

  return json({ ok: true, profile: updatedProfile })
})
