# v0.1.1

## Cambios destacados

- Autenticación: todas las consultas del chat usan Supabase autenticado con el token del usuario (RLS cumplido).
- UX: se restaura el saludo paisa en el Paso 0 del flujo.
- Resumen del brief: `respuestasBrief` ahora es un arreglo de `{ pregunta, respuesta }`. 
  - En Paso 3 se guarda texto completo de la pregunta y la respuesta (incluye lógica de asesor: recomendación/explicación).
  - `buildResumen` en Paso 6 imprime la pregunta completa junto a la respuesta.
- Infra: se elimina la dependencia de `ai` (Vercel AI SDK) para `StreamingTextResponse`; se usa `Response` con `ReadableStream` nativo.

## Detalles técnicos

- Archivo: `src/app/api/ai/chat/route.ts`.
- Autenticación:
  - Se extrae `Authorization: Bearer <token>` y se obtiene el usuario con `getUserFromAuthHeader(req)`.
  - Se inicializa el cliente con `getSupabaseServerWithToken(token)`.
  - Todas las consultas de clientes (`clientes_digix`), servicios (`servicios`), y brief (`brief_preguntas`) usan el cliente autenticado.
- Estado de sesión:
  - `respuestasBrief: Array<{ pregunta: string; respuesta: string }>`.
  - Se formatea el resumen final mostrando pregunta y respuesta.
- Saludo (Paso 0): se restaura el saludo paisa específico.
- Cierre (Paso 6): respuesta con streaming nativo usando `ReadableStream`.

## Cómo probar

1. Iniciar el servidor: `npm run dev`.
2. Autenticarse en la app para obtener un token (middleware RLS activo).
3. Flujo del chat:
   - Paso 0: verificar saludo paisa.
   - Paso 1: buscar cliente y subdivisión.
   - Paso 2: seleccionar servicio.
   - Paso 3: responder preguntas del brief; usar frases como "recomiendame" o "explícame" para validar asesor experto.
   - Paso 4: suministrar link de diseño o "NO".
   - Paso 5: agregar observaciones.
   - Paso 6: confirmar que el resumen muestra preguntas completas con sus respuestas.

## Notas de despliegue

- Import sensible a mayúsculas/minúsculas: `@/lib/supabase/server` (asegurar que el archivo es `src/lib/supabase/server.ts`).
- Eliminar dependencias no usadas de `ai` si existían.
- Tag creado: `v0.1.1`.
- Commit base: `0504405` en rama `main`.