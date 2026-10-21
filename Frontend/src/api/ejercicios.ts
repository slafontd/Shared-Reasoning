import { fetchAutenticado } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Ejercicios de un curso — ver Backend/ejercicios.py. Base mínima para
// US17 (eliminar ejercicio, #21); US14/US15 deben extender esto.
export type Ejercicio = {
  id: string
  cursoId: string
  titulo: string
  enunciado: string | null
  fechaCreacion: string
}

type EjercicioAPI = {
  id: string
  curso_id: string
  titulo: string
  enunciado: string | null
  fecha_creacion: string
}

function aEjercicio(e: EjercicioAPI): Ejercicio {
  return { id: e.id, cursoId: e.curso_id, titulo: e.titulo, enunciado: e.enunciado, fechaCreacion: e.fecha_creacion }
}

async function mensajeDeError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null)
  return typeof data?.detail === 'string' ? data.detail : res.statusText || 'Error desconocido'
}

export async function listarEjercicios(cursoId: string): Promise<Ejercicio[]> {
  const res = await fetchAutenticado(`${API_URL}/cursos/${cursoId}/ejercicios`)
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return ((await res.json()) as EjercicioAPI[]).map(aEjercicio)
}

export async function crearEjercicio(cursoId: string, datos: { titulo: string; enunciado?: string }): Promise<Ejercicio> {
  const res = await fetchAutenticado(`${API_URL}/cursos/${cursoId}/ejercicios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return aEjercicio(await res.json())
}

// US17 (#21): solo el profesor del curso o un administrador (403 si no).
export async function eliminarEjercicio(id: string): Promise<void> {
  const res = await fetchAutenticado(`${API_URL}/ejercicios/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await mensajeDeError(res))
}
