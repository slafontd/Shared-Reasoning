import { fetchAutenticado } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Métricas de la plataforma — EP07: US26 dashboard, US27 por profesor,
// US28 por curso. Ver Backend/metricas_plataforma.py. El administrador ve
// todo; un profesor, solo sus cursos. Los campos vienen en snake_case del
// backend y se usan tal cual (son solo lectura).
export type TotalesEntregas = {
  entregas: number
  con_feedback: number
  sin_feedback: number
  tasa_feedback: number
}

export type ResumenMetricas = TotalesEntregas & {
  alcance: 'plataforma' | 'profesor'
  cursos: number
  estudiantes: number
  inscripciones: number
  ejercicios: number
  usuarios_total: number | null
  usuarios_por_rol: Record<string, number> | null
  activos_7_dias: number | null
  activos_30_dias: number | null
  desactivados: number | null
}

export type MetricasProfesor = TotalesEntregas & {
  profesor_id: string
  nombre: string
  email: string
  cursos: number
  estudiantes: number
  ejercicios: number
  ultimo_acceso: string | null
}

export type MetricasCurso = TotalesEntregas & {
  curso_id: string
  nombre: string
  codigo: string | null
  profesor_nombre: string
  inscritos: number
  ejercicios: number
  tasa_entrega: number
  ultima_entrega: string | null
}

export type MetricasEjercicio = TotalesEntregas & {
  ejercicio_id: string
  titulo: string
  tasa_entrega: number
}

export type DetalleMetricasCurso = MetricasCurso & { por_ejercicio: MetricasEjercicio[] }

async function obtener<T>(ruta: string): Promise<T> {
  const res = await fetchAutenticado(`${API_URL}${ruta}`)
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(typeof data?.detail === 'string' ? data.detail : res.statusText || 'Error desconocido')
  }
  return res.json()
}

export const obtenerResumenMetricas = () => obtener<ResumenMetricas>('/metricas/resumen')
export const obtenerMetricasProfesores = () => obtener<MetricasProfesor[]>('/metricas/profesores')
export const obtenerMetricasCursos = () => obtener<MetricasCurso[]>('/metricas/cursos')
export const obtenerDetalleMetricasCurso = (id: string) => obtener<DetalleMetricasCurso>(`/metricas/cursos/${id}`)
