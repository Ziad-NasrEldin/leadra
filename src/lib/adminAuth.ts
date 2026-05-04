import type { SupabaseClient } from '@supabase/supabase-js'

interface PasswordUpdateResponse {
  ok?: boolean
  error?: string
}

export async function updateManagedUserPassword(
  client: SupabaseClient,
  userId: string,
  password: string,
): Promise<void> {
  const { data, error } = await client.functions.invoke<PasswordUpdateResponse>('admin-update-user-password', {
    body: { userId, password },
  })

  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.error ?? 'Password update failed.')
}
