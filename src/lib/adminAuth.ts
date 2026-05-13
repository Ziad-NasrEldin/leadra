import type { SupabaseClient } from '@supabase/supabase-js'
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
    created_at?: string
    last_login_at?: string | null
  }
}

interface ManagedUserCreateResponse extends PasswordUpdateResponse {
  profile?: ManagedUserProfileResponse['profile']
}

interface FunctionErrorBody {
  error?: string
  message?: string
}

const legacyPasswordMinLength = 10
const legacyPasswordPadding = '00'

export function authPasswordForAdminUpdate(password: string): string {
  if (password.length >= legacyPasswordMinLength) return password
  return `${password}${legacyPasswordPadding.slice(0, legacyPasswordMinLength - password.length)}`
}

export function authPasswordCandidates(password: string): string[] {
  const compatiblePassword = authPasswordForAdminUpdate(password)
  return compatiblePassword === password ? [password] : [password, compatiblePassword]
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
  const { data: currentProfile, error: currentError } = await client
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single<{ email: string }>()

  if (currentError) throw new Error(`User update failed: ${currentError.message}`)

  if (currentProfile.email === updates.email) {
    return updateManagedProfileRow(client, userId, updates)
  }

  const { data, error } = await client.functions.invoke<ManagedUserProfileResponse>('admin-update-user-profile', {
    body: { userId, ...updates },
  })

  if (error) await throwFunctionError(error, 'User update failed.')
  if (!data?.ok || !data.profile) throw new Error(data?.error ?? 'User update failed.')

  return toLeadraUser(data.profile)
}

async function updateManagedProfileRow(
  client: SupabaseClient,
  userId: string,
  updates: ManagedUserProfilePayload,
): Promise<LeadraUser> {
  const { data, error } = await client
    .from('profiles')
    .update({
      full_name: updates.fullName,
      email: updates.email,
      role: updates.role,
      job_title: updates.jobTitle,
      phone_number: updates.phoneNumber,
      team_id: updates.teamId || null,
      branch_id: updates.branchId || null,
      status: updates.status,
    })
    .eq('id', userId)
    .select('id, full_name, email, role, job_title, phone_number, team_id, branch_id, status, created_at, last_login_at')
    .single<NonNullable<ManagedUserProfileResponse['profile']>>()

  if (error || !data) throw new Error(error?.message ?? 'User update failed.')
  return toLeadraUser(data)
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
    createdAt: profile.created_at,
    lastLoginAt: profile.last_login_at ?? null,
  }
}

async function throwFunctionError(error: unknown, fallback: string): Promise<never> {
  const baseMessage = error instanceof Error ? error.message : fallback
  const context = typeof error === 'object' && error && 'context' in error
    ? (error as { context?: unknown }).context
    : null

  if (context instanceof Response) {
    const response = context.clone()
    const contentType = response.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      try {
        const body = await response.json() as FunctionErrorBody
        const message = body.error ?? body.message
        if (message) throw new Error(message)
      } catch (parseError) {
        if (parseError instanceof Error && parseError.name === 'Error') throw parseError
      }
    } else {
      const text = await response.text().catch(() => '')
      if (text.trim()) {
        throw new Error(text.trim())
      }
    }
  }

  throw new Error(baseMessage)
}
