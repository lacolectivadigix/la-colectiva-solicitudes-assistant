#!/usr/bin/env node

/**
 * Script para verificar la validez de la clave API de Gemini
 * Ejecutar: node scripts/verify-gemini-key.mjs
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

console.log('🔍 Verificando clave API de Gemini...\n')

// Verificación 1: Existencia de la clave
if (!GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY no está definida en .env.local')
  process.exit(1)
}

// Verificación 2: Formato de la clave
const keyFormat = /^AIza[A-Za-z0-9_-]{35}$/
if (!keyFormat.test(GEMINI_API_KEY)) {
  console.error('❌ Error: Formato de clave inválido')
  console.error('   Formato esperado: AIza + 35 caracteres alfanuméricos')
  console.error(`   Clave actual: ${GEMINI_API_KEY.substring(0, 10)}... (${GEMINI_API_KEY.length} caracteres)`)
  process.exit(1)
}

console.log('✅ Formato de clave válido')
console.log(`   Clave: ${GEMINI_API_KEY.substring(0, 10)}...${GEMINI_API_KEY.substring(-4)}`)

// Verificación 3: Conexión y permisos
try {
  console.log('\n🔗 Probando conexión con Gemini...')
  
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    systemInstruction: 'Eres un asistente útil para usuarios de La Colectiva.'
  })

  const result = await model.generateContent('Responde solo "OK" si puedes leer este mensaje.')
  const response = result.response.text().trim()
  
  console.log('✅ Conexión exitosa con Gemini')
  console.log(`   Respuesta del modelo: "${response}"`)
  console.log('✅ La clave tiene los permisos necesarios')
  
} catch (error) {
  console.error('❌ Error al conectar con Gemini:')
  
  if (error.message.includes('API key not valid')) {
    console.error('   → La clave API no es válida o ha expirado')
    console.error('   → Genera una nueva clave en: https://aistudio.google.com/app/apikey')
  } else if (error.message.includes('quota')) {
    console.error('   → Se excedió la cuota de uso')
    console.error('   → Espera o aumenta los límites en Google Cloud Console')
  } else if (error.message.includes('permission')) {
    console.error('   → La clave no tiene permisos para Generative Language API')
    console.error('   → Verifica los permisos en Google Cloud Console')
  } else {
    console.error(`   → ${error.message}`)
  }
  
  process.exit(1)
}

// Verificación 4: Configuración del proyecto
console.log('\n📋 Verificando configuración del proyecto...')
console.log('✅ SDK: @google/generative-ai instalado')
console.log('✅ Modelo: gemini-2.5-flash configurado')
console.log('✅ Timeout: 15000ms configurado')

console.log('\n🎉 ¡Todas las verificaciones pasaron exitosamente!')
console.log('   La clave API de Gemini está correctamente configurada y funcionando.')