import { describe, expect, it } from 'vitest'
import { createSupabaseShellState } from './supabaseState'
import type { LeadraUser } from './types'

function profile(overrides: Partial<LeadraUser> = {}): LeadraUser {
  return {
    id: 'user-1',
    fullName: 'Mobile User',
    email: 'mobile@leadra.test',
    role: 'sales',
    jobTitle: 'Sales Representative',
    phoneNumber: '+201000000000',
    teamId: 'team-1',
    branchId: 'branch-1',
    status: 'active',
    themePreference: 'light',
    ...overrides,
  }
}

describe('Supabase mobile startup shell state', () => {
  it('creates a safe empty authenticated shell without leaking demo workspace data', () => {
    const user = profile()
    const shell = createSupabaseShellState(user)

    expect(shell.users).toEqual([user])
    expect(shell.units).toEqual([])
    expect(shell.notifications).toEqual([])
    expect(shell.auditLogs).toEqual([])
    expect(shell.analyticsEvents).toEqual([])
    expect(shell.analyticsTargets).toEqual([])
    expect(shell.branches).toEqual([])
    expect(shell.teams).toEqual([])
    expect(shell.settings.companyName).toBe('Leadra')
  })
})
