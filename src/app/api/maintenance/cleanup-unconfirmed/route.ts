import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const cronKey = req.headers.get('x-cron-key')
  const expected = process.env.ADMIN_CRON_KEY
  if (!expected || cronKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.rpc('cleanup_unconfirmed_users')
  if (error) {
    // Fallback sin función RPC: hacer delete directo
    const { error: delErr } = await supabase
      .from('users')
      .delete()
      .lt('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .eq('status', 'pendiente')
    if (delErr) return NextResponse.json({ error: 'Cleanup failed', details: delErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}