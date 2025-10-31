import { NextResponse } from 'next/server'
import { getUserFromAuthHeader, getSupabaseServerWithToken } from '@/lib/supabase/server'
import { enviarNotificacionEmail } from '@/lib/email/notifications'

// Simple in-memory session store keyed by userId/sessionId
type Estado =
  | 'INICIAL'
  | 'ESPERANDO_CLIENTE'
  | 'ESPERANDO_SERVICIO'
  | 'ESPERANDO_RESPUESTAS_BRIEF'
  | 'ESPERANDO_LINK_DISEÑO'
  | 'ESPERANDO_OBSERVACIONES'
  | 'FINALIZANDO'

type ServicioSeleccion = {
  categoria?: string
  subcategoria_1?: string
  subcategoria_2?: string
  servicio_id?: number
}

export type SessionState = {
  step: Estado
  // Paso 1: cliente
  clienteId?: number
  clienteNombre?: string
  subdivision?: string | null
  // Paso 2: servicio
  servicio?: ServicioSeleccion
  opcionesServicios?: Array<{ categoria?: string; subcategoria_1?: string; subcategoria_2?: string }>
  // Paso 3: brief dinámico
  preguntas?: Array<{ id: number; pregunta_texto: string; categoria?: string | null; subcategoria_1?: string | null; subcategoria_2?: string | null }>
  preguntaIndex?: number
  respuestasBrief?: Array<{ pregunta: string; respuesta: string }>
  // Paso 4: diseño
  tieneDiseno?: boolean
  disenoLink?: string | null
  // Paso 5: observaciones
  observaciones?: string | null
}

const sessionStates = new Map<string, SessionState>()

function normalizeText(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9áéíóúüñ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getUserSessionKey(headers: Headers, userId?: string | null) {
  // Prefer authenticated user id; fallback to x-session-id or ip
  const sid = userId || headers.get('x-session-id') || headers.get('x-forwarded-for') || 'anon'
  return String(sid)
}

async function getOrInitSession(req: Request, userId?: string | null) {
  const key = getUserSessionKey(req.headers, userId ?? null)
  if (!sessionStates.has(key)) {
    sessionStates.set(key, {
      step: 'INICIAL',
      respuestasBrief: [],
    })
  }
  return { key, state: sessionStates.get(key)! }
}

function setState(key: string, next: Partial<SessionState>) {
  const current = sessionStates.get(key) || { step: 'INICIAL' as Estado }
  sessionStates.set(key, { ...current, ...next })
}

function resetSession(key: string) {
  sessionStates.set(key, { step: 'INICIAL', respuestasBrief: [] })
}

async function readUserText(req: Request): Promise<string> {
  try {
    const body = await req.json().catch(() => ({} as any))
    const text =
      (typeof body?.prompt === 'string' && body.prompt) ||
      (typeof body?.input === 'string' && body.input) ||
      (typeof body?.message === 'string' && body.message) ||
      (typeof body?.text === 'string' && body.text) ||
      ''
    return String(text).trim()
  } catch {
    return ''
  }
}

export async function POST(req: Request) {
  // Autenticación: obtener token y usuario
  const { user, token } = await getUserFromAuthHeader(req)
  if (!user || !token) {
    return new NextResponse('Acceso no autorizado', { status: 401 })
  }

  // Cliente Supabase autenticado (lectura y escritura en Pasos 1, 2, 3 y 6)
  const supabase = getSupabaseServerWithToken(token)

  // Inicializar sesión usando el user.id
  const { key, state } = await getOrInitSession(req, user.id)
  const userText = await readUserText(req)

  // PASO 0: SALUDO
  if (state.step === 'INICIAL') {
    setState(key, { step: 'ESPERANDO_CLIENTE' })
    const saludo =
      '¡Qué hubo pues, Mar! Soy tu asistente de La Colectiva. ¿lista pa\' que empecemos esta solicitud, mija? Contame, ¿para qué cliente es esta solicitud?'
    return new NextResponse(saludo, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  // PASO 1: CLIENTE
  if (state.step === 'ESPERANDO_CLIENTE') {
    const entrada = normalizeText(userText)
    if (!entrada || entrada.length < 2) {
      return new NextResponse(
        'Necesito el nombre del cliente, mija. Intentá con algo como "GSK" o "FESTO".',
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      )
    }
    try {
      const { data: clientes, error } = await supabase
        .from('clientes_digix')
        .select('id, cliente, division_pais')
        .ilike('cliente', `%${userText}%`)
        .limit(25)
      if (error) throw error
      const rows: any[] = Array.isArray(clientes) ? clientes : []
      if (rows.length === 0) {
        // Intentar sugerencias por aproximación simple (sobre resultados de consulta)
        const sugerencias = rows
          .map((r: any) => String(r.cliente || ''))
          .filter((c) => normalizeText(c).includes(entrada.slice(0, Math.max(1, Math.min(entrada.length, 3)))))
          .slice(0, 5)
        const msg =
          sugerencias.length > 0
            ? `No encontré coincidencias exactas. ¿Quisiste decir: ${sugerencias.join(', ')}?`
            : 'No logré encontrar ese cliente en la base de datos. ¿Podés verificar el nombre e intentarlo de nuevo?'
        return new NextResponse(msg, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }

      // Consolidar por nombre de cliente
      const porCliente = new Map<string, Array<{ id: number; cliente: string; division_pais: string | null }>>()
      for (const r of rows as any[]) {
        const nombre = String(r.cliente || '').trim()
        const list = porCliente.get(nombre) || []
        list.push({ id: r.id, cliente: nombre, division_pais: r.division_pais })
        porCliente.set(nombre, list)
      }

      if (porCliente.size > 1) {
        const opciones = Array.from(porCliente.keys())
        const texto =
          'Encontré varios clientes posibles para tu entrada:\n' +
          opciones.map((c, i) => `${i + 1}. ${c}`).join('\n') +
          '\nIndicame el número o el nombre exacto.'
        // Guardar contexto para desambiguación ligera (nombre seleccionado)
        setState(key, { clienteNombre: undefined })
        return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }

      // Único cliente; revisar subdivisiones
      const [nombreCliente, filasCliente] = Array.from(porCliente.entries())[0]
      const subdivs = Array.from(
        new Set((filasCliente || []).map((r) => r.division_pais).filter((x) => x != null))
      ) as string[]
      if (subdivs.length === 0) {
        // Tomar fila con division_pais NULL si existe
        const filaBase = filasCliente.find((r) => r.division_pais == null) || filasCliente[0]
        setState(key, {
          clienteId: filaBase.id,
          clienteNombre: nombreCliente,
          subdivision: filaBase.division_pais ?? null,
          step: 'ESPERANDO_SERVICIO',
        })
        const texto = `Perfecto, cliente ${nombreCliente} seleccionado. Sigamos con el servicio: contame qué necesitas hacer o describilo en tus palabras.`
        return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }

      setState(key, {
        clienteNombre: nombreCliente,
      })
      const texto =
        `Perfecto, cliente ${nombreCliente} encontrado. Veo subdivisiones disponibles: ` +
        subdivs.join(', ') +
        `. Elegí una de ellas o decime "General/Ninguna".`
      // Próximo mensaje del usuario debe indicar subdivisión; seguimos aún en ESPERANDO_CLIENTE
      // Interpretamos siguiente entrada como subdivisión cuando esté en este estado y clienteNombre ya está definido.
      return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    } catch (err: any) {
      const msg = `Oops, se presentó un problema consultando clientes en Supabase. ${err?.message || 'Intentalo de nuevo en un ratico.'}`
      return NextResponse.json({ error: 'SUPABASE_CLIENTES', message: msg }, { status: 400 })
    }
  }

  // Si aún estamos en ESPERANDO_CLIENTE pero ya tenemos clienteNombre y falta subdivisión
  if (state.step === 'ESPERANDO_CLIENTE' && state.clienteNombre && !state.clienteId) {
    const subdiv = userText.trim()
    try {
      const { data: clientesFiltrados, error: errCliente } = await supabase
        .from('clientes_digix')
        .select('id, cliente, division_pais')
        .eq('cliente', state.clienteNombre)
      if (errCliente) throw errCliente
      const lista: any[] = Array.isArray(clientesFiltrados) ? clientesFiltrados : []
      let elegido: any | null = null
      if (/general|ninguna/i.test(subdiv)) {
        elegido = lista.find((r) => r.division_pais == null) || null
      } else {
        elegido = lista.find((r) => normalizeText(String(r.division_pais || '')) === normalizeText(subdiv)) || null
      }
      if (!elegido) {
        const opciones = Array.from(new Set(lista.map((r) => r.division_pais).filter(Boolean))) as string[]
        const texto =
          opciones.length > 0
            ? `No reconocí esa subdivisión. Elegí una de estas: ${opciones.join(', ')}, o decime "General/Ninguna".`
            : 'Este cliente no tiene subdivisiones configuradas. Podés decir "General/Ninguna" para continuar.'
        return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }
      setState(key, {
        clienteId: elegido.id,
        subdivision: elegido.division_pais ?? null,
        step: 'ESPERANDO_SERVICIO',
      })
      const texto = `Listo, quedó ${state.clienteNombre}${elegido.division_pais ? ' / ' + elegido.division_pais : ''}. Ahora, contame qué servicio necesitas.`
      return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    } catch (err: any) {
      const msg = `Problema consultando subdivisión de cliente en Supabase. ${err?.message || ''}`
      return NextResponse.json({ error: 'SUPABASE_CLIENTS_SUBDIV', message: msg }, { status: 400 })
    }
  }

  // PASO 2: SERVICIO
  if (state.step === 'ESPERANDO_SERVICIO') {
    const entrada = normalizeText(userText)
    const tokens = entrada.split(' ').filter(Boolean)
    try {
      const { data: servRows, error: servErr } = await supabase
        .from('servicios')
        .select('id, categoria, subcategoria_1, subcategoria_2')
      if (servErr) throw servErr
      const rows: any[] = Array.isArray(servRows) ? servRows : []
      const candidatos = rows
        .map((r: any) => {
          const servNorm = normalizeText(String(r.subcategoria_2 || ''))
          const comboNorm = normalizeText(
            `${r.categoria || ''} ${r.subcategoria_1 || ''} ${r.subcategoria_2 || ''}`
          )
          const hasIntersection = tokens.some((t) => servNorm.includes(t)) || tokens.some((t) => comboNorm.includes(t))
          const contains = entrada.length >= 4 && (servNorm.includes(entrada) || comboNorm.includes(entrada))
          const tokensSubset = tokens.length > 0 && tokens.every((t) => servNorm.includes(t) || comboNorm.includes(t))
          const score = tokensSubset ? 3 : hasIntersection ? 2 : contains ? 1 : 0
          return { raw: r, score, len: servNorm.length + comboNorm.length }
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => (b.score - a.score) || (b.len - a.len))

      if (candidatos.length === 0) {
        const opcionesCats = Array.from(new Set((rows || []).map((r: any) => r.categoria).filter(Boolean)))
        const texto =
          `No encontré un servicio que coincida con "${userText}". Intentá con otra descripción o elegí una categoría: ` +
          opcionesCats.join(', ') +
          '.'
        return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }

      if (candidatos.length === 1) {
        const elegido = candidatos[0].raw as any
        setState(key, {
          servicio: {
            categoria: elegido.categoria,
            subcategoria_1: elegido.subcategoria_1,
            subcategoria_2: elegido.subcategoria_2,
            servicio_id: elegido.id,
          },
          step: 'ESPERANDO_RESPUESTAS_BRIEF',
          preguntas: undefined,
          preguntaIndex: 0,
        })
        const texto = `Servicio seleccionado: ${String(elegido.categoria || '')} / ${String(elegido.subcategoria_1 || '')} / ${String(elegido.subcategoria_2 || '')}. Vamos con el brief. Empecemos por las preguntas generales.`
        return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }

      const opciones = candidatos.slice(0, Math.min(candidatos.length, 6)).map((c) => c.raw)
      setState(key, { opcionesServicios: opciones })
      const lista = opciones
        .map(
          (r: any, i: number) =>
            `${i + 1}. ${(String(r.categoria || '')).trim().toUpperCase()} / ${(String(r.subcategoria_1 || '')).trim().toUpperCase()} / ${(String(r.subcategoria_2 || '')).trim().toUpperCase()}`
        )
        .join('\n')
      const texto =
        `Entendido. Encontré varios servicios posibles para "${userText}":\n` +
        lista +
        '\n¿Con cuál seguimos? Podés responder con el número o el nombre completo.'
      return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    } catch (err: any) {
      const msg = `Error consultando servicios en Supabase. ${err?.message || ''}`
      return NextResponse.json({ error: 'SUPABASE_SERVICIOS', message: msg }, { status: 400 })
    }
  }

  // Desambiguación de servicio: recibir número o nombre
  if (state.opcionesServicios && state.opcionesServicios.length > 0 && state.step === 'ESPERANDO_SERVICIO') {
    const entrada = normalizeText(userText)
    const asNum = parseInt(entrada, 10)
    let elegido: any | null = null
    if (!Number.isNaN(asNum) && asNum >= 1 && asNum <= state.opcionesServicios.length) {
      elegido = state.opcionesServicios[asNum - 1]
    } else {
      elegido = state.opcionesServicios.find((r) => normalizeText(`${r.categoria || ''} ${r.subcategoria_1 || ''} ${r.subcategoria_2 || ''}`) === entrada) || null
    }
    if (!elegido) {
      return new NextResponse('No reconocí la opción. Contestá con el número o el nombre completo del servicio.', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
    // Buscar id exacto en Supabase
    try {
      const { data: servRows2, error: servErr2 } = await supabase
        .from('servicios')
        .select('id, categoria, subcategoria_1, subcategoria_2')
        .eq('categoria', elegido.categoria || null)
        .eq('subcategoria_1', elegido.subcategoria_1 || null)
        .eq('subcategoria_2', elegido.subcategoria_2 || null)
        .limit(1)
      if (servErr2) throw servErr2
      const fila = Array.isArray(servRows2) ? servRows2[0] : null
      const servicio_id = (fila && (fila as any).id) || null
      setState(key, {
        servicio: {
          categoria: elegido.categoria,
          subcategoria_1: elegido.subcategoria_1,
          subcategoria_2: elegido.subcategoria_2,
          servicio_id: servicio_id || undefined,
        },
        step: 'ESPERANDO_RESPUESTAS_BRIEF',
        preguntas: undefined,
        preguntaIndex: 0,
      })
      const texto = `Servicio seleccionado: ${String(elegido.categoria || '')} / ${String(elegido.subcategoria_1 || '')} / ${String(elegido.subcategoria_2 || '')}. Vamos con el brief. Empecemos por las preguntas generales.`
      return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    } catch (err: any) {
      const msg = `Error resolviendo id del servicio en Supabase. ${err?.message || ''}`
      return NextResponse.json({ error: 'SUPABASE_SERV_ID', message: msg }, { status: 400 })
    }
  }

  // PASO 3: BRIEF DINÁMICO
  if (state.step === 'ESPERANDO_RESPUESTAS_BRIEF') {
    // Cargar preguntas si no están
    if (!state.preguntas || !Array.isArray(state.preguntas)) {
      try {
        // 1. Preguntas Generales
        const generales = await supabase
          .from('brief_preguntas')
          .select('id, pregunta_texto, categoria, subcategoria_1, subcategoria_2')
          .is('categoria', null)
          .order('orden', { ascending: true })
        if (generales.error) throw generales.error

        // 2. Preguntas Específicas
        const espec = state.servicio?.categoria
          ? await supabase
              .from('brief_preguntas')
              .select('id, pregunta_texto, categoria, subcategoria_1, subcategoria_2')
              .eq('categoria', state.servicio?.categoria)
              .eq('subcategoria_1', state.servicio?.subcategoria_1 || null)
              .eq('subcategoria_2', state.servicio?.subcategoria_2 || null)
              .order('orden', { ascending: true })
          : { data: [], error: null }
        if ((espec as any).error) throw (espec as any).error

        const preguntas = ([] as any[])
          .concat(Array.isArray(generales.data) ? generales.data : [])
          .concat(Array.isArray((espec as any).data) ? (espec as any).data : [])
        setState(key, { preguntas, preguntaIndex: 0 })
      } catch (err: any) {
        const msg = `Error consultando preguntas del brief en Supabase. ${err?.message || ''}`
        return NextResponse.json({ error: 'SUPABASE_BRIEF_QS', message: msg }, { status: 400 })
      }
    }

    // Si ya tenemos preguntas y el usuario respondió la anterior, guardarla
    if (state.preguntas && typeof state.preguntaIndex === 'number' && state.preguntaIndex > 0) {
      const prevIdx = state.preguntaIndex - 1
      const prevQ = state.preguntas[prevIdx]
      if (prevQ) {
        const resp = userText.trim()
        // Lógica de Asesor Experto
        const respuestasActuales = Array.isArray(state.respuestasBrief) ? state.respuestasBrief.slice() : []
        if (/^no se$|^no sé$|recomiendame|recomiéndame/i.test(resp)) {
          const consejo =
            'Te recomiendo Papel Couché 150gr, impresión digital en alta calidad, y barniz UV brillante si buscás acabado premium. Si querés ahorro, podés irte por Couché 130gr y sin barniz.'
          respuestasActuales.push({
            pregunta: prevQ.pregunta_texto,
            respuesta: `RECOMENDACION: ${consejo}`,
          })
        } else if (/explicame|explícame/i.test(resp)) {
          const explic =
            'El Barniz UV es un recubrimiento aplicado tras la impresión para dar brillo y protección. Es más duradero y llamativo que un plastificado común.'
          respuestasActuales.push({
            pregunta: prevQ.pregunta_texto,
            respuesta: `EXPLICACION: ${explic}`,
          })
        } else {
          respuestasActuales.push({
            pregunta: prevQ.pregunta_texto,
            respuesta: resp,
          })
        }
        setState(key, { respuestasBrief: respuestasActuales })
      }
    }

    // Formular siguiente pregunta
    const idx = state.preguntaIndex || 0
    const nextQ = state.preguntas?.[idx]
    if (nextQ) {
      setState(key, { preguntaIndex: idx + 1 })
      return new NextResponse(nextQ.pregunta_texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    // Terminó el brief: pasar al paso 4 (diseño)
    setState(key, { step: 'ESPERANDO_LINK_DISEÑO' })
    const texto = '¿Cuentas con el diseño listo? Si es así, compartime el link del archivo. Si no, decime "NO".'
    return new NextResponse(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  // PASO 4: DISEÑO
  if (state.step === 'ESPERANDO_LINK_DISEÑO') {
    const r = userText.trim()
    if (/^no$/i.test(r)) {
      setState(key, { tieneDiseno: false, disenoLink: null, step: 'ESPERANDO_OBSERVACIONES' })
      return new NextResponse(
        'Entendido: solicitante no envía link de archivo. ¿Querés agregar algo adicional (un comentario, recomendación, etc.)?',
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      )
    }
    // Si parece un URL
    if (/^https?:\/\//i.test(r)) {
      setState(key, { tieneDiseno: true, disenoLink: r, step: 'ESPERANDO_OBSERVACIONES' })
      return new NextResponse('¡Perfecto! ¿Querés agregar algo adicional (un comentario, recomendación, etc.)?', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
    return new NextResponse('Si tenés el diseño listo, compartime el link (http/https). Si no, decime "NO".', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  // PASO 5: OBSERVACIONES
  if (state.step === 'ESPERANDO_OBSERVACIONES') {
    const r = userText.trim()
    if (/^si$|^sí$/i.test(r)) {
      // próxima entrada será el comentario; mantenernos en este estado
      return new NextResponse('Dale, contame el comentario adicional que querés agregar.', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
    // Guardar el comentario si no es una confirmación
    if (r && !/^no$/i.test(r)) {
      setState(key, { observaciones: r })
    }
    setState(key, { step: 'FINALIZANDO' })
    // Proceder a cierre (Paso 6)
  }

  // PASO 6: CIERRE DE TICKET (Guardado, Notificación y Streaming final)
  if (state.step === 'FINALIZANDO') {
    let ticketId = 'T-ERROR'
    let resumen = ''

    try {
      // 1. Generar Ticket ID (Ej: T-20251030-001)
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
      // (Simulación de contador diario)
      const randomSuffix = Math.floor(Math.random() * 900 + 100).toString().padStart(3, '0')
      ticketId = `T-${dateStr}-${randomSuffix}`

      // 2. Preparar el objeto para Supabase
      const solicitudData = {
        ticket_id: ticketId,
        solicitante_user_id: user.id, // ID del usuario autenticado
        cliente_id: state.clienteId,
        servicio_id: state.servicio?.servicio_id,
        respuestas_brief: state.respuestasBrief, // Guarda el JSONB
        link_diseño: state.disenoLink,
        observaciones: state.observaciones,
        estado: 'Ingresada',
      }

      // 3. Guardar en Supabase (Usando el cliente autenticado)
      const { error: insertError } = await supabase
        .from('solicitudes')
        .insert(solicitudData)
        .single()

      if (insertError) {
        // Si RLS falla o hay un error de BBDD
        throw new Error(`Error de BBDD o RLS al guardar: ${insertError.message}`)
      }

      // 4. Generar Resumen (ahora con el TicketID)
      resumen = buildResumen(state, ticketId)

      // 5. Enviar Notificación (Placeholder)
      // (No usamos 'await' para que la respuesta al usuario sea inmediata)
      enviarNotificacionEmail(ticketId, state, resumen)
    } catch (err: any) {
      // Fallo en el guardado
      console.error('Error en PASO 6 (FINALIZANDO):', err)
      resumen = `¡Error al guardar tu ticket, Mar! ${err.message}. Por favor, contacta a soporte.`
    } finally {
      // 6. Resetear estado
      resetSession(key)

      // 7. Enviar respuesta final al usuario
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(resumen)
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  }

  // Fallback si estado desconocido
  resetSession(key)
  return new NextResponse('Reiniciemos, mija. ¿Para qué cliente es esta solicitud?', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function buildResumen(state: SessionState, ticketId: string): string {
  const cliente = `${state.clienteNombre || '—'}${state.subdivision ? ' / ' + state.subdivision : ''}`
  const servicio = state.servicio
    ? `${String(state.servicio.categoria || '')} / ${String(state.servicio.subcategoria_1 || '')} / ${String(state.servicio.subcategoria_2 || '')}`
    : '—'
  const briefArr = state.respuestasBrief || []
  const briefTexto = briefArr
    .map((item) => `- ${item.pregunta}: ${item.respuesta}`)
    .join('\n')
  const diseno = state.tieneDiseno ? `Sí. Link: ${state.disenoLink || 'N/A'}` : 'No envía link de archivo'
  const obs = state.observaciones || 'N/A'
  const despedida = '¡Muchas gracias por usarme, Mar! Tu solicitud quedó resumida arriba. Cualquier cosa, aquí estoy pa\' ayudarte.'
  return (
    `Resumen de Ticket: ${ticketId}\n` +
    `- Cliente: ${cliente}\n` +
    `- Servicio: ${servicio}\n` +
    `- Respuestas del Brief:\n${briefTexto || '- (sin respuestas)'}\n` +
    `- Diseño: ${diseno}\n` +
    `- Observaciones: ${obs}\n\n` +
    despedida
  )
}