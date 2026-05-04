import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeadraUser } from './types'

interface PasswordUpdateResponse {
  ok?: boolean
  error?: string
}

interface ManagedUserProfilePayload {
  fullName: string
  email: string
  role: LeadraUser['role']
  jobTitle: string
  phoneNumber: string
  teamId: string
  branchId: string
  status: LeadraUser['status']
}

interface ManagedUserProfileResponse extends PasswordUpdateResponse {
  profile?: {
    id: string
    full_name: string
    email: string
    role: LeadraUser['role']
    job_title: string
    phone_number: string
    team_id: string | null
    branch_id: string | null
    status: LeadraUser['status']
    created_at?: string
    last_login_at?: string | null
  }
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

export async function updateManagedUserProfile(
  client: SupabaseClient,
  userId: string,
  updates: ManagedUserProfilePayload,
): Promise<LeadraUser> {
  const { data, error } = await client.functions.invoke<ManagedUserProfileResponse>('admin-update-user-profile', {
    body: { userId, ...updates },
  })

  if (error) throw new Error(error.message)
  if (!data?.ok || !data.profile) throw new Error(data?.error ?? 'User update failed.')

  return {
    id: data.profile.id,
    fullName: data.profile.full_name,
    email: data.profile.email,
    role: data.profile.role,
    jobTitle: data.profile.job_title,
    phoneNumber: data.profile.phone_number,
    teamId: data.profile.team_id ?? '',
    branchId: data.profile.branch_id ?? '',
    status: data.profile.status,
    createdAt: data.profile.created_at,
    lastLoginAt: data.profile.last_login_at ?? null,
  }
}
