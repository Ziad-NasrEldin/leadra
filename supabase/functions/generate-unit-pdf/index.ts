import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (request) => {
  const { unitId } = await request.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const { data: userData } = await supabase.auth.getUser(token)

  if (!userData.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: unit, error } = await supabase
    .from('units')
    .select('*, unit_media(*)')
    .eq('id', unitId)
    .single()

  if (error || !unit) {
    return new Response('Unit not found', { status: 404 })
  }

  await supabase.from('audit_logs').insert({
    actor_id: userData.user.id,
    actor_role: 'sales',
    action_type: 'PDF generated',
    related_unit_id: unitId,
    new_value: { unit_code: unit.unit_code },
  })

  const images = (unit.unit_media ?? []).filter((media: { type: string }) => media.type === 'image')
  const body = [
    'Leadra branded PDF placeholder',
    `Unit: ${unit.unit_code}`,
    `Total amount: ${unit.total_amount}`,
    `Images included: ${images.length}`,
    'Replace this text response with a PDF renderer such as pdf-lib or React PDF in production.',
  ].join('\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${unit.unit_code}.pdf"`,
    },
  })
})
