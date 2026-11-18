import { fetchAutenticado } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Métricas de un estudiante para el seguimiento individual del profesor —
// ver Backend/metricas_estudiante.py.
export type PerfilEstudiante = {
  estudianteId: string
  nombre: string
  email: string
  nivel: string
  nivelConfirmado: boolean
  fechaRegistro: string | null
  ultimoAcceso: string | null
  activo: boolean
  desactivadoPorInactividad: boolean
}

export type ProgresoGlobal = {
  cursos: number
  totalEjercicios: number
  completados: number
  enProgreso: number
  sinIniciar: number
  porcentaje: number
  entregasConFeedback: number
  revisados: number
}

export type ProgresoCursoEstudiante = {
  cursoId: string
  cursoNombre: string
  fechaInscripcion: string
  totalEjercicios: number
  completados: number
  enProgreso: number
  sinIniciar: number
  porcentaje: number
  entregasConFeedback: number
  revisados: number
  ultimaActividad: string | null
}

export type ActividadCircuitos = {
  sesiones: number
  sesionesFinalizadas: number
  tiempoTotalSegundos: number
  tiempoPromedioSegundos: number | null
  interaccionesChat: number
  ultimaSesion: string | null
}

export type EventoActividad = {
  tipo: 'entrega' | 'borrador' | 'circuito'
  descripcion: string
  cursoNombre: string | null
  fecha: string
}

export type MetricasEstudiante = {
  perfil: PerfilEstudiante
  progreso: ProgresoGlobal
  cursos: ProgresoCursoEstudiante[]
  circuitos: ActividadCircuitos
  actividadReciente: EventoActividad[]
}

type MetricasAPI = {
  perfil: {
    estudiante_id: string
    nombre: string
    email: string
    nivel: string
    nivel_confirmado: boolean
    fecha_registro: string | null
    ultimo_acceso: string | null
    activo: boolean
    desactivado_por_inactividad: boolean
  }
  progreso: {
    cursos: number
    total_ejercicios: number
    completados: number
    en_progreso: number
    sin_iniciar: number
    porcentaje: number
    entregas_con_feedback: number
    revisados: number
  }
  cursos: {
    curso_id: string
    curso_nombre: string
    fecha_inscripcion: string
    total_ejercicios: number
    completados: number
    en_progreso: number
    sin_iniciar: number
    porcentaje: number
    entregas_con_feedback: number
    revisados: number
    ultima_actividad: string | null
  }[]
  circuitos: {
    sesiones: number
    sesiones_finalizadas: number
    tiempo_total_segundos: number
    tiempo_promedio_segundos: number | null
    interacciones_chat: number
    ultima_sesion: string | null
  }
  actividad_reciente: { tipo: EventoActividad['tipo']; descripcion: string; curso_nombre: string | null; fecha: string }[]
}

async function mensajeDeError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null)
  return typeof data?.detail === 'string' ? data.detail : res.statusText || 'Error desconocido'
}

export async function obtenerMetricasEstudiante(estudianteId: string): Promise<MetricasEstudiante> {
  const res = await fetchAutenticado(`${API_URL}/metricas/estudiantes/${estudianteId}`)
  if (!res.ok) throw new Error(await mensajeDeError(res))
  const m = (await res.json()) as MetricasAPI
  return {
    perfil: {
      estudianteId: m.perfil.estudiante_id,
      nombre: m.perfil.nombre,
      email: m.perfil.email,
      nivel: m.perfil.nivel,
      nivelConfirmado: m.perfil.nivel_confirmado,
      fechaRegistro: m.perfil.fecha_registro,
      ultimoAcceso: m.perfil.ultimo_acceso,
      activo: m.perfil.activo,
      desactivadoPorInactividad: m.perfil.desactivado_por_inactividad,
    },
    progreso: {
      cursos: m.progreso.cursos,
      totalEjercicios: m.progreso.total_ejercicios,
      completados: m.progreso.completados,
      enProgreso: m.progreso.en_progreso,
      sinIniciar: m.progreso.sin_iniciar,
      porcentaje: m.progreso.porcentaje,
      entregasConFeedback: m.progreso.entregas_con_feedback,
      revisados: m.progreso.revisados,
    },
    cursos: m.cursos.map((c) => ({
      cursoId: c.curso_id,
      cursoNombre: c.curso_nombre,
      fechaInscripcion: c.fecha_inscripcion,
      totalEjercicios: c.total_ejercicios,
      completados: c.completados,
      enProgreso: c.en_progreso,
      sinIniciar: c.sin_iniciar,
      porcentaje: c.porcentaje,
      entregasConFeedback: c.entregas_con_feedback,
      revisados: c.revisados,
      ultimaActividad: c.ultima_actividad,
    })),
    circuitos: {
      sesiones: m.circuitos.sesiones,
      sesionesFinalizadas: m.circuitos.sesiones_finalizadas,
      tiempoTotalSegundos: m.circuitos.tiempo_total_segundos,
      tiempoPromedioSegundos: m.circuitos.tiempo_promedio_segundos,
      interaccionesChat: m.circuitos.interacciones_chat,
      ultimaSesion: m.circuitos.ultima_sesion,
    },
    actividadReciente: m.actividad_reciente.map((e) => ({
      tipo: e.tipo,
      descripcion: e.descripcion,
      cursoNombre: e.curso_nombre,
      fecha: e.fecha,
    })),
  }
}
