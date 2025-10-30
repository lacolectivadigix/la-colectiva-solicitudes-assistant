import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  // Intentar buscar en email_confirmations
  const { data: rec, error } = await supabase
    .from('email_confirmations')
    .select('id, user_id, expires_at, status')
    .eq('token', token)
    .maybeSingle()

  let userId: number | null = null
  let expiresAtIso: string | null = null
  let status: string | null = null
  let confId: number | null = null

  if (rec) {
    userId = rec.user_id
    expiresAtIso = rec.expires_at
    status = rec.status as any
    confId = rec.id
  } else {
    // Fallback: buscar en profiles.custom_fields
    const { data: prof } = await supabase
      .from('profiles')
      .select('user_id, custom_fields')
      .filter('custom_fields->>confirmation_token', 'eq', token)
      .maybeSingle()
    if (!prof) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    userId = prof.user_id
    expiresAtIso = (prof.custom_fields as any)?.confirmation_expires_at || null
    status = (prof.custom_fields as any)?.status || 'pending'
  }

  if (status === 'confirmed') {
    return NextResponse.redirect(new URL('/app', url.origin))
  }

  const expired = !expiresAtIso || new Date(expiresAtIso).getTime() < Date.now()
  if (expired) {
    if (confId) await supabase.from('email_confirmations').update({ status: 'expired' }).eq('id', confId)
    else await supabase.from('profiles').update({ custom_fields: { status: 'expired' } }).eq('user_id', userId!)
    return NextResponse.json({ error: 'Token expirado. Solicita reenvío.' }, { status: 400 })
  }

  // Activar cuenta
  const { error: updErr } = await supabase.from('users').update({ status: 'activo' }).eq('id', userId!)
  if (updErr) return NextResponse.json({ error: 'No se pudo activar la cuenta' }, { status: 400 })

  // Actualizar app_metadata en Auth y marcar email confirmado
  const { data: userRow } = await supabase.from('users').select('auth_user_id').eq('id', userId!).single()
  if (userRow?.auth_user_id) {
    await supabase.auth.admin.updateUserById(userRow.auth_user_id, { app_metadata: { status: 'activo' }, email_confirm: true })
  }

  if (confId) await supabase.from('email_confirmations').update({ status: 'confirmed' }).eq('id', confId)
  else await supabase.from('profiles').update({ custom_fields: { status: 'confirmed' } }).eq('user_id', userId!)

  return NextResponse.redirect(new URL('/app', url.origin))
}