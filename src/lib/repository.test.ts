import { describe, expect, it } from 'vitest'
import { LeadraRepository } from './repository'
import type { LeadraUser } from './types'

function salesUser(overrides: Partial<LeadraUser> = {}): LeadraUser {
  return {
    id: 'sales-replacement',
    fullName: 'Replacement Sales',
    email: 'replacement@leadra.test',
    role: 'sales',
    jobTitle: 'Sales Representative',
    phoneNumber: '+201000000000',
    teamId: 'team-b',
    branchId: 'branch-b',
    status: 'active',
    ...overrides,
  }
}

describe('LeadraRepository', () => {
  it('delegates sales representative deactivation and reassignment to the durable history RPC', async () => {
    const calls: Array<{ fn: string; args: unknown }> = []
    const client = {
      rpc(fn: string, args: unknown) {
        calls.push({ fn, args })
        return Promise.resolve({ error: null })
      },
    }

    await new LeadraRepository(client as never).deleteSalesRepresentativeAfterReassignment(
      'sales-old',
      salesUser({ id: 'sales-new' }),
      salesUser({ id: 'admin-1', role: 'admin' }),
    )

    expect(calls).toEqual([
      {
        fn: 'deactivate_sales_representative_after_reassignment',
        args: {
          target_sales_user_id: 'sales-old',
          replacement_sales_user_id: 'sales-new',
        },
      },
    ])
  })

  it('surfaces RPC errors when reassignment persistence fails', async () => {
    const client = {
      rpc() {
        return Promise.resolve({ error: new Error('Select an active replacement sales representative.') })
      },
    }

    await expect(
      new LeadraRepository(client as never).deleteSalesRepresentativeAfterReassignment(
        'sales-old',
        salesUser({ id: 'sales-new' }),
        salesUser({ id: 'admin-1', role: 'admin' }),
      ),
    ).rejects.toThrow('Select an active replacement sales representative.')
  })

})
