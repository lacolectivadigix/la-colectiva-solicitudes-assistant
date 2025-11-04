import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const cronKey = req.headers.get('x-cron-key')
  const expected = process.env.ADMIN_CRON_KEY
  if (!expected || cronKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()

  try {
    const { data: clientes, error: clientesErr } = await supabase
      .from('clientes_digix')
      .select('id, cliente, division_pais')
    if (clientesErr) throw clientesErr

    const { data: servicios, error: serviciosErr } = await supabase
      .from('servicios')
      .select('id, categoria, subcategoria_1, subcategoria_2')
    if (serviciosErr) throw serviciosErr

    const { data: preguntas, error: preguntasErr } = await supabase
      .from('brief_preguntas')
      .select('id, servicio_id, pregunta_texto, categoria, subcategoria_1, subcategoria_2, orden')
      .order('orden', { ascending: true })
    if (preguntasErr) throw preguntasErr

    const up1 = await supabase.storage
      .from('cache')
      .upload('clientes.json', new Blob([JSON.stringify(clientes || [], null, 2)], { type: 'application/json' }), {
        upsert: true,
        contentType: 'application/json',
      })
    if (up1.error) throw up1.error

    const up2 = await supabase.storage
      .from('cache')
      .upload('servicios.json', new Blob([JSON.stringify(servicios || [], null, 2)], { type: 'application/json' }), {
        upsert: true,
        contentType: 'application/json',
      })
    if (up2.error) throw up2.error

    const up3 = await supabase.storage
      .from('cache')
      .upload('brief_preguntas.json', new Blob([JSON.stringify(preguntas || [], null, 2)], { type: 'application/json' }), {
        upsert: true,
        contentType: 'application/json',
      })
    if (up3.error) throw up3.error

    return NextResponse.json({ ok: true, counts: { clientes: (clientes || []).length, servicios: (servicios || []).length, preguntas: (preguntas || []).length } }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: 'Cache rebuild failed', details: err?.message || String(err) }, { status: 500 })
  }
}