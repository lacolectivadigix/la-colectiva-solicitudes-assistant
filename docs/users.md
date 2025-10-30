# Gestión de Usuarios

Este documento describe el esquema SQL, endpoints de administración y uso para gestionar usuarios, sus roles y auditoría.

## Aplicar el esquema SQL

1. Archivo: `scripts/sql/create_users_table.sql`
2. Métodos:
   - Supabase Studio: SQL → Pegar script → Ejecutar
   - CLI/psql: `psql $SUPABASE_DB_URL -f scripts/sql/create_users_table.sql`
3. Entornos: aplicar primero en staging.

## Endpoints de administración

Requieren rol `administrador` (verificado vía `user_metadata.role` o `app_metadata.role`).

### Crear usuario

- Ruta: `POST /api/admin/users`
- Body JSON:
  ```json
  {
    "full_name": "Nombre Apellido",
    "email": "correo@dominio.com",
    "password": "contraseña-segura",
    "role": "solicitante | administrador",
    "status": "activo | inactivo"
  }
  ```
- Respuesta 201:
  ```json
  { "id": 1, "auth_user_id": "uuid", "email": "correo@dominio.com", "role": "solicitante", "status": "activo" }
  ```

### Actualizar usuario

- Ruta: `PATCH /api/admin/users`
- Body JSON (al menos `id` o `auth_user_id`):
  ```json
  {
    "id": 1,
    "auth_user_id": "uuid",
    "full_name": "Nuevo Nombre",
    "email": "nuevo@dominio.com",
    "password": "nueva-contraseña",
    "role": "administrador",
    "status": "inactivo"
  }
  ```
- Respuesta 200:
  ```json
  { "id": 1, "auth_user_id": "uuid" }
  ```

### Listar usuarios

- Ruta: `GET /api/admin/users`
- Query params:
  - `email`: filtro por correo (ilike)
  - `full_name`: filtro por nombre completo (ilike)
  - `role`: `solicitante | administrador`
  - `status`: `activo | inactivo`
  - `page`: número de página (default 1)
  - `pageSize`: tamaño de página (default 20, máx 100)
  - `sortBy`: columna (default `created_at`)
  - `sortDir`: `asc | desc` (default `desc`)
- Respuesta 200:
  ```json
  {
    "items": [
      {
        "id": 1,
        "full_name": "Nombre Apellido",
        "email": "correo@dominio.com",
        "role": "solicitante",
        "status": "activo",
        "created_at": "2024-10-10T12:00:00Z",
        "last_login": "2024-10-11T08:00:00Z",
        "auth_user_id": "uuid"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "pages": 1,
    "filters": { "email": "", "full_name": "", "role": "", "status": "" }
  }
  ```

### Eliminar usuario (baja lógica)

- Ruta: `DELETE /api/admin/users`
- Body JSON (al menos `id` o `auth_user_id`):
  ```json
  { "id": 1 }
  ```
- Comportamiento:
  - Marca `status = "inactivo"` en `public.users`.
  - Sincroniza en Supabase Auth: `app_metadata.status = "inactivo"`.
- Respuesta 200:
  ```json
  { "id": 1, "status": "inactivo", "auth_user_id": "uuid", "auth_status_updated": true }
  ```

## Hashing de contraseñas

- Librería: `bcryptjs` con costo 12
- Al crear/actualizar con `password`, se guarda `password_hash` (bcrypt) en `public.users`
- Si se usa exclusivamente Supabase Auth, `password_hash` puede quedar `NULL`

## Auditoría

- Tabla: `public.users_audit`
- Trigger: `trg_audit_users` para `INSERT | UPDATE | DELETE`
- Campos: `changed_at`, `changed_by`, `action`, `row_old`, `row_new`, `reason`

## Seguridad

- Variables: `SUPABASE_SERVICE_ROLE_KEY`
- Validación de inputs y formatos
- Acceso restringido por rol `administrador`

---

## Registro de usuarios (público)

- Ruta: `POST /api/auth/register`
- Body JSON:
  ```json
  {
    "full_name": "Nombre Apellido",
    "email": "correo@dominio.com",
    "password": "contraseña-segura",
    "role": "solicitante",
    "status": "activo"
  }
  ```
- Comportamiento:
  - Crea el usuario en Supabase Auth (`user_metadata.role`, `app_metadata.status`).
  - Inserta fila en `public.users` con hash bcrypt.
  - Crea perfil inicial en `public.profiles` (con `custom_fields = {}`).
- Respuesta 201:
  ```json
  { "id": 1, "auth_user_id": "uuid", "email": "correo@dominio.com", "role": "solicitante", "status": "activo" }
  ```

## Perfiles de usuario

### Esquema y políticas

- Archivo SQL: `scripts/sql/create_profiles_table.sql`
- Tabla `public.profiles`
  - Campos: `user_id`, `phone`, `address`, `birthdate`, `custom_fields`, `created_at`, `updated_at`
  - RLS habilitado: políticas `profiles_select_own` y `profiles_update_own` permiten leer/editar solo el propio perfil.
  - Trigger `trg_profiles_updated_at` mantiene `updated_at`.

### Obtener perfil propio

- Ruta: `GET /api/profile`
- Requiere autenticación (token `Authorization: Bearer <JWT>`)
- Respuesta 200:
  ```json
  {
    "user": { "id": 1, "full_name": "Nombre Apellido", "email": "correo@dominio.com", "status": "activo" },
    "profile": { "id": 10, "phone": "+51...", "address": "...", "birthdate": "1990-01-01", "custom_fields": {}, "created_at": "...", "updated_at": "..." }
  }
  ```

### Actualizar perfil propio

- Ruta: `PATCH /api/profile`
- Body JSON (cualquiera de los campos):
  ```json
  {
    "phone": "+51...",
    "address": "Calle 123",
    "birthdate": "1990-01-01",
    "custom_fields": { "preferencias": ["boletín", "promociones"] }
  }
  ```
- Respuesta 200:
  ```json
  { "id": 10 }
  ```

## Control de acceso basado en roles (RBAC)

- Roles: `solicitante`, `administrador` (tabla `public.roles`)
- Middleware: bloquea tokens con `app_metadata.status = "inactivo"` en rutas protegidas.
- Endpoints protegidos usan `userHasRole(user, [...])` y verifican rol requerído.

## Políticas de seguridad y RLS

- `public.users`: acceso vía endpoints de administración con Service Role.
- `public.profiles`: RLS activo; usuarios autenticados pueden `SELECT/UPDATE` solo su propio perfil.
- Validaciones de servidor en todos los endpoints (email, contraseña, formatos).

## Verificación de usuarios existentes

- Listado: usar `GET /api/admin/users` con filtros para revisar estado, rol y datos.
- Estructura: confirmar que cada usuario tiene su fila en `public.users` y perfil en `public.profiles`.
- Estado: tokens con `app_metadata.status = "inactivo"` son bloqueados por middleware.