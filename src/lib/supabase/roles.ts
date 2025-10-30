import type { SupabaseClient } from '@supabase/supabase-js'

export type BaseRoleCode = 'solicitante' | 'administrador'

export async function ensureRole(supabase: SupabaseClient, code: BaseRoleCode): Promise<number | null> {
  // Try to get existing role ID
  const { data: roleRow, error } = await supabase
    .from('roles')
    .select('id')
    .eq('code', code)
    .single()

  if (roleRow?.id) return roleRow.id

  // If not found, attempt to seed base role on-the-fly (service role bypasses RLS)
  // We only allow auto-creation for the two base roles to avoid noise.
  if (error && error.code !== 'PGRST116') {
    // Unexpected error (e.g., table missing), surface as null to let caller decide
    return null
  }

  const name = code === 'solicitante' ? 'Solicitante' : 'Administrador'
  const { data: inserted, error: insertErr } = await supabase
    .from('roles')
    .insert({ code, name })
    .select('id')
    .single()

  if (insertErr || !inserted?.id) return null
  return inserted.id
}

export function normalizeRole(role?: string): BaseRoleCode {
  return role === 'administrador' ? 'administrador' : 'solicitante'
}