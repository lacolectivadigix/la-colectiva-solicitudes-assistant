#!/usr/bin/env node

/**
 * Prueba directa de la API de Gemini con diferentes modelos
 */

import { readFileSync } from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Cargar clave API
const envContent = readFileSync('.env.local', 'utf8')
const envLines = envContent.split('\n')
let GEMINI_API_KEY = null

for (const line of envLines) {
  if (line.startsWith('GEMINI_API_KEY=') && !line.startsWith('#')) {
    GEMINI_API_KEY = line.split('=')[1]
    break
  }
}

console.log('🔍 Probando conexión directa con Gemini...\n')

if (!GEMINI_API_KEY) {
  console.error('❌ No se encontró GEMINI_API_KEY')
  process.exit(1)
}

console.log(`🔑 Clave: ${GEMINI_API_KEY.substring(0, 10)}...${GEMINI_API_KEY.substring(-4)}`)

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

// Probar modelos más simples
const modelsToTest = [
  'gemini-pro',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-latest',
  'models/gemini-pro',
  'models/gemini-1.5-pro',
  'models/gemini-1.5-flash'
]

for (const modelName of modelsToTest) {
  try {
    console.log(`\n🧪 Probando modelo: ${modelName}`)
    
    const model = genAI.getGenerativeModel({ 
      model: modelName
    })
    
    const result = await model.generateContent('Responde solo "OK"')
    const response = result.response.text()
    
    console.log(`✅ ${modelName} - FUNCIONA`)
    console.log(`   Respuesta: "${response.trim()}"`)
    
    // Si encontramos uno que funciona, salimos
    console.log(`\n🎉 ¡Modelo funcional encontrado: ${modelName}!`)
    process.exit(0)
    
  } catch (error) {
    if (error.message.includes('API key not valid')) {
      console.log(`❌ ${modelName} - Clave API inválida`)
      console.log('   → La clave no tiene permisos o ha expirado')
      break
    } else if (error.message.includes('not found') || error.message.includes('404')) {
      console.log(`❌ ${modelName} - Modelo no encontrado`)
    } else if (error.message.includes('quota')) {
      console.log(`⚠️  ${modelName} - Cuota excedida`)
    } else {
      console.log(`⚠️  ${modelName} - Error: ${error.message.substring(0, 80)}...`)
    }
  }
}

console.log('\n❌ Ningún modelo funcionó. Posibles causas:')
console.log('   1. La clave API no tiene permisos para Generative Language API')
console.log('   2. La clave ha expirado o fue revocada')
console.log('   3. Hay restricciones de región o cuota')
console.log('\n💡 Solución: Genera una nueva clave en https://aistudio.google.com/app/apikey')