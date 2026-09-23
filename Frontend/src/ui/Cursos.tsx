import { useEffect, useState } from 'react'
import { ArrowLeft, Sun, Moon, Plus, X, Loader2, GraduationCap, CheckCircle2, Search } from 'lucide-react'
import TemaProvider, { type Tema } from './theme'
import { LogoWordmark } from './Logo'
import { crearCurso, listarCursos, CURSOS_POR_PAGINA, type Curso } from '../api/cursos'

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
  const [seleccionado, setSeleccionado] = useState<Curso | null>(null)

  // Consulta (US09, #12): la búsqueda se hace en el backend (nombre o código,
  // sin mayúsculas ni tildes) con una pausa de 300 ms para no pedir en cada tecla.
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [hayMas, setHayMas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    const temporizador = setTimeout(() => {
      setCargando(true)
      setError(null)
      listarCursos({ busqueda })
        .then((lista) => {
          if (cancelado) return
          setCursos(lista)
          setHayMas(lista.length === CURSOS_POR_PAGINA)
        })
        .catch((e) => !cancelado && setError(e instanceof Error ? e.message : 'No se pudieron cargar los cursos.'))
        .finally(() => !cancelado && setCargando(false))
    }, busqueda ? 300 : 0)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [busqueda])

  async function cargarMas() {
    setCargandoMas(true)
    try {
      const siguiente = await listarCursos({ busqueda, desplazamiento: cursos.length })
      setCursos((actuales) => [...actuales, ...siguiente])
      setHayMas(siguiente.length === CURSOS_POR_PAGINA)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar más cursos.')
    } finally {
      setCargandoMas(false)
    }
  }

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
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-soft)' }} />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o código…"
              aria-label="Buscar cursos"
              maxLength={100}
              className="w-full rounded-xl pl-9 pr-3 py-2 text-sm outline-none"
              style={estiloCampo}
            />
          </div>
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

        {error && (
          <div role="alert" className="rounded-xl px-3 py-2 text-sm" style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.4)', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {cargando ? (
          <p className="text-sm text-center py-16 flex items-center justify-center gap-2" style={{ color: 'var(--ink-soft)' }}>
            <Loader2 size={15} className="animate-spin" /> Cargando cursos…
          </p>
        ) : cursos.length === 0 ? (
          <div className="panel rounded-2xl p-10 text-center space-y-2">
            <GraduationCap size={28} className="mx-auto" style={{ color: 'var(--accent)' }} />
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              {busqueda.trim()
                ? `Ningún curso coincide con «${busqueda.trim()}».`
                : 'Todavía no hay cursos. Crea el primero con «Nuevo curso».'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cursos.map((c) => <TarjetaCurso key={c.id} curso={c} onAbrir={() => setSeleccionado(c)} />)}
            </div>
            {hayMas && (
              <div className="flex justify-center">
                <button
                  onClick={cargarMas}
                  disabled={cargandoMas}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl panel text-sm hover:-translate-y-0.5 transition disabled:opacity-50"
                >
                  {cargandoMas && <Loader2 size={14} className="animate-spin" />}
                  Cargar más
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {modalAbierto && <ModalCrearCurso onCerrar={() => setModalAbierto(false)} onCreado={alCrear} />}
      {seleccionado && <ModalDetalleCurso curso={seleccionado} onCerrar={() => setSeleccionado(null)} />}
    </TemaProvider>
  )
}

function fechaLegible(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function EtiquetaCodigo({ codigo }: { codigo: string }) {
  return (
    <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-mono" style={{ background: 'var(--bg1)', color: 'var(--ink-soft)' }}>
      {codigo}
    </span>
  )
}

function TarjetaCurso({ curso, onAbrir }: { curso: Curso; onAbrir: () => void }) {
  return (
    <button onClick={onAbrir} className="panel rounded-2xl p-5 flex flex-col justify-start gap-2 text-left hover:-translate-y-0.5 transition">
      <div className="flex items-start gap-2">
        <h2 className="font-semibold flex-1 break-words">{curso.nombre}</h2>
        {curso.codigo && <EtiquetaCodigo codigo={curso.codigo} />}
      </div>
      {curso.descripcion && (
        <p className="text-sm line-clamp-3 whitespace-pre-line" style={{ color: 'var(--ink-soft)' }}>{curso.descripcion}</p>
      )}
      <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
        Creado por {curso.creadoPorNombre} · {fechaLegible(curso.fechaCreacion)}
      </p>
    </button>
  )
}

function ModalDetalleCurso({ curso, onCerrar }: { curso: Curso; onCerrar: () => void }) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-30 grid place-items-center p-4" style={{ background: 'rgba(0,0,0,.5)' }} onClick={onCerrar}>
      <div
        role="dialog"
        aria-label={curso.nombre}
        onClick={(e) => e.stopPropagation()}
        className="panel rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-start gap-3">
          <div className="grid place-items-center w-10 h-10 rounded-xl shrink-0" style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}>
            <GraduationCap size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg break-words">{curso.nombre}</h2>
            {curso.codigo && <EtiquetaCodigo codigo={curso.codigo} />}
          </div>
          <button onClick={onCerrar} className="grid place-items-center w-7 h-7 rounded-lg hover:bg-black/5" title="Cerrar">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm whitespace-pre-line break-words" style={{ color: curso.descripcion ? 'var(--ink)' : 'var(--ink-soft)' }}>
          {curso.descripcion ?? 'Este curso no tiene descripción.'}
        </p>
        <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
          Creado por {curso.creadoPorNombre} el {fechaLegible(curso.fechaCreacion)}
        </p>
      </div>
    </div>
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
