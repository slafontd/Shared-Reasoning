import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Sun, Moon, Loader2, CheckCircle2, XCircle, Trophy } from 'lucide-react'
import TemaProvider, { type Tema } from './theme'
import { LogoWordmark } from './Logo'
import { obtenerRetoDiario, type RetoDiario as RetoDiarioType, type PreguntaReto } from '../api/retos'

type Props = { onVolver: () => void }

// Respuesta de cada pregunta: para "opcion_multiple", el índice elegido; para
// "relacionar", un mapa {índice del término -> definición elegida}.
type Respuesta = number | Record<number, string>

function mezclar<T>(items: T[]): T[] {
  const copia = [...items]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

function RetoDiario({ onVolver }: Props) {
  const [tema, setTema] = useState<Tema>('light')
  const [reto, setReto] = useState<RetoDiarioType | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [respuestas, setRespuestas] = useState<Record<number, Respuesta>>({})
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    obtenerRetoDiario()
      .then(setReto)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo generar el reto.'))
      .finally(() => setCargando(false))
  }, [])

  const todasRespondidas = useMemo(() => {
    if (!reto) return false
    return reto.preguntas.every((p, i) => {
      const r = respuestas[i]
      if (p.tipo === 'opcion_multiple') return typeof r === 'number'
      return typeof r === 'object' && r !== null && Object.keys(r).length === (p.pares?.length ?? 0)
    })
  }, [reto, respuestas])

  function esCorrecta(p: PreguntaReto, i: number): boolean {
    const r = respuestas[i]
    if (p.tipo === 'opcion_multiple') return r === p.respuestaCorrecta
    if (!p.pares || typeof r !== 'object' || r === null) return false
    return p.pares.every((par, idx) => (r as Record<number, string>)[idx] === par.definicion)
  }

  const aciertos = reto && enviado ? reto.preguntas.filter((p, i) => esCorrecta(p, i)).length : 0
  const xpGanado = reto ? Math.round((aciertos / reto.preguntas.length) * reto.xpRecompensa) : 0

  return (
    <TemaProvider tema={tema} className="min-h-screen flex flex-col" style={{ color: 'var(--ink)', background: 'linear-gradient(135deg,var(--bg1),var(--bg2))' }}>
      <header className="flex items-center gap-3 px-6 h-16 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={onVolver} className="grid place-items-center w-9 h-9 rounded-lg hover:bg-black/5 transition" title="Volver">
          <ArrowLeft size={18} />
        </button>
        <LogoWordmark height={28} />
        <span className="text-sm font-semibold ml-1">Reto diario</span>
        <button
          onClick={() => setTema((t) => (t === 'light' ? 'dark' : 'light'))}
          className="ml-auto grid place-items-center w-9 h-9 rounded-full panel hover:-translate-y-0.5 transition"
          title={tema === 'light' ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
        >
          {tema === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </header>

      <main className="flex-1 p-6 max-w-2xl mx-auto w-full space-y-4">
        {cargando ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Generando tu reto de hoy…</p>
          </div>
        ) : error ? (
          <div className="rounded-xl px-3 py-2 text-sm" style={{ background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.4)', color: '#fca5a5' }}>
            {error}
          </div>
        ) : reto ? (
          <>
            <div>
              <p className="text-lg font-semibold">{reto.titulo}</p>
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{reto.descripcion}</p>
            </div>

            {enviado && (
              <div className="panel rounded-2xl p-5 flex items-center gap-4">
                <Trophy size={28} style={{ color: 'var(--accent)' }} />
                <div>
                  <p className="text-sm font-semibold">{aciertos} de {reto.preguntas.length} correctas</p>
                  <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>+{xpGanado} XP de {reto.xpRecompensa} posibles</p>
                </div>
              </div>
            )}

            {reto.preguntas.map((p, i) => (
              <PreguntaCard
                key={i}
                pregunta={p}
                respuesta={respuestas[i]}
                enviado={enviado}
                correcta={enviado ? esCorrecta(p, i) : null}
                onCambiar={(r) => setRespuestas((actuales) => ({ ...actuales, [i]: r }))}
              />
            ))}

            {!enviado && (
              <button
                onClick={() => setEnviado(true)}
                disabled={!todasRespondidas}
                className="w-full px-5 py-2.5 rounded-xl accent-bg text-white text-sm font-medium shadow-lg hover:brightness-110 disabled:opacity-40 transition"
              >
                Enviar respuestas
              </button>
            )}
          </>
        ) : null}
      </main>
    </TemaProvider>
  )
}

function PreguntaCard({ pregunta, respuesta, enviado, correcta, onCambiar }: {
  pregunta: PreguntaReto
  respuesta: Respuesta | undefined
  enviado: boolean
  correcta: boolean | null
  onCambiar: (r: Respuesta) => void
}) {
  // Orden de las definiciones fijo mientras dura la pregunta, no en cada
  // render (si no, cambiaría de orden con cada clic del usuario).
  const definicionesMezcladas = useMemo(
    () => (pregunta.pares ? mezclar(pregunta.pares.map((p) => p.definicion)) : []),
    [pregunta],
  )

  return (
    <div className="panel rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{pregunta.pregunta}</p>
        {enviado && (correcta ? <CheckCircle2 size={18} style={{ color: '#22c55e' }} /> : <XCircle size={18} style={{ color: '#dc2626' }} />)}
      </div>
      {pregunta.pista && !enviado && (
        <p className="text-xs italic" style={{ color: 'var(--ink-soft)' }}>Pista: {pregunta.pista}</p>
      )}

      {pregunta.tipo === 'opcion_multiple' && pregunta.opciones ? (
        <div className="space-y-1.5">
          {pregunta.opciones.map((op, idx) => {
            const elegida = respuesta === idx
            const esLaCorrecta = idx === pregunta.respuestaCorrecta
            return (
              <button
                key={idx}
                onClick={() => !enviado && onCambiar(idx)}
                disabled={enviado}
                className="w-full text-left rounded-xl px-3 py-2 text-sm transition"
                style={{
                  background: enviado
                    ? (esLaCorrecta ? 'rgba(34,197,94,.15)' : elegida ? 'rgba(220,38,38,.15)' : 'var(--bg2)')
                    : elegida ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--bg2)',
                  border: elegida ? '1px solid var(--accent)' : '1px solid transparent',
                }}
              >
                {op}
              </button>
            )
          })}
        </div>
      ) : pregunta.tipo === 'relacionar' && pregunta.pares ? (
        <div className="space-y-2">
          {pregunta.pares.map((par, idx) => {
            const elegida = (respuesta as Record<number, string> | undefined)?.[idx] ?? ''
            const esCorrectaPar = elegida === par.definicion
            return (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-sm w-32 shrink-0 truncate" title={par.termino}>{par.termino}</span>
                <select
                  value={elegida}
                  disabled={enviado}
                  onChange={(e) => {
                    const actual = { ...(respuesta as Record<number, string> | undefined) }
                    actual[idx] = e.target.value
                    onCambiar(actual)
                  }}
                  className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{
                    background: enviado ? (esCorrectaPar ? 'rgba(34,197,94,.15)' : 'rgba(220,38,38,.15)') : 'var(--bg2)',
                    border: '1px solid var(--border)',
                    color: 'var(--ink)',
                  }}
                >
                  <option value="" disabled>Elige una definición…</option>
                  {definicionesMezcladas.map((def) => <option key={def} value={def}>{def}</option>)}
                </select>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default RetoDiario
