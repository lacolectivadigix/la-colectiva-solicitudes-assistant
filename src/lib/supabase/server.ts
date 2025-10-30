import { createClient } from '@supabase/supabase-js'

export function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error('Config faltante: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createClient(url, anon)
}

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    throw new Error('Config faltante: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceRole)
}

export function getSupabaseServerWithToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return client;
}

export async function getUserFromAuthHeader(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return null
  const supabase = getSupabaseServer()
  const { data, error } = await supabase.auth.getUser(token)
  if (error) return null
  return data.user
}

export function userHasRole(user: any, allowed: string[] = []) {
  if (!user) return false
  const role = user?.user_metadata?.role || user?.app_metadata?.role
  if (!role) return false
  return allowed.length === 0 ? true : allowed.includes(role)
}