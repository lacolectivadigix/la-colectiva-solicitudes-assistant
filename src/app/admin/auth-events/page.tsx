"use client"

import { useEffect, useState } from "react"
import RequireAuth from "@/components/RequireAuth"

interface AuthEvent {
  id: number
  type: string
  payload: any
  created_at: string
}

export default function AuthEventsPage() {
  const [events, setEvents] = useState<AuthEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterEmail, setFilterEmail] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const fetchEvents = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/auth-events")
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setEvents(data.events || [])
    } catch (e: any) {
      setError(e.message || "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const filtered = events.filter((ev) => {
    const email = ev?.payload?.user?.email || ev?.payload?.email || ""
    const created = new Date(ev.created_at).getTime()
    const emailOk = filterEmail ? email.toLowerCase().includes(filterEmail.toLowerCase()) : true
    const startOk = startDate ? created >= new Date(startDate).getTime() : true
    const endOk = endDate ? created <= new Date(endDate).getTime() : true
    return emailOk && startOk && endOk
  })

  return (
    <RequireAuth allowedRoles={["administrador"]}>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Eventos de Autenticación</h1>
              <p className="text-sm text-gray-600">Listado de eventos capturados por Supabase Auth</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchEvents}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Actualizar
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    value={filterEmail}
                    onChange={(e) => setFilterEmail(e.target.value)}
                    placeholder="filtrar por email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setFilterEmail("")
                      setStartDate("")
                      setEndDate("")
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Limpiar filtros
                  </button>
                </div>
              </div>
            </div>

            {/* Status */}
            {loading && (
              <div className="text-gray-600">Cargando eventos...</div>
            )}
            {error && (
              <div className="rounded border border-red-200 bg-red-50 text-red-800 p-3">{error}</div>
            )}

            {/* Table */}
            {!loading && !error && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-500">Sin resultados</td>
                      </tr>
                    ) : (
                      filtered.map((ev) => {
                        const email = ev?.payload?.user?.email || ev?.payload?.email || ""
                        return (
                          <tr key={ev.id}>
                            <td className="px-4 py-3 text-sm text-gray-900">{ev.id}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{ev.type}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{email}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{new Date(ev.created_at).toLocaleString()}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
                <div className="px-4 py-2 text-sm text-gray-600">Mostrando {filtered.length} de {events.length} eventos</div>
              </div>
            )}
          </div>
        </main>
      </div>
    </RequireAuth>
  )
}