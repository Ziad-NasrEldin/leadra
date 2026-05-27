/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')

function readMigration(fileName: string) {
  return readFileSync(join(migrationsDir, fileName), 'utf8').replace(/\s+/g, ' ').trim().toLowerCase()
}

describe('Supabase permission migrations', () => {
  it('grants authenticated users the table privileges required to create units with media', () => {
    expect(readMigration('0030_units_authenticated_edit_grants.sql')).toContain(
      'grant select, insert, update on public.units to authenticated',
    )
    expect(readMigration('20260524114556_grant_unit_media_to_authenticated.sql')).toContain(
      'grant select, insert, update, delete on public.unit_media to authenticated',
    )
    expect(readMigration('20260524114556_grant_unit_media_to_authenticated.sql')).toContain(
      'security definer',
    )
    expect(readMigration('20260524114556_grant_unit_media_to_authenticated.sql')).toContain(
      "unit creator must match the authenticated user",
    )
  })

  it('keeps stored media URLs visible in permission-safe unit RPCs', () => {
    const migration = readMigration('20260524121800_restore_data_url_unit_media_in_safe_rpcs.sql')

    expect(migration).toContain("case when m.storage_path like ''data:%'' then '''' else m.storage_path end")
    expect(migration).toContain('m.storage_path')
    expect(migration).toContain('public.list_units_safe(integer, integer)')
    expect(migration).toContain('public.search_units_safe(jsonb, integer, integer)')
  })

  it('keeps special-unit RPC security definer so admin roles can bypass unit RLS safely', () => {
    const migration = readMigration('20260526213648_restore_special_unit_security_definer.sql')

    expect(migration).toContain('create or replace function public.set_unit_special(target_unit_id bigint, mark_special boolean)')
    expect(migration).toContain('security definer')
    expect(migration).toContain("coalesce(actor_role::text, '') not in ('admin', 'sub_admin')")
    expect(migration).toContain('grant execute on function public.set_unit_special(bigint, boolean) to authenticated')
  })

  it('recalculates installment amounts on payment-plan edits and fully clears installment fields for cash units', () => {
    const migration = readMigration('20260527171243_fix_payment_plan_edit_calculations.sql')

    expect(migration).toContain("when 'monthly' then 1")
    expect(migration).toContain('new.installment_amount := round(base_remaining / nullif(payment_count, 0), 2);')
    expect(migration).toContain('new.installment_amount := old.installment_amount')
    expect(migration).toContain('unpaid_maintenance')
    expect(migration).toContain('new.remaining_payment := base_remaining + unpaid_maintenance')
    expect(migration).toContain('coalesce(bool_or(paid), false)')
    expect(migration).toContain('if has_paid_schedule then new.remaining_payment := unpaid_schedule_remaining + unpaid_maintenance')
    expect(migration).toContain('else new.remaining_payment := base_remaining + unpaid_maintenance')
    expect(migration).toContain("if new.payment_method = 'cash' then")
    expect(migration).toContain('new.down_payment := null')
    expect(migration).toContain('new.installment_type := null')
    expect(migration).toContain('new.installment_amount := null')
  })

  it('allows authorized pricing editors to change payment method while preserving unauthorized guards', () => {
    const migration = readMigration('20260527171243_fix_payment_plan_edit_calculations.sql')

    expect(migration).toContain('create or replace function public.enforce_unit_edit_permissions()')
    expect(migration).toContain("can_edit_pricing := actor_role in ('admin', 'sub_admin')")
    expect(migration).toContain('if not can_edit_pricing and ( old.payment_method is distinct from new.payment_method')
    expect(migration).toContain('or old.down_payment is distinct from new.down_payment')
    expect(migration).toContain('or old.installment_due_day is distinct from new.installment_due_day')
    expect(migration).toContain('or old.installment_amount is distinct from new.installment_amount')
    expect(migration).toContain("raise exception 'you do not have permission to edit total value.'")
  })
})
