import { fetchAutenticado } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Cursos (US08 crear, #11 · US09 consultar, #12) — ver Backend/cursos.py.
export type Curso = {
  id: string
  nombre: string
  codigo: string | null
  descripcion: string | null
  creadoPor: string
  creadoPorNombre: string
  fechaCreacion: string
}

type CursoAPI = {
  id: string
  nombre: string
  codigo: string | null
  descripcion: string | null
  creado_por: string
  creado_por_nombre: string
  fecha_creacion: string
}

function aCurso(c: CursoAPI): Curso {
  return {
    id: c.id,
    nombre: c.nombre,
    codigo: c.codigo,
    descripcion: c.descripcion,
    creadoPor: c.creado_por,
    creadoPorNombre: c.creado_por_nombre,
    fechaCreacion: c.fecha_creacion,
  }
}

async function mensajeDeError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null)
  return typeof data?.detail === 'string' ? data.detail : res.statusText || 'Error desconocido'
}

export async function crearCurso(datos: { nombre: string; codigo?: string; descripcion?: string }): Promise<Curso> {
  const res = await fetchAutenticado(`${API_URL}/cursos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return aCurso(await res.json())
}
