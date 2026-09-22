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

export type RetoDiario = {
  titulo: string
  descripcion: string
  xpRecompensa: number
  preguntas: PreguntaReto[]
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
}

export async function obtenerRetoDiario(): Promise<RetoDiario> {
  const res = await fetchAutenticado(`${API_URL}/retos/diario`)
  if (!res.ok) throw new Error('No se pudo generar el reto diario. Intenta de nuevo.')
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
  }
}
