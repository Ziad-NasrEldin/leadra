import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (request) => {
  const { projectId, countryCode, ownerPhone } = await request.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: normalized, error: normalizeError } = await supabase.rpc('normalize_owner_phone', {
    local_phone: ownerPhone,
    selected_country_code: countryCode,
  })

  if (normalizeError) {
    return Response.json({ ok: false, error: normalizeError.message }, { status: 400 })
  }

  const { data: duplicate } = await supabase
    .from('units')
    .select('id, unit_code')
    .eq('project_id', projectId)
    .eq('normalized_owner_phone', normalized)
    .eq('archived', false)
    .maybeSingle()

  return Response.json({
    ok: !duplicate,
    normalizedOwnerPhone: normalized,
    duplicateUnit: duplicate ?? null,
  })
})
