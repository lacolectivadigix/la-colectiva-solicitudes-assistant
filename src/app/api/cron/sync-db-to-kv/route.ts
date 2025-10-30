import { NextResponse } from 'next/server'
import { kv } from '@/lib/kv/client'
import { createClient } from '@supabase/supabase-js'

function getBearerSecret(headers: Headers): string | null {
  const auth = headers.get('authorization') || headers.get('Authorization')
  if (!auth) return null
  const m = auth.match(/^Bearer\s+(.*)$/i)
  return m ? m[1] : null
}

function getAdminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client')
  }
  return createClient(url, serviceKey)
}

export async function GET(req: Request) {
  try {
    const secret = getBearerSecret(req.headers)
    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const supabase = getAdminSupabase()

    const clientes = await supabase.from('clientes_digix').select('*')
    if (clientes.error) throw clientes.error
    await kv.set('cache:clientes', JSON.stringify(clientes.data || []))

    const servicios = await supabase.from('servicios').select('*')
    if (servicios.error) throw servicios.error
    await kv.set('cache:servicios', JSON.stringify(servicios.data || []))

    const preguntas = await supabase.from('brief_preguntas').select('*')
    if (preguntas.error) throw preguntas.error
    await kv.set('cache:preguntas', JSON.stringify(preguntas.data || []))

    return NextResponse.json({
      success: true,
      counts: {
        clientes: (clientes.data || []).length,
        servicios: (servicios.data || []).length,
        preguntas: (preguntas.data || []).length,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 })
  }
}