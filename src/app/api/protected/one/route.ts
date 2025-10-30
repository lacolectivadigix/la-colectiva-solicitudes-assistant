import { NextResponse } from 'next/server'
import { getUserFromAuthHeader, userHasRole } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const user = await getUserFromAuthHeader(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!userHasRole(user, ['solicitante', 'administrador'])) {
    return NextResponse.json({ error: 'Forbidden: role not allowed' }, { status: 403 })
  }
  const { email, id, user_metadata } = user
  return NextResponse.json({ route: 'one', user: { id, email, ...user_metadata } }, { status: 200 })
}