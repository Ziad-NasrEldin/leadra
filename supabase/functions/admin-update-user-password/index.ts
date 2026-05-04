import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ProfileRow = {
  id: string
  role: 'admin' | 'sub_admin' | 'manager' | 'sales'
  status: 'active' | 'inactive'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isStrongEnoughPassword(password: string) {
  return password.length >= 10 && /\S/.test(password)
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

  const { userId, password } = await request.json().catch(() => ({}))
  if (typeof userId !== 'string' || typeof password !== 'string') {
    return json({ ok: false, error: 'User and password are required.' }, 400)
  }

  if (!isStrongEnoughPassword(password)) {
    return json({ ok: false, error: 'Password must be at least 10 characters.' }, 400)
  }

  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, status')
    .eq('id', caller.id)
    .single<ProfileRow>()

  if (profileError || !callerProfile || callerProfile.status !== 'active') {
    return json({ ok: false, error: 'Unauthorized.' }, 401)
  }

  if (!['admin', 'sub_admin'].includes(callerProfile.role)) {
    return json({ ok: false, error: 'Only admins can update user passwords.' }, 403)
  }

  const { data: targetProfile, error: targetError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single<{ id: string }>()

  if (targetError || !targetProfile) return json({ ok: false, error: 'User not found.' }, 404)

  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, { password })
  if (updateError) return json({ ok: false, error: updateError.message }, 400)

  await adminClient.from('audit_logs').insert({
    actor_id: caller.id,
    actor_role: callerProfile.role,
    action_type: 'User password updated',
    previous_value: null,
    new_value: { target_user_id: userId },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] ?? null,
  })

  return json({ ok: true })
})
