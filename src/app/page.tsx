import Link from 'next/link'
import Image from 'next/image'

export default function LandingPro() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white">
      {/* Ambient background: grid + animated beams */}
      <div className="pointer-events-none absolute inset-0 bg-grid grid-mask" aria-hidden="true" />
      <div className="pointer-events-none absolute -top-16 -left-24 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-indigo-400/40 via-violet-400/40 to-fuchsia-400/40 blur-3xl animate-[drift_12s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute top-1/3 -right-20 h-[24rem] w-[24rem] rounded-full bg-gradient-to-br from-fuchsia-400/40 via-violet-400/40 to-indigo-400/40 blur-3xl animate-[floatY_10s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-[20rem] w-[20rem] rounded-full bg-gradient-to-br from-sky-400/40 via-indigo-400/40 to-violet-400/40 blur-3xl animate-[drift_16s_ease-in-out_infinite]" />

      {/* Navbar glasmórfico */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-6xl px-6 lg:px-12 py-3">
          <div className="glass flex items-center justify-between rounded-2xl px-4 py-2">
            <div className="flex items-center gap-3">
              <Image
                src="/assets/images/branding/logo-la-colectiva.png"
                alt="Logo de La Colectiva"
                width={156}
                height={52}
                priority
                className="h-[2.6rem] w-auto"
              />
            </div>
            <div className="hidden sm:flex items-center gap-6 text-sm">
              <a href="#problema" className="text-gray-700 hover:text-gray-900 transition-colors">El Problema</a>
              <a href="#solucion" className="text-gray-700 hover:text-gray-900 transition-colors">La Solución</a>
              <a href="#funcionamiento" className="text-gray-700 hover:text-gray-900 transition-colors">Cómo Funciona</a>
              <Link href="/login" className="group inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 transition">
                Probar el Asistente
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 transition-transform group-hover:translate-x-0.5">
                  <path fillRule="evenodd" d="M4.5 12a.75.75 0 01.75-.75h11.69l-3.22-3.22a.75.75 0 111.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 11-1.06-1.06l3.22-3.22H5.25A.75.75 0 014.5 12z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero glasmórfico */}
      <header id="hero" className="relative pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-12">
          <div className="glass rounded-3xl p-8 lg:p-12 border-white/20 hover-lift">
            <div className="flex flex-col lg:flex-row items-center gap-10">
              <div className="flex-1">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600">
                    El fin de los formularios.
                  </span>
                </h1>
                <h2 className="mt-3 text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-800">
                  Presentamos el Asistente Inteligente de Compras de Grupo DIMEO.
                </h2>
                <p className="mt-5 max-w-2xl text-gray-700 text-base sm:text-lg">
                  Transformamos el caótico proceso de solicitudes en una única conversación fluida e inteligente.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link href="/login" className="group inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-white text-sm sm:text-base font-semibold shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition">
                    <span>Iniciar Sesión y Probar el Asistente</span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5">
                        <path fillRule="evenodd" d="M4.5 12a.75.75 0 01.75-.75h11.69l-3.22-3.22a.75.75 0 111.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 11-1.06-1.06l3.22-3.22H5.25A.75.75 0 014.5 12z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </Link>
                  <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-gray-800 text-sm sm:text-base font-semibold hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition">
                    Ver demo
                  </Link>
                </div>

                {/* Chips de valoración (sin referencia a Next.js) */}
                <div className="mt-8 flex flex-wrap gap-3">
                  {[
                    {label: 'UX sin formularios', icon: '/globe.svg'},
                    {label: 'Auth con Supabase', icon: '/window.svg'},
                  ].map((c) => (
                    <div key={c.label} className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-gray-700">
                      <Image src={c.icon} alt="icon" width={16} height={16} />
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Panel visual */}
              <div className="flex-1 w-full">
                <div className="relative">
                  <div className="glass relative mx-auto max-w-lg rounded-2xl">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                          <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                        </div>
                        <span className="text-xs text-gray-500">live preview</span>
                      </div>
                      <div className="mt-6 space-y-4">
                        <div className="h-4 w-2/3 rounded bg-indigo-100/60 animate-pulse" />
                        <div className="h-4 w-1/3 rounded bg-indigo-100/60 animate-pulse" />
                        <div className="h-28 rounded-xl border border-white/30 bg-gradient-to-br from-indigo-50/60 to-violet-50/60 flex items-center justify-center">
                          <div className="text-sm text-gray-700">UI de chat con respuesta del asistente</div>
                        </div>
                        <div className="h-4 w-1/2 rounded bg-indigo-100/60 animate-pulse" />
                      </div>
                    </div>
                  </div>
                  {/* Removed Next.js logo badge */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sección: Problema glasmórfico */}
      <section id="problema" className="scroll-mt-24 mx-auto max-w-6xl px-6 lg:px-12 py-12">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-6 hover-lift">
            <h2 className="text-2xl font-bold text-gray-900">Validamos un problema, ahora creamos la solución real.</h2>
            <p className="mt-2 text-gray-700">El MVP V 1.0 confirmó que el proceso de compras tradicional está roto.</p>
          </div>
          <div className="glass rounded-2xl p-6 hover-lift">
            <h3 className="text-base font-semibold text-gray-900">Para el Solicitante ("Mar")</h3>
            <p className="mt-2 text-sm text-gray-700">Formularios confusos, falta de guía y fricción al capturar el brief.</p>
          </div>
        </div>
      </section>

      {/* Sección: Solución */}
      <section id="solucion" className="scroll-mt-24 mx-auto max-w-6xl px-6 lg:px-12 py-12">
        <div className="glass rounded-2xl p-6 hover-lift">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Nuestra solución: El Chat Unificado.</h2>
          <p className="mt-3 text-gray-700">La Colectiva V 2.0 es una <strong className="text-gray-900">Aplicación Conversacional Inteligente</strong> basada en un paradigma radical: <strong className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">cero formularios</strong>.</p>
          <p className="mt-2 text-gray-700">Una única interfaz que se transforma dinámicamente según quién seas.</p>
        </div>
      </section>

      {/* Sección: Funcionamiento */}
      <section id="funcionamiento" className="scroll-mt-24 mx-auto max-w-6xl px-6 lg:px-12 py-12">
        <div className="grid lg:grid-cols-3 gap-6">
          {[
            {
              icon: '🤖',
              title: 'C-UX 1: El Asesor Experto (Solicitantes)',
              points: [
                'Captura guiada por árbol de preguntas',
                'Consejo experto con Gemini',
                'Solicitud completa con TicketID vía Gmail API',
              ],
            },
            {
              icon: '⚙️',
              title: 'C-UX 2: Asistente de Gestión (Administradores)',
              points: [
                'Gestión por comandos (e.g. "Actualizar solicitud T-202510...")',
                'Flujo de actualización y ejecución de UPDATE en Supabase',
              ],
            },
            {
              icon: '💬',
              title: 'C-UX 3: Agente de Consulta (Todos)',
              points: [
                'Consulta en lenguaje natural sobre estado de solicitudes',
                'Verificación de permisos y respuesta clara',
              ],
            },
          ].map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 hover-lift">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{f.icon}</span>
                <h3 className="text-base font-semibold text-gray-900">{f.title}</h3>
              </div>
              <ul className="mt-3 list-disc list-inside text-sm text-gray-700 space-y-1">
                {f.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Stack (sin tarjeta Next.js) */}
      <section id="stack" className="scroll-mt-24 mx-auto max-w-6xl px-6 lg:px-12 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {title: 'Supabase', desc: 'Almacén seguro y autenticación.'},
            {title: 'Gemini API', desc: 'Cerebro experto conversacional.'},
            {title: 'Vercel', desc: 'Despliegue con rendimiento global.'},
          ].map((s) => (
            <div key={s.title} className="glass rounded-2xl p-6 hover-lift">
              <h4 className="text-base font-semibold text-gray-900">{s.title}</h4>
              <p className="mt-2 text-sm text-gray-700">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Equipo */}
      <section id="equipo" className="scroll-mt-24 mx-auto max-w-6xl px-6 lg:px-12 py-12">
        <div className="glass rounded-2xl p-6 hover-lift">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Creado por el equipo "La Colectiva"</h2>
          <p className="mt-3 text-gray-700">Proyecto para el Concurso de IA de Grupo DIMEO.</p>
          <ul className="mt-6 flex flex-wrap gap-3">
            {['Karol','Pao','Mar','Daniela'].map(name => (
              <li key={name} className="px-4 py-2 rounded-full glass border-white/30 text-sm text-gray-800">[{name}]</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA con borde shimmer */}
      <footer id="final-cta" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-6 lg:px-12 py-14 lg:py-20">
          <div className="rounded-3xl p-[1px] bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 shadow-lg">
            <div className="glass rounded-3xl px-8 py-10 lg:px-12 lg:py-14 flex flex-col lg:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Deja de gestionar tareas. Dirige conversaciones.</h2>
                <p className="mt-2 text-gray-700">¿Listo para experimentar el futuro de las compras internas?</p>
              </div>
              <Link href="/login" className="group inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-white text-sm sm:text-base font-semibold shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition">
                <span>Prueba La Colectiva V 2.0 Ahora</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 transition-transform group-hover:translate-x-0.5">
                  <path fillRule="evenodd" d="M4.5 12a.75.75 0 01.75-.75h11.69l-3.22-3.22a.75.75 0 111.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 11-1.06-1.06l3.22-3.22H5.25A.75.75 0 014.5 12z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
