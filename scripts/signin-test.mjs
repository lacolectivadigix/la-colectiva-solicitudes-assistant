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

function usage() {
  console.log('Usage: node scripts/signin-test.mjs <email> <password>')
}

loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Falta configuración: NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Define en .env.local')
  process.exit(1)
}

const [,, emailArg, passArg] = process.argv
if (!emailArg || !passArg) {
  usage()
  process.exit(1)
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
  const { data, error } = await supabase.auth.signInWithPassword({ email: emailArg, password: passArg })
  if (error) {
    console.error('Login fallido:', error.message)
    process.exitCode = 1
    return
  }
  console.log('Login OK. User:', { id: data.user?.id, email: data.user?.email })
  console.log('Session:', { access_token: !!data.session?.access_token, expires_in: data.session?.expires_in })
}

main().catch(err => { console.error('Error en signin-test:', err); process.exitCode = 1 })