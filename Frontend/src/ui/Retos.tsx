import { useState } from 'react'
import { ArrowLeft, Sun, Moon, Trophy, Sparkles } from 'lucide-react'
import TemaProvider, { type Tema } from './theme'
import { LogoWordmark } from './Logo'

type Props = {
  onVolver: () => void
  onEmpezarDiario: () => void
}

// Sin rachas ni XP acumulado: el backend no persiste ese dato todavía (ver
// retos.py) y mostrar un número inventado como si fuera real sería engañoso.
// El reto diario en sí (retos/RetoDiario.tsx) sí es un dato generado de
// verdad en cada visita.
function Retos({ onVolver, onEmpezarDiario }: Props) {
  const [tema, setTema] = useState<Tema>('light')

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
        <div className="panel rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="mx-auto grid place-items-center w-14 h-14 rounded-2xl" style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}>
            <Trophy size={26} style={{ color: 'var(--accent)' }} />
          </div>
          <p className="text-lg font-semibold">Reto diario</p>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            Un quiz corto generado por IA para reforzar fundamentos de electrónica, con
            preguntas ajustadas a tu nivel. Uno nuevo cada vez que entras.
          </p>
          <button
            onClick={onEmpezarDiario}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl accent-bg text-white text-sm font-medium shadow-lg hover:brightness-110 transition"
          >
            <Sparkles size={15} />
            Comenzar el reto
          </button>
        </div>
      </main>
    </TemaProvider>
  )
}

export default Retos
