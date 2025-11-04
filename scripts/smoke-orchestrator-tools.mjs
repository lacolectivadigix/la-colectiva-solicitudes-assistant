#!/usr/bin/env node
/**
 * Smoke test: Orquestador (Briel 2.0) + herramientas
 *
 * Requiere:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * - (Opcional) SUPABASE_SERVICE_ROLE_KEY para crear usuario de prueba
 * - Dev server corriendo (usar TEST_BASE_URL para puerto distinto a 3001)
 *
 * Uso:
 *   node scripts/smoke-orchestrator-tools.mjs               → crea usuario aleatorio y ejecuta prueba
 *   node scripts/smoke-orchestrator-tools.mjs <email> <pass> → usa credenciales dadas
 */

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
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001'
const PAUSE_MS = Number(process.env.SMOKE_PAUSE_MS || 2500)
const SMOKE_USER_PATH = path.join(projectRoot, 'scripts', '.smoke-user.json')

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Faltan envs: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const admin = SUPABASE_SERVICE ? createClient(SUPABASE_URL, SUPABASE_SERVICE) : null
const pub = createClient(SUPABASE_URL, SUPABASE_ANON)

function randStr(n = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  while (s.length < n) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function ensureCreds(emailArg, passArg) {
  if (emailArg && passArg) return { email: emailArg, password: passArg }
  // Reutilizar usuario de prueba si existe
  if (fs.existsSync(SMOKE_USER_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(SMOKE_USER_PATH, 'utf8'))
      if (saved?.email && saved?.password) return saved
    } catch {}
  }
  if (!admin) {
    console.error('No hay SUPABASE_SERVICE_ROLE_KEY y no hay usuario guardado; proporciona email y password como argumentos.')
    process.exit(1)
  }
  const username = `smoke_${randStr(6)}`
  const creds = {
    email: `${username}@example.com`,
    password: `Aa${randStr(10)}!`,
    username,
  }
  const { error } = await admin.auth.admin.createUser({
    email: creds.email,
    password: creds.password,
    user_metadata: { username: creds.username, role: 'solicitante' },
    email_confirm: true,
  })
  if (error) {
    console.error('Error creando usuario:', error.message)
    process.exit(1)
  }
  // Guardar usuario para reutilizar la sesión en ejecuciones posteriores
  try { fs.writeFileSync(SMOKE_USER_PATH, JSON.stringify(creds), 'utf8') } catch {}
  return creds
}

async function authToken(email, password) {
  const { data, error } = await pub.auth.signInWithPassword({ email, password })
  if (error) {
    console.error('Login fallido:', error.message)
    process.exit(1)
  }
  const token = data.session?.access_token
  if (!token) {
    console.error('No se obtuvo access_token tras login')
    process.exit(1)
  }
  return token
}

async function callChat(token, text, { reset = false } = {}) {
  const res = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(reset ? { 'x-reset-session': 'true' } : {}),
    },
    body: JSON.stringify({ prompt: text }),
  })
  const bodyText = await res.text()
  return { status: res.status, text: bodyText }
}

async function main() {
  let emailArg = process.argv[2]
  let passArg = process.argv[3]
  let modeArg = process.argv[4]
  // Normalización: si solo se pasa un argumento y es un modo, úsalo como modo
  const possibleModes = new Set(['reply_client_only', 'phase10', 'phase11'])
  if (emailArg && !passArg && possibleModes.has(emailArg)) {
    modeArg = emailArg
    emailArg = undefined
  }
  const creds = await ensureCreds(emailArg, passArg)
  const token = await authToken(creds.email, creds.password)
  console.log(`Credenciales de prueba → email: ${creds.email} | pass: ${creds.password}`)

  if (modeArg === 'reply_client_only') {
    console.log('Modo: reply_client_only. Enviar solo aclaración de cliente en sesión existente...')
    const mensaje11 = 'Sí, es correcto: el cliente es MSD COLOMBIA - ONCO para el proyecto "Lanzamiento Anual Vacunas".'
    const r11 = await callChat(token, mensaje11, { reset: false })
    console.log('\nPOST /api/ai/chat →', r11.status)
    console.log('\nRespuesta (assistant):\n', r11.text)
    await sleep(PAUSE_MS)
    return
  }

  if (modeArg === 'phase10') {
    console.log('Modo: phase10. Reanudar desde turno 10 en misma sesión (sin reset)...')
    const mensaje10 = 'Quiero que sea en Couche de 150gr.'
    const r10 = await callChat(token, mensaje10, { reset: false })
    console.log('\nPOST /api/ai/chat →', r10.status)
    console.log('\nRespuesta (assistant):\n', r10.text)
    await sleep(PAUSE_MS)

    const mensaje11 = 'Será 4/4 full color ambas caras.'
    const r11 = await callChat(token, mensaje11, { reset: false })
    console.log('\nPOST /api/ai/chat →', r11.status)
    console.log('\nRespuesta (assistant):\n', r11.text)
    await sleep(PAUSE_MS)
    return
  }

  if (modeArg === 'phase11') {
    console.log('Modo: phase11. Enviar respuesta a la última pregunta (Plegado/Acabado)...')
    const mensaje12 = 'Será plegado en Z y con laminado mate.'
    const r12 = await callChat(token, mensaje12, { reset: false })
    console.log('\nPOST /api/ai/chat →', r12.status)
    console.log('\nRespuesta (assistant):\n', r12.text)
    await sleep(PAUSE_MS)
    return
  }
  console.log('Token OK. Enviando primer mensaje (reset de sesión)...')

  const mensaje1 = 'Hola, quiero cotizar 500 flyers para MSD Colombia'
  const r1 = await callChat(token, mensaje1, { reset: true })
  console.log('\nPOST /api/ai/chat →', r1.status)
  console.log('\nRespuesta (assistant):\n', r1.text)
  await sleep(PAUSE_MS)

  console.log('\nEnviando segundo mensaje (misma sesión)...')
  const mensaje2 = 'MSD COLOMBIA - ONCO. Necesito 500 flyers.'
  const r2 = await callChat(token, mensaje2, { reset: false })
  console.log('\nPOST /api/ai/chat →', r2.status)
  console.log('\nRespuesta (assistant):\n', r2.text)
  await sleep(PAUSE_MS)

  console.log('\nEnviando tercer mensaje (misma sesión, término específico)...')
  const mensaje3 = 'Necesito IMPRESION VOLANTES A5.'
  const r3 = await callChat(token, mensaje3, { reset: false })
  console.log('\nPOST /api/ai/chat →', r3.status)
  console.log('\nRespuesta (assistant):\n', r3.text)
  await sleep(PAUSE_MS)

  console.log('\nEnviando cuarto mensaje (misma sesión, respuesta a pregunta 1)...')
  const mensaje4 = "Es para el proyecto 'Lanzamiento Anual Vacunas'."
  const r4 = await callChat(token, mensaje4, { reset: false })
  console.log('\nPOST /api/ai/chat →', r4.status)
  console.log('\nRespuesta (assistant):\n', r4.text)
  await sleep(PAUSE_MS)

  console.log('\nEnviando quinto mensaje (misma sesión, respuesta a pregunta 2)...')
  const mensaje5 = 'Necesito que esté listo el 15 de noviembre.'
  const r5 = await callChat(token, mensaje5, { reset: false })
  console.log('\nPOST /api/ai/chat →', r5.status)
  console.log('\nRespuesta (assistant):\n', r5.text)
  await sleep(PAUSE_MS)

  console.log('\nEnviando sexto mensaje (misma sesión, respuesta a pregunta 3)...')
  const mensaje6 = 'Será en Bogotá, Colombia.'
  const r6 = await callChat(token, mensaje6, { reset: false })
  console.log('\nPOST /api/ai/chat →', r6.status)
  console.log('\nRespuesta (assistant):\n', r6.text)
  await sleep(PAUSE_MS)

  console.log('\nEnviando séptimo mensaje (misma sesión, respuesta a pregunta 4)...')
  const mensaje7 = 'Será en la Calle Falsa 123, Oficina 404.'
  const r7 = await callChat(token, mensaje7, { reset: false })
  console.log('\nPOST /api/ai/chat →', r7.status)
  console.log('\nRespuesta (assistant):\n', r7.text)
  await sleep(PAUSE_MS)

  console.log('\nEnviando octavo mensaje (misma sesión, respuesta a pregunta 5: Producto y Cantidad)...')
  const mensaje8 = 'Serán 500 flyers, como te dije.'
  const r8 = await callChat(token, mensaje8, { reset: false })
  console.log('\nPOST /api/ai/chat →', r8.status)
  console.log('\nRespuesta (assistant):\n', r8.text)
  await sleep(PAUSE_MS)

  console.log('\nEnviando noveno mensaje (misma sesión, respuesta a pregunta 6: Medidas/Formato)...')
  const mensaje9 = 'Serán tamaño A5 (148 x 210 mm).'
  const r9 = await callChat(token, mensaje9, { reset: false })
  console.log('\nPOST /api/ai/chat →', r9.status)
  console.log('\nRespuesta (assistant):\n', r9.text)
  await sleep(PAUSE_MS)

  console.log('\nEnviando décimo mensaje (misma sesión, respuesta a pregunta 7: Papel y Gramaje)...')
  const mensaje10 = 'Quiero que sea en Couche de 150gr.'
  const r10 = await callChat(token, mensaje10, { reset: false })
  console.log('\nPOST /api/ai/chat →', r10.status)
  console.log('\nRespuesta (assistant):\n', r10.text)
  await sleep(PAUSE_MS)

  console.log('\nEnviando undécimo mensaje (misma sesión, respuesta a pregunta 8: Impresión y Caras)...')
  const mensaje11 = 'Será 4/4 full color ambas caras.'
  const r11 = await callChat(token, mensaje11, { reset: false })
  console.log('\nPOST /api/ai/chat →', r11.status)
  console.log('\nRespuesta (assistant):\n', r11.text)
  await sleep(PAUSE_MS)
  await sleep(600)

  if (admin && !emailArg && process.env.KEEP_TEST_USER !== '1') {
    try {
      const { data: userInfo } = await pub.auth.getUser(token)
      const userId = userInfo?.user?.id
      if (userId) await admin.auth.admin.deleteUser(userId)
      console.log('\nUsuario de prueba eliminado.')
      try { if (fs.existsSync(SMOKE_USER_PATH)) fs.unlinkSync(SMOKE_USER_PATH) } catch {}
    } catch {}
  }
}

main().catch(err => { console.error('Error en smoke-orchestrator-tools:', err); process.exitCode = 1 })