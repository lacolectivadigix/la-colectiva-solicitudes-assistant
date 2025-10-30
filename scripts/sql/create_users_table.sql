BEGIN;

-- Extensión para correo case-insensitive
CREATE EXTENSION IF NOT EXISTS citext;

-- Tabla de roles (escalable)
CREATE TABLE IF NOT EXISTS public.roles (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL CHECK (code ~ '^[a-z_]+$'),
  name TEXT NOT NULL
);

-- Seed de roles principales
INSERT INTO public.roles (code, name)
VALUES ('solicitante', 'Solicitante'), ('administrador', 'Administrador')
ON CONFLICT (code) DO NOTHING;

-- Enum de estado
DO $$ BEGIN
  CREATE TYPE public.user_status AS ENUM ('activo', 'inactivo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id UUID UNIQUE,
  full_name TEXT NOT NULL CHECK (char_length(full_name) >= 3),
  email CITEXT NOT NULL UNIQUE CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  role_id BIGINT NOT NULL REFERENCES public.roles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ,
  status public.user_status NOT NULL DEFAULT 'activo',
  CONSTRAINT fk_auth_user FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role_id);
CREATE INDEX IF NOT EXISTS users_status_idx ON public.users (status);

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS public.users_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  changed_by UUID DEFAULT auth.uid(),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_row JSONB,
  new_row JSONB
);

-- Función de auditoría
CREATE OR REPLACE FUNCTION public.audit_users_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.users_audit(user_id, operation, old_row, new_row)
    VALUES (NEW.id, 'INSERT', NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.users_audit(user_id, operation, old_row, new_row)
    VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.users_audit(user_id, operation, old_row, new_row)
    VALUES (OLD.id, 'DELETE', to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger de auditoría
DROP TRIGGER IF EXISTS trg_audit_users ON public.users;
CREATE TRIGGER trg_audit_users
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.audit_users_changes();

COMMIT;