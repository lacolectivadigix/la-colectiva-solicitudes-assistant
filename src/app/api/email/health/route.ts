import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  const supabase = getSupabaseAdmin()
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) throw error
    return NextResponse.json({ ok: true, provider: 'supabase_auth', message: 'Conexión a Supabase OK', sampleUsers: (data?.users?.length || 0) }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, provider: 'supabase_auth', message: err?.message || 'Error conectando a Supabase Auth' }, { status: 200 })
  }
}