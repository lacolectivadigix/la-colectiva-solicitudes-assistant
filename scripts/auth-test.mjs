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
  if (missing.length) {
    throw new Error(`Config faltante: ${missing.join(', ')}. Define en .env.local`) 
  }
}

function makeCredentials() {
  const username = `user${Math.random().toString(36).slice(2, 8)}${Date.now().toString().slice(-2)}`
  const email = `${username}@example.com`
  const password = `Aa${Math.random().toString(36).slice(2, 6)}!${Date.now().toString().slice(-4)}`
  const role = 'usuario_prueba'
  return { username, email, password, role }
}

async function main() {
  assertConfigured()
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE)
  const pub = createClient(SUPABASE_URL, SUPABASE_ANON)

  const creds = makeCredentials()
  const report = { created: false, login: false, routes: {}, userMatch: false, deleted: false, details: { creds } }

  // Crear usuario con confirmación de email marcada
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: creds.email,
    password: creds.password,
    user_metadata: { username: creds.username, role: creds.role },
    email_confirm: true,
  })
  if (createErr) throw new Error(`Error creando usuario: ${createErr.message}`)
  report.created = !!created?.user

  // Login con password
  const { data: loginData, error: loginErr } = await pub.auth.signInWithPassword({ email: creds.email, password: creds.password })
  if (loginErr) throw new Error(`Login fallido: ${loginErr.message}`)
  report.login = !!loginData?.user

  const accessToken = loginData.session?.access_token
  if (!accessToken) throw new Error('No se obtuvo access token tras login')

  // Verificar acceso a 3 rutas protegidas
  const routes = ['/api/protected/one', '/api/protected/two', '/api/protected/three']
  for (const r of routes) {
    const res = await fetch(`${BASE_URL}${r}`, { headers: { authorization: `Bearer ${accessToken}` } })
    report.routes[r] = { status: res.status }
    if (res.status !== 200) {
      throw new Error(`Ruta protegida ${r} no devolvió 200 (status=${res.status})`)
    }
    const json = await res.json()
    report.routes[r].body = json
  }

  // Comprobar datos del usuario
  const sample = report.routes['/api/protected/one'].body.user
  const matches = sample?.email === creds.email && sample?.username === creds.username && sample?.role === creds.role
  report.userMatch = matches

  // Eliminar usuario
  const userId = created?.user?.id || loginData.user?.id
  if (!userId) throw new Error('No se pudo determinar el ID del usuario para borrar')
  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) throw new Error(`Error eliminando usuario: ${delErr.message}`)
  report.deleted = true

  // Guardar reporte en disco
  const reportDir = path.join(projectRoot, 'test-reports')
  fs.mkdirSync(reportDir, { recursive: true })
  const outPath = path.join(reportDir, `auth-test-report-${Date.now()}.json`)
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')

  console.log('Reporte de autenticación generado en:', outPath)
  console.log(JSON.stringify(report, null, 2))
}

main().catch(err => {
  console.error('Fallo en pruebas de autenticación:', err)
  process.exitCode = 1
})