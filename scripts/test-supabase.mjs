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

async function testConnection() {
  const report = {
    status: 'unknown',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: !!SUPABASE_URL ? 'present' : 'missing',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!SUPABASE_ANON ? 'present' : 'missing',
      SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE ? 'present' : 'missing',
    },
    checks: {
      networkReachable: null,
      anonAuthSettings: null,
      anonClientPing: null,
      adminListUsers: null,
    },
    errors: [],
    messages: [],
  }

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    report.status = 'fail'
    report.errors.push('Configuración mínima ausente: URL o ANON_KEY')
    return report
  }

  // 1) Network reachability to Supabase project
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON },
    })
    report.checks.networkReachable = res.ok
    report.messages.push(`Reachability /auth/v1/settings: status=${res.status}`)
    if (!res.ok) {
      report.errors.push(`No reachable /auth/v1/settings (status=${res.status})`)
    }
  } catch (err) {
    report.checks.networkReachable = false
    report.errors.push(`Network error reaching Supabase: ${err?.message || err}`)
  }

  // 2) Anon: fetch auth settings JSON to confirm key works
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    })
    const json = await res.json()
    report.checks.anonAuthSettings = res.ok && typeof json === 'object'
    report.messages.push(`Auth settings keys: ${Object.keys(json).join(', ')}`)
  } catch (err) {
    report.checks.anonAuthSettings = false
    report.errors.push(`Error leyendo auth settings con anon: ${err?.message || err}`)
  }

  // 3) Anon client basic call (expecting error but reachable)
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
    const { data, error } = await supabase.auth.getUser('invalid_token')
    // We expect an error; but if error is present, endpoint is reachable
    report.checks.anonClientPing = !!error || !!data
    report.messages.push(`anonClientPing: error=${error ? error.message : 'none'}`)
  } catch (err) {
    report.checks.anonClientPing = false
    report.errors.push(`Error usando supabase-js con ANON: ${err?.message || err}`)
  }

  // 4) Admin: list users (optional)
  if (SUPABASE_SERVICE) {
    try {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE)
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
      report.checks.adminListUsers = !error && Array.isArray(data?.users)
      if (error) report.errors.push(`Admin listUsers error: ${error.message}`)
      else report.messages.push(`Admin listUsers count: ${(data?.users?.length ?? 0)}`)
    } catch (err) {
      report.checks.adminListUsers = false
      report.errors.push(`Error usando Service Role: ${err?.message || err}`)
    }
  } else {
    report.messages.push('Service Role no configurado; omito prueba admin.')
  }

  // Final status
  const criticalChecks = [report.checks.networkReachable, report.checks.anonAuthSettings, report.checks.anonClientPing]
  report.status = criticalChecks.every(Boolean) ? 'success' : 'fail'
  return report
}

(async () => {
  try {
    const report = await testConnection()
    console.log(JSON.stringify(report, null, 2))
    if (report.status !== 'success') process.exitCode = 1
  } catch (err) {
    console.error('Test supabase fatal error:', err)
    process.exitCode = 1
  }
})()