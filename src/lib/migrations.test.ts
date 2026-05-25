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

  it('keeps the special-unit RPC on caller permissions so admin RLS controls the save', () => {
    const migration = readMigration('20260525104743_restore_special_unit_rpc_invoker.sql')

    expect(migration).toContain('create or replace function public.set_unit_special')
    expect(migration).toContain('security invoker')
    expect(migration).toContain("not in ('admin', 'sub_admin')")
    expect(migration).toContain('grant execute on function public.set_unit_special(bigint, boolean) to authenticated')
  })
})
