import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

serve(async (request) => {
  const payload = await request.json()
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('LEADRA_FROM_EMAIL') ?? 'Leadra <notifications@example.com>'

  if (!apiKey) {
    return Response.json({ queued: false, reason: 'RESEND_API_KEY is not configured' }, { status: 202 })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
    }),
  })

  return Response.json({ queued: response.ok, status: response.status })
})
