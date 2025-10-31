# La Colectiva v2

Aplicación Next.js con Supabase y Gemini, lista para despliegue en Vercel.

## Requisitos

- Node.js 20+ y npm
- Cuenta y proyecto en Supabase
- Cuenta y API Key de Google Generative AI (Gemini)

## Variables de entorno

Crea un `.env.local` a partir de `.env.example`:

- `NEXT_PUBLIC_SITE_URL`: URL del sitio (ej. `http://localhost:3001` para dev)
- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Anon key del proyecto Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (solo servidor)
- `GEMINI_API_KEY`: API key de Gemini
- `AI_TIMEOUT_MS`: (opcional) timeout de IA

En Vercel, configura estas variables en Project Settings → Environment Variables. El archivo `vercel.json` referencia estas variables mediante secretos (`@...`).

## Scripts

- `npm run dev`: inicia en `http://localhost:3001`
- `npm run build`: construye la app
- `npm run start`: arranca producción en `http://localhost:3000`
- `npm run test`: ejecuta pruebas (Vitest)
- `npm run test:auth`: prueba de autenticación (requiere variables Supabase configuradas)
- `npm run smoke:chat`: prueba rápida del streaming de chat
- `npm run signin -- <email> <password>`: inicia sesión vía script y muestra token
- `npm run test:supabase`: verifica conectividad y configuración con Supabase

## Vercel

- Framework: Next.js (auto-detectado)
- Build Command: `npm run build`
- Rewrites: API bajo `/api/*` (nativos de Next)
- `middleware.ts`: aplica protección CSRF y de rutas según tokens y variables de entorno

### Despliegue

1. Configura variables de entorno en Vercel (Production/Preview)
2. Asegúrate de que Vercel sigue la rama correcta (`main` o `master`)
3. Push al repositorio remoto; Vercel detonará el deploy automáticamente

## Pruebas y Build local

1. `npm ci` o `npm install`
2. `npm run test` (Vitest) – debe pasar
3. `npm run build` – debe completar sin errores
4. `npm run dev` – navega a `http://localhost:3001`

## Documentación del proceso reciente

- Consulta `docs/proceso-c-ux-1-mvp.md` para detalles sobre:
  - Reversión de KV y cron, y lectura directa en Supabase.
  - Corrección de streaming en Next.js 16 (`Response` + `ReadableStream`).
  - Ajustes de autenticación (`Authorization: Bearer <token>`) y guardas de estado.

## Autenticación y Autorización

- `middleware.ts` exige `sb-access-token` o `Authorization: Bearer <token>` en rutas protegidas
- `src/components/RequireAuth.tsx` soporta `allowedRoles` y redirige si el usuario no posee el rol requerido
- Utilidades en `src/lib/supabase/*` para cliente, servidor y roles

## Notas

- No expongas `SUPABASE_SERVICE_ROLE_KEY` en el cliente; solo servidor o funciones protegidas
- Ajusta `NEXT_PUBLIC_SITE_URL` para que coincida con el origen permitido en CSRF
