import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

function isValidEmail(email: string): boolean {
  return /^(?=.{5,255}$)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)
}
function isAllowedDomain(email: string): boolean { return email.toLowerCase().endsWith('@digix.co') }

export async function POST(req: Request) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const email = String(body?.email || '').trim().toLowerCase()
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Formato de correo inválido' }, { status: 400 })
  if (!isAllowedDomain(email)) return NextResponse.json({ error: 'Solo se permite correo @digix.co' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data: userRow } = await supabase.from('users').select('id, full_name, status').eq('email', email).single()
  if (!userRow) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (String(userRow.status).toLowerCase() === 'activo') return NextResponse.json({ message: 'Cuenta ya confirmada' })

  // Esta ruta ha sido deprecada: el reenvío se gestiona en el cliente usando supabase.auth.resend({ type: 'signup', email })
  return NextResponse.json({ error: 'Reenvío de confirmación movido al cliente', hint: 'Usa supabase.auth.resend({ type: "signup", email })' }, { status: 410 })
}