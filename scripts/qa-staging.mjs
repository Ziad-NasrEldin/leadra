import { createClient } from '@supabase/supabase-js'

const required = [
  'LEADRA_STAGING_SUPABASE_URL',
  'LEADRA_STAGING_SUPABASE_ANON_KEY',
  'LEADRA_STAGING_SUPABASE_SERVICE_ROLE_KEY',
  'LEADRA_QA_ADMIN_EMAIL',
  'LEADRA_QA_ADMIN_PASSWORD',
  'LEADRA_QA_SUB_ADMIN_EMAIL',
  'LEADRA_QA_SUB_ADMIN_PASSWORD',
  'LEADRA_QA_MANAGER_EMAIL',
  'LEADRA_QA_MANAGER_PASSWORD',
  'LEADRA_QA_SALES_EMAIL',
  'LEADRA_QA_SALES_PASSWORD',
  'LEADRA_QA_MANAGER_B_EMAIL',
  'LEADRA_QA_MANAGER_B_PASSWORD',
  'LEADRA_QA_SALES_B_EMAIL',
  'LEADRA_QA_SALES_B_PASSWORD',
  'LEADRA_QA_INACTIVE_EMAIL',
  'LEADRA_QA_INACTIVE_PASSWORD',
]

const missing = required.filter((key) => !process.env[key])
if (process.env.LEADRA_QA_ALLOW_DESTRUCTIVE !== 'true') {
  fail('Refusing staging QA writes. Set LEADRA_QA_ALLOW_DESTRUCTIVE=true.')
}
if (missing.length > 0) fail(`Missing staging QA env vars: ${missing.join(', ')}`)
if (process.env.LEADRA_STAGING_SUPABASE_URL === process.env.VITE_SUPABASE_URL) {
  fail('Staging URL matches VITE_SUPABASE_URL. Refusing to run destructive QA against the app target.')
}

const url = process.env.LEADRA_STAGING_SUPABASE_URL
const anonKey = process.env.LEADRA_STAGING_SUPABASE_ANON_KEY
const serviceKey = process.env.LEADRA_STAGING_SUPABASE_SERVICE_ROLE_KEY
const service = createClient(url, serviceKey, { auth: { persistSession: false } })

const qa = {
  prefix: `QA_${Date.now()}`,
  branchId: '91111111-1111-4111-8111-111111111111',
  teamA: '92222222-2222-4222-8222-222222222222',
  teamB: '93333333-3333-4333-8333-333333333333',
  dev: '9aaaaaaa-0001-4000-8000-000000000001',
  projectA: '9aaaaaaa-0003-4000-8000-000000000003',
  projectB: '9aaaaaaa-0004-4000-8000-000000000004',
  destination: '9aaaaaaa-0005-4000-8000-000000000005',
  view: '9aaaaaaa-0007-4000-8000-000000000007',
}

const users = {
  admin: { email: process.env.LEADRA_QA_ADMIN_EMAIL, password: process.env.LEADRA_QA_ADMIN_PASSWORD, role: 'admin', teamId: qa.teamA },
  subAdmin: { email: process.env.LEADRA_QA_SUB_ADMIN_EMAIL, password: process.env.LEADRA_QA_SUB_ADMIN_PASSWORD, role: 'sub_admin', teamId: qa.teamA },
  managerA: { email: process.env.LEADRA_QA_MANAGER_EMAIL, password: process.env.LEADRA_QA_MANAGER_PASSWORD, role: 'manager', teamId: qa.teamA },
  salesA: { email: process.env.LEADRA_QA_SALES_EMAIL, password: process.env.LEADRA_QA_SALES_PASSWORD, role: 'sales', teamId: qa.teamA },
  managerB: { email: process.env.LEADRA_QA_MANAGER_B_EMAIL, password: process.env.LEADRA_QA_MANAGER_B_PASSWORD, role: 'manager', teamId: qa.teamB },
  salesB: { email: process.env.LEADRA_QA_SALES_B_EMAIL, password: process.env.LEADRA_QA_SALES_B_PASSWORD, role: 'sales', teamId: qa.teamB },
  inactive: { email: process.env.LEADRA_QA_INACTIVE_EMAIL, password: process.env.LEADRA_QA_INACTIVE_PASSWORD, role: 'sales', teamId: qa.teamA, inactive: true },
}

const results = []

try {
  await seedReferenceData()
  await ensureUsers()
  const sessions = await signInUsers()
  await verifyAuth(sessions)
  const unitA = await createQaUnit(sessions.salesA, qa.projectA, '+201011110001', `${qa.prefix}_Owner_A`)
  await createQaUnit(sessions.salesA, qa.projectB, '+201011110001', `${qa.prefix}_Owner_B`)
  await expectDuplicateBlocked(sessions.salesA, qa.projectA, '+201011110001')
  await verifyRlsAndOwnerPrivacy(sessions, unitA)
  await verifyAnalyticsRpc(sessions)
  await verifyStorage(sessions.salesA)
} finally {
  await cleanupQaRows()
}

console.log(JSON.stringify({ ok: true, results }, null, 2))

async function seedReferenceData() {
  await must(service.from('branches').upsert({ id: qa.branchId, name: `${qa.prefix}_Cairo`, archived: false }), 'seed branch')
  await must(
    service.from('teams').upsert([
      { id: qa.teamA, name: `${qa.prefix}_Team_A`, branch_id: qa.branchId, archived: false },
      { id: qa.teamB, name: `${qa.prefix}_Team_B`, branch_id: qa.branchId, archived: false },
    ]),
    'seed teams',
  )
  await must(
    service.from('lookup_values').upsert([
      { id: qa.dev, kind: 'developer', label: `${qa.prefix}_Developer`, archived: false },
      { id: qa.projectA, kind: 'project', label: `${qa.prefix}_Project_A`, archived: false },
      { id: qa.projectB, kind: 'project', label: `${qa.prefix}_Project_B`, archived: false },
      { id: qa.destination, kind: 'destination', label: `${qa.prefix}_Destination`, archived: false },
      { id: qa.view, kind: 'view', label: `${qa.prefix}_View`, archived: false },
    ]),
    'seed lookup values',
  )
  pass('reference data seeded')
}

async function ensureUsers() {
  for (const [key, user] of Object.entries(users)) {
    if (!user.email || !user.password) continue
    const { data, error } = await service.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: `${qa.prefix}_${key}`,
        role: user.role,
        job_title: `${key} QA`,
        phone_number: '+201000000000',
        team_id: user.teamId,
        branch_id: qa.branchId,
      },
    })
    if (error && !/already registered|already been registered|already exists/i.test(error.message)) throw error
    const id = data.user?.id ?? (await findAuthUserId(user.email))
    await must(
      service.from('profiles').upsert({
        id,
        full_name: `${qa.prefix}_${key}`,
        email: user.email,
        role: user.role,
        job_title: `${key} QA`,
        phone_number: '+201000000000',
        team_id: user.teamId,
        branch_id: qa.branchId,
        status: user.inactive ? 'inactive' : 'active',
      }),
      `upsert ${key} profile`,
    )
  }
  pass('QA users ensured')
}

async function signInUsers() {
  const sessions = {}
  for (const [key, user] of Object.entries(users)) {
    if (!user.email || !user.password) continue
    const client = createClient(url, anonKey, { auth: { persistSession: false } })
    const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
    sessions[key] = { client, signInError: error, config: user }
  }
  return sessions
}

async function verifyAuth(sessions) {
  assert(!sessions.admin.signInError, 'admin should sign in')
  assert(!sessions.subAdmin.signInError, 'sub-admin should sign in')
  assert(!sessions.managerA.signInError, 'manager should sign in')
  assert(!sessions.salesA.signInError, 'sales should sign in')
  assert(!sessions.managerB.signInError, 'manager B should sign in')
  assert(!sessions.salesB.signInError, 'sales B should sign in')
  if (sessions.inactive) assert(sessions.inactive.signInError || (await currentProfileStatus(sessions.inactive.client)) === 'inactive', 'inactive user must not reach active app state')
  pass('auth behavior verified')
}

async function createQaUnit(session, projectId, phone, ownerName) {
  const { error } = await session.client
    .from('units')
    .insert({
      developer_id: qa.dev,
      project_id: projectId,
      destination_id: qa.destination,
      unit_type: 'Apartment',
      floor: 'QA floor',
      bua: 120,
      view_id: qa.view,
      bedrooms: 2,
      bathrooms: 2,
      elevator: true,
      furnished: false,
      finish: 'Fully Finished',
      payment_method: 'cash',
      total_amount: 1_000_000,
      delivery_year: 2028,
      original_owner_name: ownerName,
      country_code: '+20',
      original_owner_phone: phone,
      sales_notes: `${qa.prefix} sales note`,
      created_by: (await session.client.auth.getUser()).data.user.id,
      team_id: qa.teamA,
      branch_id: qa.branchId,
    })
  if (error) throw error
  const unit = await findQaUnit(ownerName)
  pass(`unit created ${unit.unit_code}`)
  return unit
}

async function expectDuplicateBlocked(session, projectId, phone) {
  const { error } = await session.client.from('units').insert({
    developer_id: qa.dev,
    project_id: projectId,
    destination_id: qa.destination,
    unit_type: 'Apartment',
    floor: 'Duplicate',
    bua: 120,
    view_id: qa.view,
    bedrooms: 2,
    bathrooms: 2,
    elevator: true,
    furnished: false,
    finish: 'Fully Finished',
    payment_method: 'cash',
    total_amount: 1_000_000,
    delivery_year: 2028,
    original_owner_name: `${qa.prefix}_Duplicate`,
    country_code: '+20',
    original_owner_phone: phone,
    created_by: (await session.client.auth.getUser()).data.user.id,
    team_id: qa.teamA,
    branch_id: qa.branchId,
  })
  assert(error, 'same-project duplicate phone should be blocked')
  pass('same-project duplicate blocked')
}

async function verifyRlsAndOwnerPrivacy(sessions, unitA) {
  const managerB = sessions.managerB?.client
  if (managerB) {
    const { data } = await managerB.from('units').select('id').eq('id', unitA.id)
    assert((data ?? []).length === 0, 'manager from another team must not read team A unit')
  }
  const salesB = sessions.salesB?.client
  if (salesB) {
    const { data, error } = await salesB.from('units').select('id, original_owner_name, original_owner_phone').eq('id', unitA.id)
    if (error) {
      pass('sales direct units table read blocked')
      return
    }
    assert(!JSON.stringify(data ?? []).match(/Owner_A|1011110001/), 'sales cross-user API response must not expose owner fields')
  }
  pass('RLS and owner privacy verified')
}

async function verifyAnalyticsRpc(sessions) {
  const admin = await sessions.admin.client.rpc('analytics_dashboard', { filters: { dateWindow: '30d' } })
  assert(!admin.error && admin.data?.overview, 'admin analytics RPC should return dashboard')
  const subAdmin = await sessions.subAdmin.client.rpc('analytics_dashboard', { filters: { dateWindow: '30d' } })
  assert(!subAdmin.error && subAdmin.data?.overview, 'sub-admin analytics RPC should return dashboard')
  const sales = await sessions.salesA.client.rpc('analytics_dashboard', { filters: { dateWindow: '30d' } })
  assert(sales.data?.error === 'analytics_not_allowed' || sales.error, 'sales analytics RPC should be blocked')
  assert(!JSON.stringify(admin.data).match(/owner|phone|normalized/i), 'analytics RPC must not include owner/phone fields')
  pass('analytics RPC verified')
}

async function verifyStorage(session) {
  const fileName = `${qa.prefix}/tiny.png`
  const bytes = Uint8Array.from([137, 80, 78, 71])
  const upload = await session.client.storage.from('unit-media').upload(fileName, bytes, { contentType: 'image/png', upsert: true })
  assert(!upload.error, `authenticated storage upload failed: ${upload.error?.message}`)
  const publicResponse = await fetch(`${url}/storage/v1/object/unit-media/${fileName}`)
  assert([400, 401, 403].includes(publicResponse.status), 'private unit-media object must not be public')
  pass('storage privacy verified')
}

async function cleanupQaRows() {
  await service.storage.from('unit-media').remove([`${qa.prefix}/tiny.png`]).catch(() => {})
  await service.from('unit_media').delete().like('storage_path', `${qa.prefix}%`)
  await service.from('unit_notes').delete().like('content', `${qa.prefix}%`)
  await service.from('analytics_events').delete().in('project_id', [qa.projectA, qa.projectB])
  await service.from('notifications').delete().or(`title.ilike.${qa.prefix}%,body.ilike.${qa.prefix}%`)
  await service.from('audit_logs').delete().like('action_type', `${qa.prefix}%`)
  await service.from('units').delete().like('original_owner_name', `${qa.prefix}%`)
  await service.from('lookup_values').delete().like('label', `${qa.prefix}%`)
  await service.from('teams').delete().like('name', `${qa.prefix}%`)
  await service.from('branches').delete().like('name', `${qa.prefix}%`)
}

async function currentProfileStatus(client) {
  const { data } = await client.from('profiles').select('status').single()
  return data?.status
}

async function findAuthUserId(email) {
  const { data, error } = await service.auth.admin.listUsers()
  if (error) throw error
  const user = data.users.find((item) => item.email === email)
  if (!user) throw new Error(`Could not find auth user ${email}`)
  return user.id
}

async function findQaUnit(ownerName) {
  const { data, error } = await service.from('units').select('id, unit_code').eq('original_owner_name', ownerName).single()
  if (error) throw error
  return data
}

async function must(promise, label) {
  const { error } = await promise
  if (error) throw new Error(`${label} failed: ${error.message}`)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function pass(message) {
  results.push({ status: 'pass', message })
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
