#!/usr/bin/env node
import { readFileSync } from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'

const envContent = readFileSync('.env.local', 'utf8')
let apiKey = null
for (const line of envContent.split('\n')) {
  if (line.startsWith('GEMINI_API_KEY=') && !line.startsWith('#')) {
    apiKey = line.split('=')[1].trim()
    break
  }
}
if (!apiKey) { console.error('❌ No key'); process.exit(1) }

console.log('🧪 Probando constructor con objeto { apiKey } y con string')

try {
  const clientObj = new GoogleGenerativeAI({ apiKey })
  const modelObj = clientObj.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const resultObj = await modelObj.generateContent({ contents: [{ role: 'user', parts: [{ text: 'Hola?' }]}] })
  console.log('✅ Objeto apiKey OK:', resultObj.response.text())
} catch (err) {
  console.error('❌ Falla con objeto { apiKey }:', err?.message)
}

try {
  const clientStr = new GoogleGenerativeAI(apiKey)
  const modelStr = clientStr.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const resultStr = await modelStr.generateContent({ contents: [{ role: 'user', parts: [{ text: 'Hola?' }]}] })
  console.log('✅ String apiKey OK:', resultStr.response.text())
} catch (err) {
  console.error('❌ Falla con string apiKey:', err?.message)
}