import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// Leer la clave API desde .env.local
const envPath = path.join(process.cwd(), '.env.local');
let apiKey = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('GEMINI_API_KEY=') && !line.startsWith('#')) {
      apiKey = line.split('=')[1].trim();
      break;
    }
  }
} catch (error) {
  console.error('❌ Error leyendo .env.local:', error.message);
  process.exit(1);
}

if (!apiKey) {
  console.error('❌ No se encontró GEMINI_API_KEY en .env.local');
  process.exit(1);
}

console.log('🔑 Clave API encontrada:', apiKey.substring(0, 10) + '...');
console.log('📏 Longitud de la clave:', apiKey.length);

// Modelos actuales de Gemini (2024-2025)
const currentModels = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-pro',  // Alias actual
  'gemini-flash-latest'  // Alias actual
];

const genAI = new GoogleGenerativeAI(apiKey);

console.log('\n🧪 Probando modelos actuales de Gemini...\n');

for (const modelName of currentModels) {
  try {
    console.log(`🔍 Probando modelo: ${modelName}`);
    
    const model = genAI.getGenerativeModel({ model: modelName });
    
    // Prueba simple de generación
    const result = await model.generateContent("Di 'Hola' en una palabra");
    const response = await result.response;
    const text = response.text();
    
    console.log(`✅ ${modelName}: FUNCIONA - Respuesta: "${text.trim()}"`);
    console.log(`   📊 Tokens de entrada: ~5, Tokens de salida: ~${text.length/4}`);
    
    // Si encontramos un modelo que funciona, podemos parar aquí
    console.log(`\n🎉 ¡ÉXITO! El modelo "${modelName}" está funcionando correctamente.`);
    console.log(`💡 Usa este modelo en tu aplicación.`);
    break;
    
  } catch (error) {
    if (error.message.includes('404')) {
      console.log(`❌ ${modelName}: No encontrado (404)`);
    } else if (error.message.includes('403')) {
      console.log(`❌ ${modelName}: Sin permisos (403)`);
    } else if (error.message.includes('429')) {
      console.log(`❌ ${modelName}: Límite de cuota excedido (429)`);
    } else {
      console.log(`❌ ${modelName}: Error - ${error.message}`);
    }
  }
}

console.log('\n📋 Resumen:');
console.log('- Si ningún modelo funciona, verifica que tu clave API tenga permisos para Gemini API');
console.log('- Si ves errores 404, los modelos pueden no estar disponibles en tu región');
console.log('- Si ves errores 403, tu clave API no tiene permisos suficientes');
console.log('- Si ves errores 429, has excedido tu cuota de API');