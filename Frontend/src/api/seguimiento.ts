import { fetchAutenticado } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type ProgresoEstudiante = {
  estudianteId: string
  nombre: string
  totalEjercicios: number
  completados: number
  enProgreso: number
  sinIniciar: number
  porcentaje: number
  ultimaActividad: string | null
}

export type CursoProgreso = {
  cursoId: string
  cursoNombre: string
  totalEjercicios: number
  estudiantes: ProgresoEstudiante[]
}

export type EjercicioProgresoDetalle = {
  ejercicioId: string
  titulo: string
  estado: 'no_iniciado' | 'en_progreso' | 'completado'
  ultimaActividad: string | null
  revisado: boolean
  revisadoEn: string | null
}

export type DetalleProgresoEstudiante = ProgresoEstudiante & {
  estudianteNombre: string
  cursoId: string
  cursoNombre: string
  ejercicios: EjercicioProgresoDetalle[]
}

type ProgresoEstudianteAPI = {
  estudiante_id: string
  nombre: string
  total_ejercicios: number
  completados: number
  en_progreso: number
  sin_iniciar: number
  porcentaje: number
  ultima_actividad: string | null
}

type CursoProgresoAPI = {
  curso_id: string
  curso_nombre: string
  total_ejercicios: number
  estudiantes: ProgresoEstudianteAPI[]
}

type EjercicioProgresoAPI = {
  ejercicio_id: string
  titulo: string
  estado: EjercicioProgresoDetalle['estado']
  ultima_actividad: string | null
  revisado: boolean
  revisado_en: string | null
}

type DetalleProgresoAPI = ProgresoEstudianteAPI & {
  estudiante_nombre: string
  curso_id: string
  curso_nombre: string
  ejercicios: EjercicioProgresoAPI[]
}

async function mensajeDeError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null)
  return typeof data?.detail === 'string' ? data.detail : res.statusText || 'Error desconocido'
}

function aEstudiante(p: ProgresoEstudianteAPI): ProgresoEstudiante {
  return {
    estudianteId: p.estudiante_id,
    nombre: p.nombre,
    totalEjercicios: p.total_ejercicios,
    completados: p.completados,
    enProgreso: p.en_progreso,
    sinIniciar: p.sin_iniciar,
    porcentaje: p.porcentaje,
    ultimaActividad: p.ultima_actividad,
  }
}

export async function obtenerProgresoCurso(cursoId: string): Promise<CursoProgreso> {
  const res = await fetchAutenticado(`${API_URL}/cursos/${cursoId}/progreso-estudiantes`)
  if (!res.ok) throw new Error(await mensajeDeError(res))
  const curso = (await res.json()) as CursoProgresoAPI
  return {
    cursoId: curso.curso_id,
    cursoNombre: curso.curso_nombre,
    totalEjercicios: curso.total_ejercicios,
    estudiantes: curso.estudiantes.map(aEstudiante),
  }
}

export async function obtenerDetalleProgreso(
  cursoId: string,
  estudianteId: string,
): Promise<DetalleProgresoEstudiante> {
  const res = await fetchAutenticado(
    `${API_URL}/cursos/${cursoId}/progreso-estudiantes/${estudianteId}`,
  )
  if (!res.ok) throw new Error(await mensajeDeError(res))
  const detalle = (await res.json()) as DetalleProgresoAPI
  return {
    ...aEstudiante(detalle),
    estudianteNombre: detalle.estudiante_nombre,
    cursoId: detalle.curso_id,
    cursoNombre: detalle.curso_nombre,
    ejercicios: detalle.ejercicios.map((ejercicio) => ({
      ejercicioId: ejercicio.ejercicio_id,
      titulo: ejercicio.titulo,
      estado: ejercicio.estado,
      ultimaActividad: ejercicio.ultima_actividad,
      revisado: ejercicio.revisado,
      revisadoEn: ejercicio.revisado_en,
    })),
  }
}

export async function actualizarRevisionEjercicio(
  cursoId: string,
  estudianteId: string,
  ejercicioId: string,
  revisado: boolean,
): Promise<void> {
  const res = await fetchAutenticado(
    `${API_URL}/cursos/${cursoId}/progreso-estudiantes/${estudianteId}/ejercicios/${ejercicioId}/revision`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisado }),
    },
  )
  if (!res.ok) throw new Error(await mensajeDeError(res))
}
