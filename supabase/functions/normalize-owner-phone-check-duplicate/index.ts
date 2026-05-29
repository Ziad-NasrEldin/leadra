import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type UserRole = 'admin' | 'sub_admin' | 'manager' | 'sales'

type DuplicateRequest = {
  projectId?: string
  countryCode?: string
  ownerPhone?: string
}

type CallerProfile = {
  id: string
  role: UserRole
  status: 'active' | 'inactive'
  deleted_at: string | null
}

type DuplicateUnit = {
  id: number
  unit_code: string
  created_by: string | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, error: 'Duplicate phone check is not configured.' }, 500)
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

  const body = await request.json().catch(() => ({} as DuplicateRequest))
  const projectId = normalizeText(body.projectId)
  const countryCode = normalizeText(body.countryCode)
  const ownerPhone = normalizeText(body.ownerPhone)
  if (!projectId || !countryCode || !ownerPhone) {
    return json({ ok: false, error: 'Project, country code, and owner phone are required.' }, 400)
  }

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('id, role, status, deleted_at')
    .eq('id', caller.id)
    .single<CallerProfile>()
  if (callerProfileError || !callerProfile || callerProfile.status !== 'active' || callerProfile.deleted_at) {
    return json({ ok: false, error: 'Unauthorized.' }, 401)
  }

  const { data: normalized, error: normalizeError } = await adminClient.rpc('normalize_owner_phone', {
    local_phone: ownerPhone,
    selected_country_code: countryCode,
  })
  if (normalizeError) return json({ ok: false, error: normalizeError.message }, 400)

  const { data: duplicate, error: duplicateError } = await adminClient
    .from('units')
    .select('id, unit_code, created_by')
    .eq('project_id', projectId)
    .eq('normalized_owner_phone', normalized)
    .eq('archived', false)
    .maybeSingle<DuplicateUnit>()
  if (duplicateError) return json({ ok: false, error: duplicateError.message }, 400)

  const canSeeDuplicateIdentity = Boolean(
    duplicate && (
      callerProfile.role === 'admin'
      || callerProfile.role === 'sub_admin'
      || duplicate.created_by === callerProfile.id
    ),
  )

  return json({
    ok: !duplicate,
    normalizedOwnerPhone: normalized,
    duplicateBlocked: Boolean(duplicate),
    duplicateUnit: canSeeDuplicateIdentity && duplicate
      ? { id: duplicate.id, unit_code: duplicate.unit_code }
      : null,
  })
})
