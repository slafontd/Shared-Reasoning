import { fetchAutenticado } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Cursos (US08 crear, #11 · US09 consultar, #12 · US11 eliminar, #14) —
// ver Backend/cursos.py.
export type Curso = {
  id: string
  nombre: string
  codigo: string | null
  descripcion: string | null
  creadoPor: string
  creadoPorNombre: string
  fechaCreacion: string
  // US12: código para encontrar el curso e inscribirse. Solo llega para
  // quien creó el curso o un administrador; para el resto es null.
  codigoAcceso: string | null
  // US13: si el usuario actual está inscrito en el curso.
  inscrito: boolean
}

type CursoAPI = {
  id: string
  nombre: string
  codigo: string | null
  descripcion: string | null
  creado_por: string
  creado_por_nombre: string
  fecha_creacion: string
  codigo_acceso: string | null
  inscrito?: boolean
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
    codigoAcceso: c.codigo_acceso ?? null,
    inscrito: c.inscrito ?? false,
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

// Tamaño de página: igual al límite por defecto de GET /cursos.
export const CURSOS_POR_PAGINA = 50

export async function listarCursos(opciones: { busqueda?: string; desplazamiento?: number } = {}): Promise<Curso[]> {
  const params = new URLSearchParams({ limite: String(CURSOS_POR_PAGINA) })
  if (opciones.busqueda?.trim()) params.set('busqueda', opciones.busqueda.trim())
  if (opciones.desplazamiento) params.set('desplazamiento', String(opciones.desplazamiento))
  const res = await fetchAutenticado(`${API_URL}/cursos?${params}`)
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return ((await res.json()) as CursoAPI[]).map(aCurso)
}

// US11 (#14): el backend ya valida que solo pueda hacerlo quien creó el
// curso o un administrador (cursos.eliminar_curso) — este llamado puede
// devolver 403 si el usuario no tiene permiso sobre ESE curso en particular.
export async function eliminarCurso(id: string): Promise<void> {
  const res = await fetchAutenticado(`${API_URL}/cursos/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await mensajeDeError(res))
}

// US12 (#15): busca un curso por el código de acceso que compartió el
// profesor. Lanza error con el mensaje del backend si no existe (404).
export async function buscarCursoPorCodigo(codigo: string): Promise<Curso> {
  const res = await fetchAutenticado(`${API_URL}/cursos/codigo/${encodeURIComponent(codigo.trim())}`)
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return aCurso(await res.json())
}

// US13 (#16): inscribe al estudiante con el código de acceso del curso.
// 404 si el código no existe, 409 si ya estaba inscrito, 403 si no es estudiante.
export async function inscribirseCurso(codigo: string): Promise<Curso> {
  const res = await fetchAutenticado(`${API_URL}/cursos/inscripciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo: codigo.trim() }),
  })
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return aCurso(await res.json())
}

// US13 (#16): cursos en los que el usuario está inscrito.
export async function listarMisCursos(): Promise<Curso[]> {
  const res = await fetchAutenticado(`${API_URL}/cursos/mis-cursos`)
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return ((await res.json()) as CursoAPI[]).map(aCurso)
}
