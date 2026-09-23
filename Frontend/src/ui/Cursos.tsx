import { useState } from 'react'
import { ArrowLeft, Sun, Moon, Plus, X, Loader2, GraduationCap, CheckCircle2 } from 'lucide-react'
import TemaProvider, { type Tema } from './theme'
import { LogoWordmark } from './Logo'
import { crearCurso, type Curso } from '../api/cursos'

type Props = {
  onVolver: () => void
}

// Límites iguales a los del backend (schemas/cursos.py).
const NOMBRE_MIN = 3
const NOMBRE_MAX = 150
const CODIGO_MAX = 20
const DESCRIPCION_MAX = 2000

const estiloCampo = { background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--ink)' }

// ============================================================
//  Cursos: crear (US08, #11) y consultar (US09, #12).
// ============================================================
function Cursos({ onVolver }: Props) {
  const [tema, setTema] = useState<Tema>('light')
  const [cursos, setCursos] = useState<Curso[]>([])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [recienCreado, setRecienCreado] = useState<Curso | null>(null)

  function alCrear(curso: Curso) {
    setCursos((actuales) => [curso, ...actuales])
    setRecienCreado(curso)
    setModalAbierto(false)
  }

  return (
    <TemaProvider tema={tema} className="min-h-screen" style={{ color: 'var(--ink)', background: 'linear-gradient(135deg,var(--bg1),var(--bg2))' }}>
      <header className="flex items-center gap-3 px-6 h-16 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={onVolver} className="grid place-items-center w-9 h-9 rounded-lg hover:bg-black/5 transition" title="Volver">
          <ArrowLeft size={18} />
        </button>
        <LogoWordmark height={28} />
        <span className="text-sm font-semibold ml-1">Cursos</span>
        <button
          onClick={() => setTema((t) => (t === 'light' ? 'dark' : 'light'))}
          className="ml-auto grid place-items-center w-9 h-9 rounded-full panel hover:-translate-y-0.5 transition"
          title={tema === 'light' ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
        >
          {tema === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold flex-1">Cursos</h1>
          <button
            onClick={() => setModalAbierto(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl accent-bg text-white text-sm font-medium shadow hover:brightness-110 transition"
          >
            <Plus size={15} />
            Nuevo curso
          </button>
        </div>

        {recienCreado && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
            style={{ background: 'rgba(22,163,74,.1)', border: '1px solid rgba(22,163,74,.4)' }}
          >
            <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
            <span className="flex-1">Curso «{recienCreado.nombre}» creado.</span>
            <button onClick={() => setRecienCreado(null)} className="grid place-items-center w-6 h-6 rounded hover:bg-black/5" title="Cerrar aviso">
              <X size={14} />
            </button>
          </div>
        )}

        {cursos.length === 0 ? (
          <div className="panel rounded-2xl p-10 text-center space-y-2">
            <GraduationCap size={28} className="mx-auto" style={{ color: 'var(--accent)' }} />
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Todavía no hay cursos. Crea el primero con «Nuevo curso».</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cursos.map((c) => <TarjetaCurso key={c.id} curso={c} />)}
          </div>
        )}
      </main>

      {modalAbierto && <ModalCrearCurso onCerrar={() => setModalAbierto(false)} onCreado={alCrear} />}
    </TemaProvider>
  )
}

function TarjetaCurso({ curso }: { curso: Curso }) {
  return (
    <article className="panel rounded-2xl p-5 space-y-2">
      <div className="flex items-start gap-2">
        <h2 className="font-semibold flex-1 break-words">{curso.nombre}</h2>
        {curso.codigo && (
          <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-mono" style={{ background: 'var(--bg1)', color: 'var(--ink-soft)' }}>
            {curso.codigo}
          </span>
        )}
      </div>
      {curso.descripcion && (
        <p className="text-sm line-clamp-3 whitespace-pre-line" style={{ color: 'var(--ink-soft)' }}>{curso.descripcion}</p>
      )}
      <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
        Creado por {curso.creadoPorNombre} · {new Date(curso.fechaCreacion).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
    </article>
  )
}

function ModalCrearCurso({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (c: Curso) => void }) {
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nombreValido = nombre.trim().length >= NOMBRE_MIN

  async function enviar() {
    setError(null)
    if (!nombreValido) {
      setError(`El nombre debe tener al menos ${NOMBRE_MIN} caracteres.`)
      return
    }
    setGuardando(true)
    try {
      const curso = await crearCurso({
        nombre: nombre.trim(),
        codigo: codigo.trim() || undefined,
        descripcion: descripcion.trim() || undefined,
      })
      onCreado(curso)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el curso.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center p-4" style={{ background: 'rgba(0,0,0,.5)' }} onClick={onCerrar}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); enviar() }}
        className="panel rounded-2xl p-6 w-full max-w-md space-y-3"
        aria-label="Crear curso"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Nuevo curso</p>
          <button type="button" onClick={onCerrar} className="grid place-items-center w-7 h-7 rounded-lg hover:bg-black/5" title="Cerrar">
            <X size={16} />
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>Nombre *</span>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={NOMBRE_MAX}
            placeholder="Ej. Circuitos Eléctricos I"
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={estiloCampo}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>Código (opcional)</span>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            maxLength={CODIGO_MAX}
            placeholder="Ej. ST0263"
            className="w-full rounded-xl px-3 py-2 text-sm outline-none uppercase placeholder:normal-case"
            style={estiloCampo}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs flex justify-between" style={{ color: 'var(--ink-soft)' }}>
            <span>Descripción (opcional)</span>
            <span>{descripcion.length}/{DESCRIPCION_MAX}</span>
          </span>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={DESCRIPCION_MAX}
            rows={4}
            placeholder="¿De qué trata el curso?"
            className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-y"
            style={estiloCampo}
          />
        </label>

        {error && <p role="alert" className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}

        <button
          type="submit"
          disabled={!nombreValido || guardando}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl accent-bg text-white text-sm font-medium shadow hover:brightness-110 disabled:opacity-40 transition"
        >
          {guardando && <Loader2 size={14} className="animate-spin" />}
          {guardando ? 'Creando…' : 'Crear curso'}
        </button>
      </form>
    </div>
  )
}

export default Cursos
