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

const genAI = new GoogleGenerativeAI(apiKey)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

console.log('🧪 Streaming prueba con gemini-2.5-flash...')

try {
  const result = await model.generateContentStream({
    contents: [{ role: 'user', parts: [{ text: 'Di Hola en una palabra' }]}]
  })
  let full = ''
  for await (const chunk of result.stream) {
    const text = chunk.text()
    full += text
    process.stdout.write(text)
  }
  console.log('\n✅ Stream completado. Texto:', full.trim())
} catch (err) {
  console.error('❌ Error en stream:', err.message)
  process.exit(1)
}