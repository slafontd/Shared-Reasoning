import { fetchAutenticado } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type ParRelacion = { termino: string; definicion: string }

export type PreguntaReto = {
  tipo: 'opcion_multiple' | 'relacionar'
  pregunta: string
  opciones?: string[] | null
  respuestaCorrecta?: number | null
  pares?: ParRelacion[] | null
  pista?: string | null
}

// El reto de HOY: es el mismo todo el día (se genera la primera vez que se
// abre) y trae su estado.
export type RetoDiario = {
  titulo: string
  descripcion: string
  xpRecompensa: number
  preguntas: PreguntaReto[]
  fecha: string
  completado: boolean
  aciertos: number | null
  xpGanado: number | null
}

export type DiaReto = { fecha: string; completado: boolean }

export type Racha = {
  rachaActual: number
  mejorRacha: number
  completadoHoy: boolean
  // Tiene racha pero hoy aún no completa el reto: si no lo hace, la pierde.
  enRiesgo: boolean
  diasCompletados: number
  xpTotal: number
  // Últimos 7 días, el más antiguo primero; hoy es el último.
  ultimosDias: DiaReto[]
}

type PreguntaRetoAPI = {
  tipo: 'opcion_multiple' | 'relacionar'
  pregunta: string
  opciones?: string[] | null
  respuesta_correcta?: number | null
  pares?: ParRelacion[] | null
  pista?: string | null
}

type RetoDiarioAPI = {
  titulo: string
  descripcion: string
  xp_recompensa: number
  preguntas: PreguntaRetoAPI[]
  fecha: string
  completado: boolean
  aciertos: number | null
  xp_ganado: number | null
}

type RachaAPI = {
  racha_actual: number
  mejor_racha: number
  completado_hoy: boolean
  en_riesgo: boolean
  dias_completados: number
  xp_total: number
  ultimos_dias: DiaReto[]
}

function aRacha(r: RachaAPI): Racha {
  return {
    rachaActual: r.racha_actual,
    mejorRacha: r.mejor_racha,
    completadoHoy: r.completado_hoy,
    enRiesgo: r.en_riesgo,
    diasCompletados: r.dias_completados,
    xpTotal: r.xp_total,
    ultimosDias: r.ultimos_dias,
  }
}

async function mensajeDeError(res: Response, porDefecto: string): Promise<string> {
  const data = await res.json().catch(() => null)
  return typeof data?.detail === 'string' ? data.detail : porDefecto
}

export async function obtenerRetoDiario(): Promise<RetoDiario> {
  const res = await fetchAutenticado(`${API_URL}/retos/diario`)
  if (!res.ok) throw new Error(await mensajeDeError(res, 'No se pudo generar el reto diario. Intenta de nuevo.'))
  const data: RetoDiarioAPI = await res.json()
  return {
    titulo: data.titulo,
    descripcion: data.descripcion,
    xpRecompensa: data.xp_recompensa,
    preguntas: data.preguntas.map((p) => ({
      tipo: p.tipo,
      pregunta: p.pregunta,
      opciones: p.opciones,
      respuestaCorrecta: p.respuesta_correcta,
      pares: p.pares,
      pista: p.pista,
    })),
    fecha: data.fecha,
    completado: data.completado,
    aciertos: data.aciertos,
    xpGanado: data.xp_ganado,
  }
}

// Marca el reto de hoy como completado (una sola vez) y devuelve la racha.
export async function completarRetoDiario(aciertos: number): Promise<Racha> {
  const res = await fetchAutenticado(`${API_URL}/retos/diario/completar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aciertos }),
  })
  if (!res.ok) throw new Error(await mensajeDeError(res, 'No se pudo guardar tu resultado.'))
  return aRacha(await res.json())
}

export async function obtenerRacha(): Promise<Racha> {
  const res = await fetchAutenticado(`${API_URL}/retos/racha`)
  if (!res.ok) throw new Error(await mensajeDeError(res, 'No se pudo cargar tu racha.'))
  return aRacha(await res.json())
}
