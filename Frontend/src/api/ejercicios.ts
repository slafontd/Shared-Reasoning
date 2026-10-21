import { fetchAutenticado } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Ejercicios de un curso y soluciones de los estudiantes — ver
// Backend/ejercicios.py. Límites iguales a los del backend.
export const MAX_IMAGENES_POR_EJERCICIO = 6
export const MAX_BYTES_IMAGEN = 3 * 1024 * 1024
export const TIPOS_IMAGEN = 'image/png,image/jpeg,image/gif,image/webp'
export const MAX_ARCHIVOS_POR_SOLUCION = 5
export const MAX_BYTES_ARCHIVO_SOLUCION = 5 * 1024 * 1024
export const TIPOS_SOLUCION = `${TIPOS_IMAGEN},application/pdf`
export const MAX_TEXTO_SOLUCION = 5000

export type ImagenEjercicio = { id: string; nombre: string; mime: string; tamano: number }
export type ArchivoSolucion = { id: string; nombre: string; mime: string; tamano: number }

export type Solucion = {
  id: string
  ejercicioId: string
  estudianteId: string
  estudianteNombre: string
  texto: string | null
  fechaEntrega: string
  archivos: ArchivoSolucion[]
}

type SolucionAPI = {
  id: string
  ejercicio_id: string
  estudiante_id: string
  estudiante_nombre: string
  texto: string | null
  fecha_entrega: string
  archivos: ArchivoSolucion[]
}

function aSolucion(s: SolucionAPI): Solucion {
  return {
    id: s.id,
    ejercicioId: s.ejercicio_id,
    estudianteId: s.estudiante_id,
    estudianteNombre: s.estudiante_nombre,
    texto: s.texto,
    fechaEntrega: s.fecha_entrega,
    archivos: s.archivos ?? [],
  }
}

export type Ejercicio = {
  id: string
  cursoId: string
  titulo: string
  enunciado: string | null
  fechaCreacion: string
  // US16: cuándo lo editó el profesor por última vez (null si nunca).
  fechaActualizacion: string | null
  imagenes: ImagenEjercicio[]
  // Para un estudiante: su solución (null si aún no entrega).
  miSolucion: Solucion | null
  // Para quien gestiona el curso: cuántos estudiantes ya entregaron.
  totalSoluciones: number | null
}

type EjercicioAPI = {
  id: string
  curso_id: string
  titulo: string
  enunciado: string | null
  fecha_creacion: string
  fecha_actualizacion?: string | null
  imagenes?: ImagenEjercicio[]
  mi_solucion?: SolucionAPI | null
  total_soluciones?: number | null
}

function aEjercicio(e: EjercicioAPI): Ejercicio {
  return {
    id: e.id,
    cursoId: e.curso_id,
    titulo: e.titulo,
    enunciado: e.enunciado,
    fechaCreacion: e.fecha_creacion,
    fechaActualizacion: e.fecha_actualizacion ?? null,
    imagenes: e.imagenes ?? [],
    miSolucion: e.mi_solucion ? aSolucion(e.mi_solucion) : null,
    totalSoluciones: e.total_soluciones ?? null,
  }
}

async function mensajeDeError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null)
  return typeof data?.detail === 'string' ? data.detail : res.statusText || 'Error desconocido'
}

// Ya vienen ordenados por fecha de creación (el primero que subió el profesor, primero).
export async function listarEjercicios(cursoId: string): Promise<Ejercicio[]> {
  const res = await fetchAutenticado(`${API_URL}/cursos/${cursoId}/ejercicios`)
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return ((await res.json()) as EjercicioAPI[]).map(aEjercicio)
}

// Solo el profesor que creó el curso (403 para cualquier otro, administradores incluidos).
export async function crearEjercicio(cursoId: string, datos: { titulo: string; enunciado?: string }): Promise<Ejercicio> {
  const res = await fetchAutenticado(`${API_URL}/cursos/${cursoId}/ejercicios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return aEjercicio(await res.json())
}

// US16: modifica título y/o enunciado (solo el profesor que creó el curso;
// 403 para cualquier otro). Un enunciado vacío lo borra. Las imágenes y las
// soluciones ya entregadas no se tocan.
export async function actualizarEjercicio(id: string, datos: { titulo?: string; enunciado?: string | null }): Promise<Ejercicio> {
  const res = await fetchAutenticado(`${API_URL}/ejercicios/${id}`, {
    method: 'PATCH',
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

// Sube una imagen al enunciado (solo el profesor que creó el curso). El
// backend valida el contenido real del archivo.
export async function subirImagenEjercicio(ejercicioId: string, archivo: File): Promise<ImagenEjercicio> {
  const form = new FormData()
  form.set('archivo', archivo)
  const res = await fetchAutenticado(`${API_URL}/ejercicios/${ejercicioId}/imagenes`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return (await res.json()) as ImagenEjercicio
}

export async function eliminarImagenEjercicio(imagenId: string): Promise<void> {
  const res = await fetchAutenticado(`${API_URL}/ejercicios/imagenes/${imagenId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await mensajeDeError(res))
}

// La imagen exige sesión, así que no puede ir en un <img src> directo: se
// trae con el token y se devuelve una URL de objeto (el llamador la revoca).
export async function cargarImagenEjercicio(imagenId: string): Promise<string> {
  const res = await fetchAutenticado(`${API_URL}/ejercicios/imagenes/${imagenId}`)
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return URL.createObjectURL(await res.blob())
}

// --- Soluciones ---

// El estudiante inscrito entrega su solución (texto y/o archivos). Volver a
// enviar REEMPLAZA la anterior por completo.
export async function entregarSolucion(ejercicioId: string, datos: { texto: string; archivos: File[] }): Promise<Solucion> {
  const form = new FormData()
  if (datos.texto.trim()) form.set('texto', datos.texto.trim())
  for (const f of datos.archivos) form.append('archivos', f)
  const res = await fetchAutenticado(`${API_URL}/ejercicios/${ejercicioId}/solucion`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return aSolucion(await res.json())
}

export async function retirarSolucion(ejercicioId: string): Promise<void> {
  const res = await fetchAutenticado(`${API_URL}/ejercicios/${ejercicioId}/solucion`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await mensajeDeError(res))
}

// Solo quien gestiona el curso: todas las soluciones recibidas de un ejercicio.
export async function listarSoluciones(ejercicioId: string): Promise<Solucion[]> {
  const res = await fetchAutenticado(`${API_URL}/ejercicios/${ejercicioId}/soluciones`)
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return ((await res.json()) as SolucionAPI[]).map(aSolucion)
}

// Igual que las imágenes del enunciado: exige sesión, así que se descarga con
// el token. Devuelve una URL de objeto (el llamador la revoca).
export async function cargarArchivoSolucion(archivoId: string): Promise<string> {
  const res = await fetchAutenticado(`${API_URL}/soluciones/archivos/${archivoId}`)
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return URL.createObjectURL(await res.blob())
}

// Los PDF se guardan para el estudiante como descarga (el backend los sirve
// con Content-Disposition: attachment).
export async function descargarArchivoSolucion(archivo: ArchivoSolucion): Promise<void> {
  const url = await cargarArchivoSolucion(archivo.id)
  const a = document.createElement('a')
  a.href = url
  a.download = archivo.nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
