# Integración de Gemini (Google Generative AI)

Esta implementación añade capacidades de IA al sistema usando la API de Gemini.

## Variables de entorno

Crea o actualiza `.env.local` en la raíz del proyecto:

```
# Clave de Gemini (no exponer en cliente)
GEMINI_API_KEY=tu_clave_aqui

# (Opcional) Timeout para la API de IA (ms)
AI_TIMEOUT_MS=15000
```

- La clave debe mantenerse privada y solo se usa en código de servidor.
- No se expone en el navegador ni en la UI.

## Paquetes

Se instala el SDK oficial:

```
npm install @google/generative-ai
```

Nota: Con `@google/generative-ai@0.24.1` inicializa el cliente con `new GoogleGenerativeAI(apiKey)` (string), no con objeto.

## Utilidad de servidor

`src/lib/ai/gemini.ts` inicializa el cliente con `GEMINI_API_KEY` y expone `streamTextFromPrompt()` usando el modelo por defecto `gemini-2.5-flash` (baja latencia). Puedes cambiar a otros modelos actuales como `gemini-2.5-pro` o `gemini-2.0-flash` pasando `{ model: '...' }`.

## Endpoint

`POST /api/ai/chat` recibe `{ prompt: string }` y devuelve una respuesta en streaming (`text/plain`). Maneja:
- Validación de `prompt`.
- Timeout configurable con `AI_TIMEOUT_MS`.
- Mensajes de error claros.

## UI

La página `src/app/app/page.tsx` envía el mensaje del usuario al endpoint y muestra la respuesta del asistente en tiempo real usando `ReadableStream` en el navegador. Incluye:
- Cancelación por timeout (20s en cliente).
- Actualización incremental del mensaje del asistente.
- Manejo de errores con mensajes visibles.

## Seguridad

- La clave `GEMINI_API_KEY` se lee únicamente en el servidor.
- Las solicitudes desde la UI siempre pasan por el endpoint interno; nunca se envía la clave al cliente.

## Rendimiento y escalabilidad

- Se usa `gemini-2.5-flash` para respuestas rápidas y costo eficiente.
- El diseño separa UI, endpoint y utilidad, permitiendo ampliaciones futuras (historial de chat, roles del sistema, selección dinámica de modelos, caching, y observabilidad).

## Ejemplo de uso (curl)

```
curl -N -X POST http://localhost:3000/api/ai/chat \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Escribe un saludo breve y amable"}'
```

La respuesta se envía en texto plano por fragmentos.

## Problemas comunes

- "La clave de Gemini es inválida o no autorizada": verifica que se use `new GoogleGenerativeAI(apiKey)` y que el modelo sea actual (`gemini-2.5-*`).
- Modelos retirados: evita `gemini-1.0-*` y `gemini-1.5-*`; usa `gemini-2.5-flash` o `gemini-2.5-pro`.