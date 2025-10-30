import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf8')
  content.split(/\r?\n/).forEach(line => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) return
    const [, key, rawVal] = m
    const val = rawVal.replace(/^"|"$/g, '')
    if (!process.env[key]) process.env[key] = val
  })
}

loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const [,, emailArg] = process.argv
if (!emailArg) {
  console.log('Usage: node scripts/confirm-auth-email.mjs <email>')
  process.exit(1)
}

async function main() {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE)
  const { data: row, error } = await admin.from('users').select('id, auth_user_id, email, status').eq('email', emailArg).single()
  if (error || !row) {
    console.error('Usuario no encontrado en public.users:', error?.message)
    process.exit(1)
  }
  if (!row.auth_user_id) {
    console.error('No hay auth_user_id asociado al usuario')
    process.exit(1)
  }
  const { error: updErr } = await admin.auth.admin.updateUserById(row.auth_user_id, { email_confirm: true, app_metadata: { status: 'activo' } })
  if (updErr) {
    console.error('Error marcando email confirmado:', updErr.message)
    process.exit(1)
  }
  console.log('Email marcado como confirmado en Auth para:', emailArg)
}

main().catch(err => { console.error('Error en confirm-auth-email:', err); process.exitCode = 1 })