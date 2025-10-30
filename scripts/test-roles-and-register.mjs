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
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

function assertConfigured() {
  const missing = []
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SUPABASE_ANON) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!SUPABASE_SERVICE) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (missing.length) throw new Error('Config faltante: ' + missing.join(', '))
}

function makeCreds() {
  const uname = `tester_${Math.random().toString(36).slice(2, 8)}`
  const email = `${uname}@example.com`
  const password = `Aa${Math.random().toString(36).slice(2, 6)}!${Date.now().toString().slice(-4)}`
  return { full_name: uname, email, password }
}

async function main() {
  assertConfigured()
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE)

  const report = { roles: { present: [], ensured: false }, register: { status: null, body: null }, cleanup: { deleted: false }, errors: [] }

  // Check roles table exists and contains base roles
  try {
    const { data } = await admin.from('roles').select('id, code, name')
    report.roles.present = (data || []).map(r => r.code)
    // Ensure base roles present
    const missing = ['solicitante', 'administrador'].filter(r => !report.roles.present.includes(r))
    if (missing.length) {
      const inserts = missing.map(code => ({ code, name: code === 'solicitante' ? 'Solicitante' : 'Administrador' }))
      await admin.from('roles').insert(inserts)
      report.roles.ensured = true
    }
  } catch (err) {
    report.errors.push('Error comprobando/sembrando roles: ' + (err?.message || err))
  }

  // Attempt public registration via API
  const creds = makeCreds()
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': 'dev', origin: process.env.NEXT_PUBLIC_SITE_URL || BASE_URL },
    body: JSON.stringify({ full_name: creds.full_name, email: creds.email, password: creds.password, role: 'solicitante', status: 'activo' }),
  })
  report.register.status = res.status
  try { report.register.body = await res.json() } catch { report.register.body = null }

  // Cleanup: delete created auth user if registration succeeded
  try {
    if (res.status === 201) {
      const userId = report.register.body?.auth_user_id
      if (userId) {
        const { error } = await admin.auth.admin.deleteUser(userId)
        if (!error) report.cleanup.deleted = true
      }
    }
  } catch (err) {
    report.errors.push('Error en cleanup: ' + (err?.message || err))
  }

  const outDir = path.join(projectRoot, 'test-reports')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `roles-register-test-${Date.now()}.json`)
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
  console.log('Reporte generado en:', outPath)
  console.log(JSON.stringify(report, null, 2))

  if (report.register.status !== 201) {
    process.exitCode = 1
  }
}

main().catch(err => { console.error('Fallo en test roles+register:', err); process.exitCode = 1 })