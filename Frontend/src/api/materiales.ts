import { fetchAutenticado } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type Categoria = 'libro' | 'pdf' | 'guia' | 'datasheet' | 'esquematico'
export type Dificultad = 'basico' | 'intermedio' | 'experto' | 'referencia'

export type Material = {
  id: string
  titulo: string
  categoria: Categoria
  dificultad: Dificultad
  // Absoluta y pública (sin JWT) — se usa directo en un <img src>. null =
  // sin portada generada (no era PDF, o falló al generarla); el front cae a
  // un ícono por categoría.
  portadaUrl: string | null
  // Absoluta pero SÍ requiere Authorization — nunca usar en un <a href>
  // directo, ver descargarMaterial().
  descargaUrl: string
  // Nombre original con extensión (para guardar el archivo con su nombre).
  nombreArchivo: string | null
  subidoPor: string
  fechaSubida: string
}

type MaterialAPI = {
  id: string
  titulo: string
  categoria: Categoria
  dificultad: Dificultad
  portada_url: string | null
  descarga_url: string
  nombre_archivo?: string | null
  subido_por: string
  fecha_subida: string
}

function aMaterial(m: MaterialAPI): Material {
  return {
    id: m.id,
    titulo: m.titulo,
    categoria: m.categoria,
    dificultad: m.dificultad,
    portadaUrl: m.portada_url ? `${API_URL}${m.portada_url}` : null,
    descargaUrl: `${API_URL}${m.descarga_url}`,
    nombreArchivo: m.nombre_archivo ?? null,
    subidoPor: m.subido_por,
    fechaSubida: m.fecha_subida,
  }
}

export async function listarMateriales(filtros?: { categoria?: Categoria; dificultad?: Dificultad }): Promise<Material[]> {
  const params = new URLSearchParams()
  if (filtros?.categoria) params.set('categoria', filtros.categoria)
  if (filtros?.dificultad) params.set('dificultad', filtros.dificultad)
  const query = params.toString()

  const res = await fetchAutenticado(`${API_URL}/materiales${query ? `?${query}` : ''}`)
  if (!res.ok) throw new Error('No se pudo cargar la biblioteca de materiales.')
  const data: MaterialAPI[] = await res.json()
  return data.map(aMaterial)
}

// Mismos tipos y tope que el backend (materiales.TIPOS_PERMITIDOS): el
// servidor los vuelve a validar mirando el contenido real del archivo; esto
// solo avisa antes de subir.
export const EXTENSIONES_MATERIAL = ['pdf', 'epub', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'csv', 'png', 'jpg', 'jpeg']
export const ACCEPT_MATERIAL = EXTENSIONES_MATERIAL.map((e) => `.${e}`).join(',')
export const MAX_BYTES_MATERIAL = 20 * 1024 * 1024
export const TIPOS_MATERIAL_TEXTO = 'PDF, EPUB, Word, PowerPoint, Excel, TXT, MD, CSV, PNG o JPG (máx. 20 MB)'

export function validarArchivoMaterial(archivo: File): string | null {
  const extension = archivo.name.includes('.') ? archivo.name.split('.').pop()!.toLowerCase() : ''
  if (!EXTENSIONES_MATERIAL.includes(extension)) return `Tipo no permitido. Puedes subir: ${TIPOS_MATERIAL_TEXTO}.`
  if (archivo.size === 0) return 'El archivo está vacío.'
  if (archivo.size > MAX_BYTES_MATERIAL) return 'El archivo supera el límite de 20 MB.'
  return null
}

async function mensajeDeError(res: Response, porDefecto: string): Promise<string> {
  const data = await res.json().catch(() => null)
  return typeof data?.detail === 'string' ? data.detail : porDefecto
}

export async function subirMaterial(datos: {
  titulo: string
  categoria: Categoria
  dificultad: Dificultad
  archivo: File
}): Promise<Material> {
  const form = new FormData()
  form.set('titulo', datos.titulo)
  form.set('categoria', datos.categoria)
  form.set('dificultad', datos.dificultad)
  form.set('archivo', datos.archivo)

  const res = await fetchAutenticado(`${API_URL}/materiales/subir`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await mensajeDeError(res, 'No se pudo subir el material.'))
  return aMaterial(await res.json())
}

// /materiales/descargar/{id} exige Authorization, así que no puede ser un
// <a href> directo — se trae como blob y se dispara la descarga desde JS.
export async function descargarMaterial(material: Material): Promise<void> {
  const res = await fetchAutenticado(material.descargaUrl)
  if (!res.ok) throw new Error('No se pudo descargar el material.')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = material.nombreArchivo ?? material.titulo
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}


export async function obtenerArchivoMaterial(material: Material): Promise<File> {
  const res = await fetchAutenticado(material.descargaUrl)
  if (!res.ok) throw new Error('No se pudo cargar esa imagen.')
  const blob = await res.blob()
  const nombre = material.nombreArchivo ?? `${material.titulo}.png`
  return new File([blob], nombre, { type: blob.type })
}

export async function eliminarMaterial(id: string): Promise<void> {
  const res = await fetchAutenticado(`${API_URL}/materiales/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('No se pudo eliminar el material.')
}

export type Tutorial = {
  resumen: string
  comoFunciona: string
  usosComunes: string[]
  consejosConexion: string
}

type TutorialAPI = {
  resumen: string
  como_funciona: string
  usos_comunes: string[]
  consejos_conexion: string
}

export async function obtenerTutorial(componente: string): Promise<Tutorial> {
  const res = await fetchAutenticado(`${API_URL}/materiales/tutorial/${encodeURIComponent(componente)}`)
  if (!res.ok) throw new Error('No se pudo generar el tutorial.')
  const t: TutorialAPI = await res.json()
  return { resumen: t.resumen, comoFunciona: t.como_funciona, usosComunes: t.usos_comunes, consejosConexion: t.consejos_conexion }
}

export async function preguntarTutorial(
  componente: string,
  mensaje: string,
  historial: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const res = await fetchAutenticado(`${API_URL}/materiales/tutorial-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ componente, mensaje, historial }),
  })
  if (!res.ok) throw new Error('No se pudo responder la pregunta.')
  const data = await res.json()
  return data.respuesta as string
}
