#!/usr/bin/env node

/**
 * Script para listar modelos disponibles de Gemini
 * Ejecutar: node scripts/list-gemini-models.mjs
 */

import { readFileSync } from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Cargar variables de entorno manualmente
const envContent = readFileSync('.env.local', 'utf8')
const envLines = envContent.split('\n')
let GEMINI_API_KEY = null

for (const line of envLines) {
  if (line.startsWith('GEMINI_API_KEY=') && !line.startsWith('#')) {
    GEMINI_API_KEY = line.split('=')[1]
    break
  }
}

console.log('🔍 Listando modelos disponibles de Gemini...\n')

if (!GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY no está definida en .env.local')
  process.exit(1)
}

try {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  
  console.log('📋 Modelos disponibles:')
  
  // Intentar con diferentes modelos conocidos
  const modelsToTest = [
    'gemini-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.0-pro',
    'text-bison-001'
  ]
  
  for (const modelName of modelsToTest) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent('Test')
      console.log(`✅ ${modelName} - Disponible`)
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('404')) {
        console.log(`❌ ${modelName} - No disponible`)
      } else if (error.message.includes('API key not valid')) {
        console.log(`🔑 ${modelName} - Clave API inválida`)
        break
      } else {
        console.log(`⚠️  ${modelName} - Error: ${error.message.substring(0, 100)}...`)
      }
    }
  }
  
} catch (error) {
  console.error('❌ Error general:', error.message)
}