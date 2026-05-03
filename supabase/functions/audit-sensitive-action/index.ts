import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const payload = await request.json()
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const { data: userData } = await supabase.auth.getUser(token)

  if (!userData.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { error } = await supabase.from('audit_logs').insert({
    actor_id: userData.user.id,
    actor_role: payload.actorRole,
    action_type: payload.actionType,
    related_unit_id: payload.relatedUnitId,
    previous_value: payload.previousValue ?? null,
    new_value: payload.newValue ?? null,
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] ?? null,
  })

  return Response.json({ ok: !error, error: error?.message })
})
