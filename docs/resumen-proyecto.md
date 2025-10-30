# Resumen Técnico del Proyecto — La Colectiva v2

## 1. Descripción General del Proyecto

### Objetivos principales
- Proveer un asistente IA para usuarios de La Colectiva con respuestas en streaming.
- Gestionar el ciclo de vida de usuarios (registro, confirmación de correo, inicio de sesión, perfiles y roles).
- Exponer APIs internas seguras para operaciones protegidas y administración.
- Integrar servicios externos: Supabase (Auth, DB) y Google Generative AI (Gemini).

### Alcance del proyecto
- Aplicación Next.js con App Router, páginas cliente para login/registro y un módulo de chat IA en `/app`.
- API interna para chat IA, historial de conversación, perfil de usuario, administración y mantenimiento.
- Middleware de seguridad: CSRF (para rutas sensibles), autenticación / autorización y control de estado del usuario.
- Webhooks de Supabase para auditar eventos de autenticación y activar cuentas.

### Tecnologías principales utilizadas
- Next.js 16 (App Router, Middleware; dev con Turbopack).
- TypeScript.
- Supabase (`@supabase/supabase-js`): Auth, Postgres y Webhooks.
- Google Generative AI (`@google/generative-ai`): modelos Gemini (p. ej., `gemini-2.5-flash`).
- Node.js y utilidades de scripts para pruebas/diagnóstico.

---

## 2. Desarrollo Realizado

### Funcionalidades implementadas
- Registro de usuarios con Supabase y creación/actualización idempotente de perfil.
- Confirmación de correo y activación de cuenta (vía Supabase + webhook + actualización de estado).
- Inicio de sesión y protección de rutas (cookie/token) para `/app`, `/dashboard` y `/api/protected/*`.
- Chat IA en streaming: `POST /api/ai/chat` recibe un `prompt` y responde `text/plain` por fragmentos.
- Historial de chat: `GET /api/ai/history` recupera el historial desde `profiles.custom_fields.chat_history`.
- Administración básica: listado de eventos de autenticación (`/api/admin/auth-events`) y gestión de usuarios (`/api/admin/users`).
- Salud de email/Auth: `GET /api/email/health` valida conectividad con Supabase Auth Admin.
- Mantenimiento: limpieza de usuarios no confirmados (`/api/maintenance/cleanup-unconfirmed`).

### Componentes desarrollados
- UI: `src/app/app/page.tsx` (chat IA), `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/admin/auth-events/page.tsx`.
- API: ver sección "APIs Utilizadas" para el listado completo.
- Librerías internas: `src/lib/ai/gemini.ts` (cliente Gemini y streaming), `src/lib/supabase/*` (cliente y helpers de servidor/roles).
- Middleware: `middleware.ts` (CSRF, protección de rutas, verificación de estado `activo`).

### Arquitectura técnica
- App Router de Next.js con rutas API bajo `src/app/api/*` y páginas cliente bajo `src/app/*`.
- Seguridad en middleware: 
  - CSRF para `POST/PATCH` en rutas sensibles (`/api/auth/register`, `/api/profile`) usando `x-csrf-token` + cookie `csrf_token` + validación de `origin`.
  - Protección de rutas: usa `sb-access-token` (cookie) o `Authorization: Bearer <token>`; redirige a `/login` si no hay sesión o si el estado del usuario no es `activo`.
- Integración IA: servidor llama a Gemini con clave privada (`GEMINI_API_KEY`) y devuelve respuesta en streaming.
- Observabilidad y pruebas con scripts (`scripts/*.mjs`) para Supabase y Gemini.

### Metodología de trabajo utilizada
- Desarrollo incremental, con pruebas de integración mediante scripts y endpoints de salud.
- Documentación técnica en `docs/` (p. ej., `docs/gemini.md`, `docs/email-confirmation.md`).
- Separación clara de responsabilidades: UI, API, librerías de integración y middleware.

---

## 3. APIs Utilizadas

### Listado y propósito
- `POST /api/ai/chat` — Chat IA en streaming con Gemini (texto plano).
- `GET /api/ai/history` — Recupera historial de chat del usuario autenticado.
- `GET /api/profile` — Obtiene perfil y datos básicos del usuario autenticado.
- `POST /api/auth/register` — Registro de usuario (roles, perfil por defecto, logs).
- `GET /api/auth/confirm` — Confirma cuenta y activa usuario; redirige a `/app`.
- `POST /api/auth/resend-confirmation` — Deprecado; usar `supabase.auth.resend(...)` en el cliente.
- `GET /api/email/health` — Verificación de salud/alcance de Supabase Auth Admin.
- `POST /api/maintenance/cleanup-unconfirmed` — Limpieza de usuarios no confirmados (requiere `ADMIN_CRON_KEY`).
- `GET /api/admin/auth-events` — Lista eventos de autenticación (role requerido).
- `POST/GET /api/admin/users` — Gestión de usuarios (roles, hash de contraseñas, etc.).
- `GET /api/protected/one|two|three` — Ejemplos de rutas protegidas por rol.
- `POST /api/supabase/webhooks/auth` — Webhook de Auth; valida firma y actualiza estado.

### Endpoints principales y ejemplos
- Chat IA (streaming):
  ```bash
  curl -N -X POST http://localhost:3000/api/ai/chat \
    -H 'Content-Type: application/json' \
    -d '{"prompt":"Escribe un saludo breve y amable"}'
  ```
- Perfil (autenticado):
  ```bash
  curl -H 'Authorization: Bearer <token>' http://localhost:3000/api/profile
  ```
- Webhook Auth (Supabase):
  ```bash
  curl -X POST http://localhost:3000/api/supabase/webhooks/auth \
    -H 'x-supabase-signature: <hex>' \
    -H 'Content-Type: application/json' \
    -d '{"type":"user_confirmed","user":{"email":"user@example.com"}}'
  ```

### Métodos de autenticación
- Bearer JWT (`Authorization: Bearer <token>`) y/o cookie `sb-access-token` (Supabase).
- CSRF en rutas sensibles: `x-csrf-token` debe coincidir con cookie `csrf_token` y `Origin` debe igualar `NEXT_PUBLIC_SITE_URL`/`SITE_URL`.
- Autorización por roles y estado del usuario (`activo`) verificada en middleware y utilidades Supabase.

---

## 4. Integraciones

### Sistemas externos conectados
- Supabase (Auth, Postgres, Webhooks).
- Google Generative AI (Gemini) para respuestas IA.

### Protocolos de comunicación
- HTTP/JSON para la mayoría de APIs internas.
- Streaming `text/plain` (ReadableStream) para `POST /api/ai/chat`.
- Firma HMAC-SHA256 en Webhook de Supabase (`x-supabase-signature`, `SUPABASE_WEBHOOK_SECRET`).

### Flujos de datos principales
- Registro y confirmación:
  1. Cliente llama registro → Supabase envía correo.
  2. Usuario confirma → Webhook registra evento → servidor activa usuario y sincroniza estado.
- Chat IA:
  1. UI envía `prompt` → API interna llama a Gemini → stream al cliente.
  2. Historial se lee desde `profiles.custom_fields`. (Escritura del historial puede ampliarse).

### Middleware utilizado
- `middleware.ts` para CSRF, protección de rutas y verificación de estado del usuario (`activo`).

---

## 5. Infraestructura

### Entornos de despliegue
- Desarrollo local: `npm run dev` (`http://localhost:3000`).
- Producción: típicamente plataformas serverless (p. ej., Vercel). Considerar límites de tiempo en funciones.

### Servidores/plataformas utilizadas
- Next.js (APIs y páginas).
- Supabase (Auth/Admin/DB).
- Google Generative AI (Gemini).

### Configuraciones relevantes (variables de entorno)
- `GEMINI_API_KEY` — Clave privada para Gemini (servidor).
- `AI_TIMEOUT_MS` — Tiempo máx. del chat IA (ms). Configurado a 600000 (10 min).
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Cliente Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` — Operaciones admin (servidor).
- `SUPABASE_WEBHOOK_SECRET` — Verificación de firma en webhook.
- `NEXT_PUBLIC_SITE_URL` / `SITE_URL` — Validación de origen en CSRF.
- `ADMIN_CRON_KEY` — Acceso a mantenimiento/cron.

---

## 6. Próximos Pasos

### Mejoras planeadas
- Persistir y paginar el historial de chat (lectura/escritura consistente y límites de tamaño).
- Sincronizar timeouts cliente/servidor con `NEXT_PUBLIC_AI_TIMEOUT_MS` (evitar configuraciones divergentes).
- Observabilidad: trazas (request IDs), métricas y logs estructurados para IA y Auth.
- Endpoints de administración adicionales (gestión avanzada de roles y auditoría).

### Funcionalidades pendientes
- Integración de envío de TicketID vía Gmail API (mencionada en UI, pendiente de implementación core).
- UI para selección dinámica de modelo Gemini y roles del sistema en la conversación.
- Flujos avanzados de consulta/gestión para administradores (C-UX 2/3).

### Roadmap futuro
- Escalado de IA: colas de trabajo para tareas largas (evitar límites de plataforma serverless).
- Caching y prefetch para prompts frecuentes.
- Internacionalización y accesibilidad en UI.
- Hardening de seguridad (Rate limit robusto, protección adicional en rutas críticas).

---

## Anexos — Ejemplos relevantes de implementación

### Llamada a chat IA desde cliente (simplificado)
```ts
// src/app/app/page.tsx (fragmento ilustrativo)
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000) // 10 min
const res = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, model: 'gemini-2.5-flash' }),
  signal: controller.signal,
})
clearTimeout(timeout)
// Leer stream y pintar en UI...
```

### Verificación de CSRF en cliente (rutas sensibles)
```ts
// Para /api/auth/register (ejemplo):
await fetch('/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': getCookie('csrf_token'),
  },
  body: JSON.stringify({ email, password }),
})
```

### Validación de firma en Webhook (servidor)
```ts
// src/app/api/supabase/webhooks/auth/route.ts (extracto)
const raw = await req.text()
const sig = req.headers.get('x-supabase-signature')
const ok = verifySignature(raw, sig, process.env.SUPABASE_WEBHOOK_SECRET)
if (!ok) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
```