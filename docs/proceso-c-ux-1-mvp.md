# Proceso de implementación: feature/c-ux-1-mvp

Este documento describe los cambios recientes enfocados en el flujo del asistente IA, la eliminación de KV y cron, y la corrección del endpoint `POST /api/ai/chat` para Next.js 16 (Turbopack).

## Resumen de cambios
- Eliminado Vercel KV y jobs de cron.
- Lecturas directas a Supabase (RLS) desde el servidor.
- Refactor en `src/app/api/ai/chat/route.ts`:
  - Removida dependencia de `StreamingTextResponse` del paquete `ai`.
  - Uso de `Response` nativo con `ReadableStream` para streaming en texto plano.
  - Ajuste de autenticación: `getUserFromAuthHeader(req)` devuelve solo `user`; el `token` se obtiene de `Authorization: Bearer <token>`.
  - Guardas de estado TypeScript alineadas con los tipos literales.
- Limpieza de `vercel.json` eliminando cron.

## Detalles técnicos clave
### Autenticación en chat
- `user = await getUserFromAuthHeader(req)`
- `token = req.headers.get('authorization')?.replace('Bearer ', '')`
- Si no hay `user` o `token`: `401 Acceso no autorizado`.
- Cliente con token: `getSupabaseServerWithToken(token)`.

### Streaming en Next.js 16
- Antes: `return new StreamingTextResponse(stream)` (ya no disponible).
- Ahora: `return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8' } })`.

### Guardas de estado (control de flujo)
- Paso 0 (saludo): `state.step === 'INICIAL'`.
- Paso 1 (cliente – búsqueda inicial): `state.step === 'ESPERANDO_CLIENTE' && !state.clienteNombre`.
- Paso 2 (servicio – búsqueda inicial): `state.step === 'ESPERANDO_SERVICIO' && (!state.opcionesServicios || state.opcionesServicios.length === 0)`.
- La desambiguación de servicio debe ocurrir en un bloque separado cuando `state.opcionesServicios?.length > 0`.

## QA y pruebas sugeridas
### Variables de entorno (Vercel y local)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` (solo para scripts admin/health).
- `GEMINI_API_KEY` (streaming IA).

### Smoke test (local)
1. Servidor: `npm run dev` (o `npm run dev -- -p 3001`).
2. Sin token:
   - `POST /api/ai/chat` → `401 Acceso no autorizado`.
3. Con token inválido:
   - `Authorization: Bearer invalid_token` → `401 Acceso no autorizado`.
4. Salud Supabase:
   - `GET /api/email/health` → `200 { ok: true }`.

### Flujo autenticado (preview/local)
1. Iniciar sesión en `/login`.
2. Copiar `sb-access-token` desde cookies.
3. Enviar `POST /api/ai/chat` con `Authorization: Bearer <token>`.
4. Validar pasos:
   - Saludo → `ESPERANDO_CLIENTE`.
   - Cliente por nombre → resolución o solicitud de aclaración.
   - Servicio: si no hay `opcionesServicios`, búsqueda inicial; si hay opciones, desambiguación.

## Endpoints relevantes
- `POST /api/ai/chat` — streaming IA (texto plano).
- `GET /api/ai/history` — historial por usuario autenticado.
- `GET /api/profile` — datos del perfil autenticado (RLS).
- `GET /api/email/health` — verificación de integraciones con Supabase.

## Commits
- `d0d824e` — Reversión KV, limpieza cron, refactor `chat/route.ts` y `vercel.json`.
- `861f8f3` — Reemplazo `StreamingTextResponse` por `Response`.
- `06e8e4c` — Ajuste auth (user/token) y guardas de estado TypeScript.

## Consideraciones de seguridad
- Todas las lecturas usan RLS (Supabase) y requieren token válido.
- No se almacena información sensible en KV.
- Validar consistentemente `Authorization: Bearer <token>`.

## Scripts útiles
- `npm run smoke:chat` — prueba de streaming/estado del chat.
- `npm run signin -- <email> <password>` — obtener sesión desde Supabase.
- `npm run test:supabase` — validar conectividad y configuración.

## Próximos pasos
- Monitorear el build de la preview en Vercel y ejecutar smoke test autenticado.
- Crear/actualizar PR tras aprobación de QA.