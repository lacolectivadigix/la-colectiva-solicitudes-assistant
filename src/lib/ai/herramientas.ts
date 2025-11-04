// --- NUEVO ARCHIVO: src/lib/ai/herramientas.ts ---
// Aquí vive la lógica de negocio (los JSONs, Supabase).
// El orquestador solo LLAMA a estas funciones.

import type {
  FunctionCall,
  FunctionDeclaration,
  FunctionResponse,
} from '@google/generative-ai'
import type { ChatStep } from './prompt_orchestrator' // Importamos el tipo de estado

// Importamos los JSONs cacheados
import clientes from '../../../public/cache/clientes.json'
import servicios from '../../../public/cache/servicios.json'
import brief_preguntas from '../../../public/cache/brief_preguntas.json'

// Importamos el cliente de Supabase
import { getSupabaseServerWithToken } from '../supabase/server'
import fs from 'node:fs'
import path from 'node:path'

function logToFile(message: string) {
  try {
    const dir = path.join(process.cwd(), 'logs')
    const file = path.join(dir, 'ai-tools.log')
    fs.mkdirSync(dir, { recursive: true })
    const line = `[${new Date().toISOString()}] ${message}\n`
    fs.appendFileSync(file, line, 'utf8')
  } catch {}
}

// --- Definición de Herramientas (El "Menú" para la IA) ---

const herramientas = {
  // Herramienta 1: Buscar Cliente
  buscarCliente: {
    name: 'buscarCliente',
    description:
      'Busca y valida un cliente en la base de datos. Devuelve una lista de coincidencias o el cliente exacto si se encuentra.',
    parameters: {
      type: 'object',
      properties: {
        terminoBusqueda: {
          type: 'string',
          description: 'El nombre del cliente a buscar, ej: "MSD", "Coosalud"',
        },
      },
      required: ['terminoBusqueda'],
    },
  },

  // Herramienta 2: Buscar Servicio
  buscarServicio: {
    name: 'buscarServicio',
    description:
      'Busca un servicio en el catálogo. Valida "flyer", "traducción", "stand", etc. Devuelve el objeto de servicio coincidente.',
    parameters: {
      type: 'object',
      properties: {
        terminoBusqueda: {
          type: 'string',
          description:
            'El servicio que el usuario mencionó, ej: "flyers", "lona", "traducción de video"',
        },
      },
      required: ['terminoBusqueda'],
    },
  },

  // Herramienta 3: Obtener el Brief (¡Clave!)
  obtenerPreguntasDelBrief: {
    name: 'obtenerPreguntasDelBrief',
    description:
      'Obtiene la lista de preguntas OBLIGATORIAS para un servicio específico. La IA debe usar esto para saber qué preguntar.',
    parameters: {
      type: 'object',
      properties: {
        servicio_principal: {
          type: 'string',
          description: 'La categoría principal, ej: "Impresiones"',
        },
        tipo_servicio: {
          type: 'string',
          description: 'La subcategoría, ej: "Materiales de Gran Formato y POP"',
        },
      },
      required: ['servicio_principal', 'tipo_servicio'],
    },
  },

  // Herramienta 4: Guardar Solicitud (¡El "Punto 9"!)
  guardarSolicitudEnSupabase: {
    name: 'guardarSolicitudEnSupabase',
    description:
      'Guarda la solicitud de cotización final en la base de datos. Se llama SÓLO cuando se tienen TODAS las respuestas del brief.',
    parameters: {
      type: 'object',
      properties: {
        clienteId: { type: 'string' },
        servicioId: { type: 'string' },
        respuestasBrief: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pregunta: { type: 'string' },
              respuesta: { type: 'string' },
            },
          },
        },
        linkDiseno: { type: 'string' },
        observaciones: { type: 'string' },
        userId: { type: 'string' },
      },
      required: ['clienteId', 'servicioId', 'respuestasBrief'],
    },
  },
} satisfies Record<string, FunctionDeclaration>

/**
 * Esta función simplemente expone el "menú" al orquestador.
 */
export function getHerramientasDisponibles(): FunctionDeclaration[] {
  return Object.values(herramientas)
}

// --- Lógica de Ejecución (El "Motor" de las Herramientas) ---

type ToolResult = {
  toolResult: FunctionResponse['response']
  toolStep?: ChatStep
}

/**
 * Esta es la función principal que ejecuta las herramientas.
 * Recibe la llamada de la IA y ejecuta el código real.
 */
export async function ejecutarHerramienta(
  call: FunctionCall,
): Promise<ToolResult> {
  const args = call.args || {}

  switch (call.name) {
    // --- Lógica de Herramienta 1 ---
    case 'buscarCliente': {
      console.log('Ejecutando buscarCliente con:', args.terminoBusqueda)
      logToFile(`buscarCliente args=${JSON.stringify(args)}`)
      
      const termino = (args.terminoBusqueda as string).toLowerCase()
      const resultados = clientes.filter(c => 
        c.cliente.toLowerCase().includes(termino)
      )
      logToFile(`buscarCliente resultados=${JSON.stringify(resultados.slice(0,3))}`)
      
      return { toolResult: { content: JSON.stringify(resultados) } }
    }

    // --- Lógica de Herramienta 2 ---
    case 'buscarServicio': {
      console.log('Ejecutando buscarServicio con:', args.terminoBusqueda)
      logToFile(`buscarServicio args=${JSON.stringify(args)}`)
      
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      const singular = (s: string) => (s.endsWith('s') ? s.slice(0, -1) : s)
      const expandSynonyms = (token: string): string[] => {
        const map: Record<string, string[]> = {
          flyer: ['flyer', 'volante'],
          volante: ['volante', 'flyer'],
          folletos: ['folleto', 'brochure'],
          folleto: ['folleto', 'brochure'],
          diptico: ['diptico'],
          triptico: ['triptico'],
          banner: ['banner', 'lona'],
          lonas: ['lona', 'banner'],
        }
        const base = singular(token)
        return map[base] ? map[base] : [base]
      }

      const termNorm = normalize(String(args.terminoBusqueda || ''))
      const termTokens = termNorm.split(/[^a-z0-9]+/).filter(Boolean)
      const variants = termTokens.flatMap(expandSynonyms)

      const resultado = servicios.find((s) => {
        const target = normalize(
          `${s.servicio_final} ${s.servicio_principal} ${s.tipo_servicio}`,
        )
        return variants.some((v) => target.includes(v))
      })
      logToFile(`buscarServicio resultado=${JSON.stringify(resultado || null)}`)
      
      return { toolResult: { content: JSON.stringify(resultado || null) } }
    }

    // --- Lógica de Herramienta 3 (CORREGIDA) ---
    case 'obtenerPreguntasDelBrief': {
      console.log('Ejecutando obtenerPreguntasDelBrief para:', args)
      logToFile(`obtenerPreguntasDelBrief args=${JSON.stringify(args)}`)

      // 1. Cargar preguntas generales (categoria == null)
      const preguntasGenerales = brief_preguntas.filter((p) => !p.categoria)

      // 2. Cargar preguntas específicas (¡LÓGICA CORREGIDA CON "Y" (&&)!)
      const preguntasEspecificas = brief_preguntas.filter(
        (p) => p.categoria === args.servicio_principal && p.subcategoria_1 === args.tipo_servicio,
      )

      // 3. Combinar y ordenar por 'orden'
      // Usamos un Set para evitar duplicados si los generales ya estuvieran (aunque no es el caso)
      const preguntasUnicas = new Map(
        [...preguntasGenerales, ...preguntasEspecificas].map((p) => [p.id, p]),
      )

      const todasLasPreguntas = Array.from(preguntasUnicas.values()).sort(
        (a, b) => (a.orden || 999) - (b.orden || 999),
      )
      logToFile(`obtenerPreguntasDelBrief total=${todasLasPreguntas.length}`)

      return { toolResult: { content: JSON.stringify(todasLasPreguntas) } }
    }

    // --- Lógica de Herramienta 4 (EL "PUNTO 9") ---
    case 'guardarSolicitudEnSupabase': {
      console.log('Ejecutando guardarSolicitudEnSupabase con:', args)
      
      try {
        // Simulación por ahora - en producción usar Supabase real
        // const supabase = getSupabaseServerWithToken(token)
        // const { data, error } = await supabase.from('solicitudes').insert({
        //   cliente_id: args.clienteId,
        //   servicio_id: args.servicioId,
        //   respuestas_brief: args.respuestasBrief,
        //   link_diseno: args.linkDiseno,
        //   observaciones: args.observaciones,
        //   user_id: args.userId,
        //   created_at: new Date().toISOString()
        // }).select()
        // 
        // if (error) throw new Error(error.message)
        // const ticketId = data[0].id

        const ticketId = `S-${Math.floor(Math.random() * 10000)}`
        logToFile(`guardarSolicitudEnSupabase ticketId=${ticketId}`)
        
        return {
          toolResult: {
            content: JSON.stringify({ success: true, ticketId: ticketId }),
          },
          toolStep: 'FINALIZANDO',
        }
      } catch (error: any) {
        logToFile(`guardarSolicitudEnSupabase error=${error?.message || error}`)
        return {
          toolResult: {
            content: JSON.stringify({ success: false, error: error.message }),
          },
          toolStep: 'ERROR',
        }
      }
    }

    default:
      return {
        toolResult: { content: JSON.stringify({ error: 'Herramienta desconocida' }) },
        toolStep: 'ERROR',
      }
  }
}