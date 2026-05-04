import { createClient } from '@supabase/supabase-js'

const env = process.env

const config = {
  url: env.LEADRA_SUPABASE_URL ?? env.LEADRA_STAGING_SUPABASE_URL ?? env.VITE_SUPABASE_URL,
  serviceRoleKey: env.LEADRA_SUPABASE_SERVICE_ROLE_KEY ?? env.LEADRA_STAGING_SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY,
  email: env.LEADRA_SEED_ADMIN_EMAIL,
  password: env.LEADRA_SEED_ADMIN_PASSWORD,
  fullName: env.LEADRA_SEED_ADMIN_NAME ?? 'Leadra Admin',
  jobTitle: env.LEADRA_SEED_ADMIN_JOB_TITLE ?? 'Platform Admin',
  phoneNumber: env.LEADRA_SEED_ADMIN_PHONE ?? '+201000000000',
  teamId: env.LEADRA_SEED_ADMIN_TEAM_ID ?? null,
  branchId: env.LEADRA_SEED_ADMIN_BRANCH_ID ?? null,
}

const missing = Object.entries({
  LEADRA_SUPABASE_URL: config.url,
  LEADRA_SUPABASE_SERVICE_ROLE_KEY: config.serviceRoleKey,
  LEADRA_SEED_ADMIN_EMAIL: config.email,
  LEADRA_SEED_ADMIN_PASSWORD: config.password,
}).filter(([, value]) => !value)

if (missing.length > 0) {
  fail(`Missing required env vars: ${missing.map(([key]) => key).join(', ')}`)
}

const service = createClient(config.url, config.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const payload = {
    email: config.email,
    password: config.password,
    email_confirm: true,
    user_metadata: {
      full_name: config.fullName,
      job_title: config.jobTitle,
      phone_number: config.phoneNumber,
    },
    app_metadata: {
      role: 'admin',
      team_id: config.teamId,
      branch_id: config.branchId,
    },
  }

  const { data: created, error: createError } = await service.auth.admin.createUser(payload)
  if (createError && !/already registered|already been registered|already exists/i.test(createError.message)) {
    throw createError
  }

  const userId = created.user?.id ?? (await findAuthUserId(config.email))
  const profile = {
    id: userId,
    full_name: config.fullName,
    email: config.email,
    role: 'admin',
    job_title: config.jobTitle,
    phone_number: config.phoneNumber,
    team_id: config.teamId,
    branch_id: config.branchId,
    status: 'active',
  }

  const { error: profileError } = await service.from('profiles').upsert(profile)
  if (profileError) throw profileError

  const { error: prefsError } = await service.from('notification_preferences').upsert({ user_id: userId })
  if (prefsError) throw prefsError

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: config.email,
        password: config.password,
        userId,
        role: 'admin',
      },
      null,
      2,
    ),
  )
}

async function findAuthUserId(email) {
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const match = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase())
    if (match) return match.id
    if (data.users.length < perPage) break
    page += 1
  }

  throw new Error(`Could not find auth user for ${email}`)
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
