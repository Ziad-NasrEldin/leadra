import type { SupabaseClient } from '@supabase/supabase-js'
import { throwFunctionError } from './functionErrors'
import { authPasswordForAdminUpdate } from './legacyAuth'
export { authPasswordCandidates, authPasswordForAdminUpdate } from './legacyAuth'
import type { CreateUserInput, LeadraUser } from './types'

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
    theme_preference?: LeadraUser['themePreference'] | null
    created_at?: string
    last_login_at?: string | null
  }
}

interface ManagedUserCreateResponse extends PasswordUpdateResponse {
  profile?: ManagedUserProfileResponse['profile']
}

export async function updateManagedUserPassword(
  client: SupabaseClient,
  userId: string,
  password: string,
): Promise<void> {
  const { data, error } = await client.functions.invoke<PasswordUpdateResponse>('admin-update-user-password', {
    body: { userId, password: authPasswordForAdminUpdate(password) },
  })

  if (error) await throwFunctionError(error, 'Password update failed.')
  if (!data?.ok) throw new Error(data?.error ?? 'Password update failed.')
}

export async function createManagedUserProfile(
  client: SupabaseClient,
  input: CreateUserInput,
): Promise<LeadraUser> {
  const { data, error } = await client.functions.invoke<ManagedUserCreateResponse>('admin-create-user', {
    body: input,
  })

  if (error) await throwFunctionError(error, 'User creation failed.')
  if (!data?.ok || !data.profile) throw new Error(data?.error ?? 'User creation failed.')

  const user = toLeadraUser(data.profile)
  await updateManagedUserPassword(client, user.id, input.password)
  return user
}

export async function updateManagedUserProfile(
  client: SupabaseClient,
  userId: string,
  updates: ManagedUserProfilePayload,
): Promise<LeadraUser> {
  const { data, error } = await client.functions.invoke<ManagedUserProfileResponse>('admin-update-user-profile', {
    body: { userId, ...updates },
  })

  if (error) await throwFunctionError(error, 'User update failed.')
  if (!data?.ok || !data.profile) throw new Error(data?.error ?? 'User update failed.')

  return toLeadraUser(data.profile)
}

function toLeadraUser(profile: NonNullable<ManagedUserProfileResponse['profile']>): LeadraUser {
  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    jobTitle: profile.job_title,
    phoneNumber: profile.phone_number,
    teamId: profile.team_id ?? '',
    branchId: profile.branch_id ?? '',
    status: profile.status,
    themePreference: profile.theme_preference === 'dark' ? 'dark' : 'light',
    createdAt: profile.created_at,
    lastLoginAt: profile.last_login_at ?? null,
  }
}
