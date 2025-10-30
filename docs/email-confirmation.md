# Confirmación de correo (Supabase Auth)

Este documento describe el flujo de confirmación de cuenta usando exclusivamente Supabase Auth. No se utiliza SMTP propio ni proveedores externos.

## Configuración requerida

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (cliente)
- `SUPABASE_SERVICE_ROLE_KEY` (server, para tareas administrativas)
- `NEXT_PUBLIC_SITE_URL` o `SITE_URL` (URL pública usada en redirecciones)
- Opcional: `SUPABASE_WEBHOOK_SECRET` para validar firmas en webhooks

Revisa que Supabase Auth tenga activado el envío de correo para "Confirm signup" y personaliza las plantillas en el panel de Supabase.

## Salud del sistema

- Endpoint: `GET /api/email/health` → valida conectividad con Supabase (Auth Admin `listUsers`).
- Resultado esperado: `{ ok: true, provider: 'supabase_auth' }` si el service role está correctamente configurado.

## Flujo de confirmación

1. Registro en `/register` usando `supabase.auth.signUp({ email, password, options: { data, emailRedirectTo } })`.
2. Supabase envía automáticamente el correo de confirmación al usuario.
3. El usuario confirma su cuenta con el enlace recibido. Auth actualiza su estado a `confirmed`.
4. La app permite login en `/login` con `supabase.auth.signInWithPassword` y redirige a `/app`.
5. Reenvío de confirmación se hace desde el cliente con `supabase.auth.resend({ type: 'signup', email })`.

## Webhooks y almacenamiento de eventos

- Endpoint sugerido: `POST /api/supabase/webhooks/auth` para recibir eventos de Auth (p.ej. `user_signed_up`, `user_confirmed`).
- Tabla: `public.auth_events` para registrar eventos recibidos (ver `scripts/sql/create_auth_events_table.sql`).
- Comportamiento: al recibir `user_confirmed`, actualizar el estado del usuario en `public.users` (p.ej. `status = 'activo'`).

## Eliminaciones realizadas

- Eliminado `src/lib/email.ts` (Nodemailer/SMTP).
- Eliminado `scripts/email-health.mjs` (verificación SMTP).
- El endpoint `POST /api/auth/resend-confirmation` queda deprecado; usar `supabase.auth.resend` en cliente.

## Pruebas recomendadas

- Registro con correo `@digix.co` y ver mensaje "Registro exitoso".
- Confirmar el correo desde el enlace enviado por Supabase.
- Iniciar sesión en `/login` y verificar acceso a `/app`.
- Consultar `GET /api/email/health` para confirmar conectividad con Supabase.
- Ver registros en `public.auth_events` si configuraste el webhook.