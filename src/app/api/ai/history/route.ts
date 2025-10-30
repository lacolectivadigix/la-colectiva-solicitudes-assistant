import { NextResponse } from 'next/server'
import { getUserFromAuthHeader, getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const actor = await getUserFromAuthHeader(req)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabaseAdmin()

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', actor.id)
      .single()

    if (userErr || !userRow?.id) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const userId = userRow.id
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('id, custom_fields')
      .eq('user_id', userId)
      .single()

    if (profErr && profErr.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Error leyendo perfil', details: profErr.message }, { status: 400 })
    }

    const cf: any = prof?.custom_fields || {}
    const history: any[] = Array.isArray(cf.chat_history) ? cf.chat_history : []

    return NextResponse.json({ history }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal error', details: err?.message || String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await getUserFromAuthHeader(req)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabaseAdmin()

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', actor.id)
      .single()

    if (userErr || !userRow?.id) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const userId = userRow.id
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, custom_fields')
      .eq('user_id', userId)
      .single()

    if (!prof?.id) {
      // Si no existe perfil, crear uno con historial vacío
      const { error: upErr } = await supabase
        .from('profiles')
        .upsert({ user_id: userId, custom_fields: { chat_history: [] } }, { onConflict: 'user_id' })
      if (upErr) return NextResponse.json({ error: 'Error creando perfil', details: upErr.message }, { status: 400 })
    } else {
      const cf = prof.custom_fields || {}
      // Remover historial dejando otros campos intactos
      const next = { ...cf }
      next.chat_history = []
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ custom_fields: next })
        .eq('id', prof.id)
      if (updErr) return NextResponse.json({ error: 'Error borrando historial', details: updErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal error', details: err?.message || String(err) }, { status: 500 })
  }
}