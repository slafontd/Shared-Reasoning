import { fetchAutenticado } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Frecuencia de uso e interacciones (US30) — ver Backend/metricas_uso.py.
// Solo administrador. Los campos vienen en snake_case y se usan tal cual
// (son solo lectura), igual que en metricas.ts.
export type PeriodoUso = { dias: number; desde: string; hasta: string; zona_horaria: string }

export type ResumenUso = {
  eventos: number
  interacciones: number
  inicios_sesion: number
  usuarios_activos: number
  usuarios_totales: number
  porcentaje_activos: number
  promedio_interacciones_por_usuario: number
  promedio_dias_activos: number
}

export type PuntoDiario = { fecha: string; interacciones: number; inicios_sesion: number; usuarios_activos: number }
export type TotalPorTipo = { tipo: string; etiqueta: string; total: number; es_interaccion: boolean }
export type UsoPorRol = { rol: string; usuarios_activos: number; interacciones: number }
export type UsoPorHora = { hora: number; eventos: number }

export type UsoPlataforma = {
  periodo: PeriodoUso
  resumen: ResumenUso
  serie_diaria: PuntoDiario[]
  por_tipo: TotalPorTipo[]
  por_rol: UsoPorRol[]
  por_hora: UsoPorHora[]
}

export type UsoDeUsuario = {
  usuario_id: string
  nombre: string
  email: string
  rol: string
  interacciones: number
  inicios_sesion: number
  dias_activos: number
  frecuencia: number
  ultima_actividad: string | null
}

export type ListaUsoUsuarios = { periodo: PeriodoUso; total: number; usuarios: UsoDeUsuario[] }

export type EventoReciente = { tipo: string; etiqueta: string; fecha: string }

export type DetalleUsoUsuario = {
  periodo: PeriodoUso
  usuario: UsoDeUsuario
  ultimo_acceso: string | null
  serie_diaria: PuntoDiario[]
  por_tipo: TotalPorTipo[]
  recientes: EventoReciente[]
}

export type OrdenUsuarios = 'interacciones' | 'dias_activos' | 'ultima_actividad' | 'nombre'

async function pedir<T>(ruta: string): Promise<T> {
  const res = await fetchAutenticado(`${API_URL}${ruta}`)
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(typeof data?.detail === 'string' ? data.detail : res.statusText || 'Error desconocido')
  }
  return (await res.json()) as T
}

export const obtenerUsoPlataforma = (dias: number) => pedir<UsoPlataforma>(`/metricas/uso?dias=${dias}`)

export function obtenerUsoUsuarios(opciones: { dias: number; rol?: string; buscar?: string; orden?: OrdenUsuarios; limite?: number }) {
  const q = new URLSearchParams({ dias: String(opciones.dias), orden: opciones.orden ?? 'interacciones', limite: String(opciones.limite ?? 50) })
  if (opciones.rol) q.set('rol', opciones.rol)
  if (opciones.buscar?.trim()) q.set('buscar', opciones.buscar.trim())
  return pedir<ListaUsoUsuarios>(`/metricas/uso/usuarios?${q}`)
}

export const obtenerDetalleUsoUsuario = (usuarioId: string, dias: number) =>
  pedir<DetalleUsoUsuario>(`/metricas/uso/usuarios/${usuarioId}?dias=${dias}`)
