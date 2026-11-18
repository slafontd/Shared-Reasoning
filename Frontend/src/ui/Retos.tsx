import { useEffect, useState } from 'react'
import { ArrowLeft, Sun, Moon, Trophy, Sparkles, Flame, CheckCircle2 } from 'lucide-react'
import TemaProvider, { type Tema } from './theme'
import { LogoWordmark } from './Logo'
import { obtenerRacha, type Racha } from '../api/retos'

type Props = {
  onVolver: () => void
  onEmpezarDiario: () => void
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

function letraDelDia(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'narrow' }).toUpperCase()
}

function nombreDelDia(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ============================================================
//  Retos: el reto diario (un quiz por día) y la racha de días seguidos
//  completándolo. Todo viene del backend (ver retos.py).
// ============================================================
function Retos({ onVolver, onEmpezarDiario }: Props) {
  const [tema, setTema] = useState<Tema>('light')
  const [racha, setRacha] = useState<Racha | null>(null)
  const [errorRacha, setErrorRacha] = useState(false)

  useEffect(() => {
    let cancelado = false
    obtenerRacha()
      .then((r) => !cancelado && setRacha(r))
      .catch(() => !cancelado && setErrorRacha(true))
    return () => { cancelado = true }
  }, [])

  const mensaje = !racha
    ? null
    : racha.completadoHoy
      ? '¡Reto de hoy completado! Vuelve mañana para seguir sumando.'
      : racha.enRiesgo
        ? `Completa el reto de hoy para no perder tu racha de ${plural(racha.rachaActual, 'día', 'días')}.`
        : racha.diasCompletados === 0
          ? 'Completa tu primer reto para empezar tu racha.'
          : 'Tu racha se reinició. ¡Completa el reto de hoy para empezar otra!'

  return (
    <TemaProvider tema={tema} className="min-h-screen flex flex-col" style={{ color: 'var(--ink)', background: 'linear-gradient(135deg,var(--bg1),var(--bg2))' }}>
      <header className="flex items-center gap-3 px-6 h-16 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={onVolver} className="grid place-items-center w-9 h-9 rounded-lg hover:bg-black/5 transition" title="Volver">
          <ArrowLeft size={18} />
        </button>
        <LogoWordmark height={28} />
        <span className="text-sm font-semibold ml-1">Retos</span>
        <button
          onClick={() => setTema((t) => (t === 'light' ? 'dark' : 'light'))}
          className="ml-auto grid place-items-center w-9 h-9 rounded-full panel hover:-translate-y-0.5 transition"
          title={tema === 'light' ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
        >
          {tema === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </header>

      <main className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-md space-y-4">
          {/* Racha */}
          <section className="panel rounded-2xl p-6 text-center space-y-4 anim-fade-in" aria-label="Racha">
            <div
              className="mx-auto grid place-items-center w-14 h-14 rounded-2xl"
              style={{ background: racha && racha.rachaActual > 0 ? 'rgba(249,115,22,.15)' : 'var(--bg1)' }}
            >
              <Flame size={28} style={{ color: racha && racha.rachaActual > 0 ? '#f97316' : 'var(--ink-soft)' }} />
            </div>
            {racha ? (
              <>
                <div>
                  <p className="text-4xl font-bold tabular-nums" data-testid="racha-actual">{racha.rachaActual}</p>
                  <p className="text-sm font-medium">{racha.rachaActual === 1 ? 'día de racha' : 'días de racha'}</p>
                </div>

                <ol className="flex justify-center gap-2" aria-label="Últimos 7 días">
                  {racha.ultimosDias.map((d, i) => {
                    const esHoy = i === racha.ultimosDias.length - 1
                    return (
                      <li key={d.fecha} className="flex flex-col items-center gap-1" title={`${nombreDelDia(d.fecha)}: ${d.completado ? 'reto completado' : 'sin completar'}`}>
                        <span
                          className="grid place-items-center w-8 h-8 rounded-full transition"
                          style={{
                            background: d.completado ? '#f97316' : 'var(--bg1)',
                            border: esHoy && !d.completado ? '2px dashed #f97316' : '2px solid transparent',
                            color: d.completado ? '#fff' : 'var(--ink-soft)',
                          }}
                        >
                          {d.completado ? <CheckCircle2 size={16} aria-label="Completado" /> : null}
                        </span>
                        <span className="text-[11px] font-medium" style={{ color: esHoy ? 'var(--ink)' : 'var(--ink-soft)' }}>{letraDelDia(d.fecha)}</span>
                      </li>
                    )
                  })}
                </ol>

                <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{mensaje}</p>

                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl p-2.5" style={{ background: 'var(--bg1)' }}>
                    <dd className="text-lg font-semibold tabular-nums">{racha.mejorRacha}</dd>
                    <dt className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Mejor racha</dt>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: 'var(--bg1)' }}>
                    <dd className="text-lg font-semibold tabular-nums">{racha.diasCompletados}</dd>
                    <dt className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Retos hechos</dt>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: 'var(--bg1)' }}>
                    <dd className="text-lg font-semibold tabular-nums">{racha.xpTotal}</dd>
                    <dt className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>XP ganado</dt>
                  </div>
                </dl>
              </>
            ) : errorRacha ? (
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>No se pudo cargar tu racha. Puedes hacer el reto igual.</p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Cargando tu racha…</p>
            )}
          </section>

          {/* Reto de hoy */}
          <section className="panel rounded-2xl p-6 text-center space-y-4 anim-fade-in" style={{ animationDelay: '0.1s' }} aria-label="Reto diario">
            <div className="mx-auto grid place-items-center w-12 h-12 rounded-2xl" style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}>
              <Trophy size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <p className="text-lg font-semibold">Reto diario</p>
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              Un quiz corto generado por IA para reforzar fundamentos de electrónica, con
              preguntas ajustadas a tu nivel. Hay uno nuevo cada día.
            </p>
            <button
              onClick={onEmpezarDiario}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl accent-bg text-white text-sm font-medium shadow-lg hover:brightness-110 transition"
            >
              {racha?.completadoHoy ? <CheckCircle2 size={15} /> : <Sparkles size={15} />}
              {racha?.completadoHoy ? 'Ver el reto de hoy' : racha?.enRiesgo ? 'Completar el reto de hoy' : 'Comenzar el reto'}
            </button>
          </section>
        </div>
      </main>
    </TemaProvider>
  )
}

export default Retos
