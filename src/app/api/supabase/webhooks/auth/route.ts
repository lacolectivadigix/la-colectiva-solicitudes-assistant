import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase/server'

function verifySignature(rawBody: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret) return true
  if (!signature) return false
  const h = crypto.createHmac('sha256', secret)
  h.update(rawBody)
  const expected = h.digest('hex')
  return expected === signature
}

export async function POST(req: Request) {
  const raw = await req.text()
  const sig = req.headers.get('x-supabase-signature')
  const ok = verifySignature(raw, sig, process.env.SUPABASE_WEBHOOK_SECRET)
  if (!ok) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })

  let payload: any
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const type = String(payload?.type || payload?.event || '').toLowerCase()
  const user = payload?.user || payload?.data?.user || null

  const supabase = getSupabaseAdmin()
  // Registrar evento para auditoría
  await supabase.from('auth_events').insert({ type, payload })

  // Actualizar estado de usuario cuando confirma
  try {
    if (user?.email && (type.includes('confirm') || type.includes('verified'))) {
      await supabase.from('users').update({ status: 'activo' }).eq('email', String(user.email).toLowerCase())
    }
  } catch {}

  return NextResponse.json({ ok: true })
}