#!/usr/bin/env node
/**
 * Smoke test: Paso 3 del chat con servicio_id
 *
 * Requiere:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * - Dev server corriendo en http://localhost:3001 (npm run dev -p 3001)
 * - Credenciales Supabase (email y password) para obtener access_token
 *
 * Uso:
 *   node scripts/test-brief-paso3.mjs <email> <password>
 *
 * Flujo simulado:
 * 1) INICIAL → saludo
 * 2) PASO 1 → cliente "GSK"
 * 3) PASO 2 → servicio "IMPRESION VOLANTES A5" (id 101 en cache)
 * 4) PASO 3 → carga preguntas y formula en orden (generales y específicas por servicio_id)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001'

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Faltan envs: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const email = process.argv[2]
const password = process.argv[3]
if (!email || !password) {
  console.error('Uso: node scripts/test-brief-paso3.mjs <email> <password>')
  process.exit(1)
}

async function authToken() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error('Login fallido: ' + error.message)
  const token = data.session?.access_token
  if (!token) throw new Error('No se obtuvo access_token')
  return token
}

async function callChat(token, prompt) {
  const res = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  })
  const text = await res.text()
  return { status: res.status, text }
}

async function main() {
  const token = await authToken()
  console.log('Token OK. Iniciando flujo...')

  // Paso 0 → saludo
  let r = await callChat(token, 'hola')
  console.log('Paso 0 →', r.status, '\n', r.text)

  // Paso 1 → cliente
  r = await callChat(token, 'GSK')
  console.log('Paso 1 →', r.status, '\n', r.text)

  // Paso 2 → servicio
  r = await callChat(token, 'IMPRESION VOLANTES A5')
  console.log('Paso 2 →', r.status, '\n', r.text)

  // Paso 3 → primeras preguntas
  r = await callChat(token, 'ok')
  console.log('Paso 3 (Q1) →', r.status, '\n', r.text)

  // Responder Q1 para avanzar a Q2 (general)
  r = await callChat(token, 'Objetivo: difusión')
  console.log('Paso 3 (Q2) →', r.status, '\n', r.text)

  // Responder Q2 para avanzar a Q3 (general)
  r = await callChat(token, 'Público: adultos')
  console.log('Paso 3 (Q3) →', r.status, '\n', r.text)

  // Responder Q3 para intentar llegar a específica por servicio_id
  r = await callChat(token, 'Fecha: mañana')
  console.log('Paso 3 (Q4 específica) →', r.status, '\n', r.text)

  if (/Tamaño final del volante/i.test(r.text)) {
    console.log('OK: Pregunta específica por servicio_id detectada.')
  } else {
    console.warn('ATENCIÓN: No apareció la pregunta específica por servicio_id. Revisar cache y datos.')
  }
}

main().catch(err => { console.error('Error en test-brief-paso3:', err); process.exitCode = 1 })