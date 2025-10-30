#!/usr/bin/env node

import { readFileSync } from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Usage: node scripts/test-one-model.mjs gemini-2.5-flash
const targetModel = process.argv[2] || 'gemini-2.5-flash'

// Load API key from .env.local
const envContent = readFileSync('.env.local', 'utf8')
const envLines = envContent.split('\n')
let GEMINI_API_KEY = null

for (const line of envLines) {
  if (line.startsWith('GEMINI_API_KEY=') && !line.startsWith('#')) {
    GEMINI_API_KEY = line.split('=')[1].trim()
    break
  }
}

if (!GEMINI_API_KEY) {
  console.error('❌ No se encontró GEMINI_API_KEY en .env.local')
  process.exit(1)
}

console.log(`🔑 Clave: ${GEMINI_API_KEY.substring(0, 10)}...`)
console.log(`🔍 Probando modelo específico: ${targetModel}`)

try {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: targetModel })
  const result = await model.generateContent('Responde solo "OK"')
  const text = result.response.text().trim()
  console.log(`✅ ${targetModel}: FUNCIONA - Respuesta: "${text}"`)
  process.exit(0)
} catch (error) {
  const msg = error?.message || String(error)
  if (msg.includes('404')) console.error(`❌ ${targetModel}: No encontrado (404)`) 
  else if (msg.includes('403')) console.error(`❌ ${targetModel}: No autorizado (403)`) 
  else if (msg.includes('quota')) console.error(`⚠️ ${targetModel}: Cuota excedida`) 
  else if (msg.includes('API key not valid')) console.error(`❌ Clave API inválida o expirada`) 
  else console.error(`❌ Error: ${msg}`)
  process.exit(1)
}