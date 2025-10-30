import { NextResponse } from 'next/server'
import { getUserFromAuthHeader, userHasRole, getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!userHasRole(user, ['administrador'])) return NextResponse.json({ error: 'Forbidden: role not allowed' }, { status: 403 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('auth_events')
    .select('id, type, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: 'Error leyendo auth_events', details: error.message }, { status: 500 })
  return NextResponse.json({ events: data || [] }, { status: 200 })
}