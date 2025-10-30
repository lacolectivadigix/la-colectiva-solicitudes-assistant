-- 1. CREAR LA TABLA 'solicitudes'
CREATE TABLE IF NOT EXISTS public.solicitudes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    -- Ticket ID legible (Ej: T-20251030-001)
    ticket_id TEXT NOT NULL UNIQUE,

    -- Dueño de la solicitud
    solicitante_user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Datos clave del C-UX 1
    cliente_id BIGINT NOT NULL REFERENCES public.clientes_digix(id),
    servicio_id BIGINT NOT NULL REFERENCES public.servicios(id),

    -- Todos los datos del brief (JSON)
    respuestas_brief JSONB,

    -- Datos de cierre
    link_diseño TEXT,
    observaciones TEXT,

    -- Estado para C-UX 2 y 3 (Admin y Consultor)
    estado TEXT DEFAULT 'Ingresada' NOT NULL
);

-- 2. HABILITAR RLS (Row Level Security)
ALTER TABLE public.solicitudes ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICA DE INSERCIÓN (Para Solicitantes)
-- El usuario solo puede insertar solicitudes para sí mismo.
CREATE POLICY "Los solicitantes pueden crear sus propias solicitudes"
ON public.solicitudes
FOR INSERT
WITH CHECK ( auth.uid() = solicitante_user_id );

-- 4. POLÍTICA DE LECTURA (Para Solicitantes)
-- El usuario solo puede ver sus propias solicitudes.
CREATE POLICY "Los solicitantes pueden ver sus propias solicitudes"
ON public.solicitudes
FOR SELECT
USING ( auth.uid() = solicitante_user_id );