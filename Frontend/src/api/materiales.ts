import { fetchAutenticado } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type Categoria = 'libro' | 'pdf' | 'guia' | 'datasheet'
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
  if (!res.ok) throw new Error('No se pudo subir el material.')
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
  a.download = material.titulo
  a.click()
  URL.revokeObjectURL(url)
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
