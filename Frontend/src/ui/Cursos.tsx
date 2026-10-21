import { useEffect, useState } from 'react'
import { ArrowLeft, Sun, Moon, Plus, X, Loader2, GraduationCap, CheckCircle2, Search, Trash2, KeyRound } from 'lucide-react'
import TemaProvider, { type Tema } from './theme'
import { LogoWordmark } from './Logo'
import {
  crearCurso, listarCursos, eliminarCurso, buscarCursoPorCodigo, inscribirseCurso, listarMisCursos,
  CURSOS_POR_PAGINA, type Curso,
} from '../api/cursos'
import type { Usuario } from '../api/auth'
import CursoDetalle from './CursoDetalle'
import { EtiquetaCodigo, EtiquetaInscrito, fechaLegible } from './cursosComun'

type Props = {
  usuario: Usuario | null
  onVolver: () => void
}

// Límites iguales a los del backend (schemas/cursos.py).
const NOMBRE_MIN = 3
const NOMBRE_MAX = 150
const CODIGO_MAX = 20
const DESCRIPCION_MAX = 2000

// Misma regla que la búsqueda del backend (cursos._sin_tildes): sin
// mayúsculas ni tildes. Se usa para filtrar "Mis cursos" en el navegador.
function sinTildes(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const estiloCampo = { background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--ink)' }

// ============================================================
//  Cursos: crear (US08, #11), consultar (US09, #12), eliminar (US11)
//  buscar por código de acceso (US12, #15), inscribirse (US13, #16).
//  Dos pestañas: «Mis cursos» (los que creaste o a los que estás unido) y
//  «Todos los cursos» (los de todos los profesores). Al abrir uno se llega a
//  CursoDetalle, con sus ejercicios y las soluciones.
// ============================================================
function Cursos({ usuario, onVolver }: Props) {
  const [tema, setTema] = useState<Tema>('light')
  // Quien gestiona cursos (profesor o administrador) ve la interfaz de
  // gestión; el resto, la de estudiante (unirse con código, "mis cursos").
  const esDocente = usuario?.rol === 'administrador' || usuario?.rol === 'profesor'
  // El administrador no crea ni se une a cursos: solo ve el catálogo completo.
  const tieneMisCursos = usuario?.rol !== 'administrador'
  // Solo los profesores crean cursos — el backend ya lo restringe
  // (cursos.crear_curso); esto evita ofrecer un botón que terminaría en un 403.
  const puedeCrear = usuario?.rol === 'profesor'
  // US11 (#14): un administrador puede eliminar cualquier curso; un
  // profesor, solo los que él mismo creó — mismo criterio que ya aplica el
  // backend (cursos.eliminar_curso), esto solo evita ofrecer un botón que
  // terminaría en un 403.
  function puedeEliminar(curso: Curso): boolean {
    if (usuario?.rol === 'administrador') return true
    return usuario?.rol === 'profesor' && curso.creadoPor === usuario.usuarioId
  }
  const [cursos, setCursos] = useState<Curso[]>([])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [recienCreado, setRecienCreado] = useState<Curso | null>(null)
  const [seleccionado, setSeleccionado] = useState<Curso | null>(null)
  const [buscarCodigoAbierto, setBuscarCodigoAbierto] = useState(false)
  // «Mis cursos»: para el estudiante, aquellos en los que está inscrito; para
  // el profesor, los que creó. «Todos»: el catálogo completo (US09).
  const [vista, setVista] = useState<'mis' | 'todos'>(tieneMisCursos ? 'mis' : 'todos')
  const [inscritoAviso, setInscritoAviso] = useState<Curso | null>(null)

  // Consulta (US09, #12): la búsqueda se hace en el backend (nombre o código,
  // sin mayúsculas ni tildes) con una pausa de 300 ms para no pedir en cada tecla.
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [hayMas, setHayMas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    // "Mis cursos" se trae completo y se filtra en el navegador; "Todos" busca
    // en el backend, así que solo esa pestaña depende de `busqueda`.
    const temporizador = setTimeout(() => {
      setCargando(true)
      setError(null)
      const peticion = vista === 'mis' ? listarMisCursos() : listarCursos({ busqueda })
      peticion
        .then((lista) => {
          if (cancelado) return
          setCursos(lista)
          setHayMas(vista === 'todos' && lista.length === CURSOS_POR_PAGINA)
        })
        .catch((e) => !cancelado && setError(e instanceof Error ? e.message : 'No se pudieron cargar los cursos.'))
        .finally(() => !cancelado && setCargando(false))
    }, vista === 'todos' && busqueda ? 300 : 0)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [busqueda, vista])

  const visibles = vista === 'mis' && busqueda.trim()
    ? cursos.filter((c) => sinTildes(`${c.nombre} ${c.codigo ?? ''}`).includes(sinTildes(busqueda.trim())))
    : cursos

  // US13: tras inscribirse, el curso aparece en "Mis cursos" de inmediato.
  function alInscribirse(curso: Curso) {
    setBuscarCodigoAbierto(false)
    setInscritoAviso(curso)
    setBusqueda('')
    if (vista === 'mis') setCursos((actuales) => [curso, ...actuales.filter((c) => c.id !== curso.id)])
    else setVista('mis')
  }

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

  // US11 (#14): pide confirmación antes de eliminar, y el curso deja de
  // estar disponible de inmediato (se saca de la lista sin esperar a un
  // refetch) — el DELETE ya fue exitoso en el backend cuando esto corre.
  async function eliminar(curso: Curso) {
    if (!confirm(`¿Eliminar el curso "${curso.nombre}"? Esta acción no se puede deshacer.`)) return
    setError(null)
    try {
      await eliminarCurso(curso.id)
      setCursos((actuales) => actuales.filter((c) => c.id !== curso.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el curso.')
    }
  }

  // Dentro de un curso: pantalla propia con sus ejercicios. Este componente
  // sigue montado, así que al volver se conservan la pestaña y la búsqueda.
  if (seleccionado) {
    return (
      <CursoDetalle
        curso={seleccionado}
        usuario={usuario}
        tema={tema}
        onCambiarTema={() => setTema((t) => (t === 'light' ? 'dark' : 'light'))}
        onVolver={() => setSeleccionado(null)}
        onEliminado={(c) => {
          setCursos((actuales) => actuales.filter((x) => x.id !== c.id))
          setSeleccionado(null)
        }}
      />
    )
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
          {/* US12: quien no crea cursos llega a ellos con el código que le
              compartió su profesor. */}
          {!esDocente && (
            <button
              onClick={() => setBuscarCodigoAbierto(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl accent-bg text-white text-sm font-medium shadow hover:brightness-110 transition"
            >
              <KeyRound size={15} />
              Unirme con código
            </button>
          )}
          {puedeCrear && (
            <button
              onClick={() => setModalAbierto(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl accent-bg text-white text-sm font-medium shadow hover:brightness-110 transition"
            >
              <Plus size={15} />
              Nuevo curso
            </button>
          )}
        </div>

        {tieneMisCursos && (
          <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: 'var(--bg2)' }} role="tablist">
            {([['mis', 'Mis cursos'], ['todos', 'Todos los cursos']] as const).map(([id, etiqueta]) => (
              <button
                key={id}
                role="tab"
                aria-selected={vista === id}
                onClick={() => setVista(id)}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition"
                style={{ background: vista === id ? 'var(--bg1)' : 'transparent', color: vista === id ? 'var(--ink)' : 'var(--ink-soft)' }}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        )}

        {inscritoAviso && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
            style={{ background: 'rgba(22,163,74,.1)', border: '1px solid rgba(22,163,74,.4)' }}
          >
            <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
            <span className="flex-1">Te inscribiste en «{inscritoAviso.nombre}».</span>
            <button onClick={() => setInscritoAviso(null)} className="grid place-items-center w-6 h-6 rounded hover:bg-black/5" title="Cerrar aviso">
              <X size={14} />
            </button>
          </div>
        )}

        {recienCreado && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
            style={{ background: 'rgba(22,163,74,.1)', border: '1px solid rgba(22,163,74,.4)' }}
          >
            <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
            <span className="flex-1">
              Curso «{recienCreado.nombre}» creado.
              {recienCreado.codigoAcceso && (
                <> Código de acceso para tus estudiantes: <strong className="font-mono tracking-widest">{recienCreado.codigoAcceso}</strong></>
              )}
            </span>
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
        ) : visibles.length === 0 ? (
          <div className="panel rounded-2xl p-10 text-center space-y-2">
            <GraduationCap size={28} className="mx-auto" style={{ color: 'var(--accent)' }} />
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              {busqueda.trim()
                ? `Ningún curso coincide con «${busqueda.trim()}».`
                : vista === 'mis'
                  ? (puedeCrear
                    ? 'Todavía no has creado ningún curso. Crea el primero con «Nuevo curso».'
                    : 'Todavía no estás inscrito en ningún curso. Pídele el código a tu profesor y usa «Unirme con código», o explora «Todos los cursos».')
                : puedeCrear
                  ? 'Todavía no hay cursos. Crea el primero con «Nuevo curso».'
                  : 'Todavía no hay cursos.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibles.map((c, indice) => (
                <TarjetaCurso
                  key={c.id}
                  curso={c}
                  indice={indice}
                  onAbrir={() => setSeleccionado(c)}
                  puedeEliminar={puedeEliminar(c)}
                  onEliminar={() => eliminar(c)}
                />
              ))}
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
      {buscarCodigoAbierto && <ModalBuscarPorCodigo onCerrar={() => setBuscarCodigoAbierto(false)} onInscrito={alInscribirse} />}
    </TemaProvider>
  )
}

function TarjetaCurso({ curso, indice, onAbrir, puedeEliminar, onEliminar }: {
  curso: Curso
  indice: number
  onAbrir: () => void
  puedeEliminar: boolean
  onEliminar: () => void
}) {
  return (
    <div
      className="panel rounded-2xl p-5 flex flex-col justify-start gap-2 text-left hover:-translate-y-0.5 transition relative group anim-fade-in"
      style={{ animationDelay: `${Math.min(indice, 8) * 0.05}s` }}
    >
      {puedeEliminar && (
        <button
          onClick={(e) => { e.stopPropagation(); onEliminar() }}
          className="absolute top-3 right-3 grid place-items-center w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-black/5"
          style={{ color: '#dc2626' }}
          title="Eliminar curso"
        >
          <Trash2 size={14} />
        </button>
      )}
      <button onClick={onAbrir} className="flex flex-col gap-2 text-left">
        <div className="flex items-start gap-2 pr-7">
          <h2 className="font-semibold flex-1 break-words">{curso.nombre}</h2>
          {curso.codigo && <EtiquetaCodigo codigo={curso.codigo} />}
        </div>
        {curso.inscrito && <EtiquetaInscrito />}
        {curso.descripcion && (
          <p className="text-sm line-clamp-3 whitespace-pre-line" style={{ color: 'var(--ink-soft)' }}>{curso.descripcion}</p>
        )}
        <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
          Creado por {curso.creadoPorNombre} · {fechaLegible(curso.fechaCreacion)}
        </p>
      </button>
    </div>
  )
}

// US12 (#15): el estudiante escribe el código y ve el curso — o un aviso
// claro si no existe.
function ModalBuscarPorCodigo({ onCerrar, onInscrito }: { onCerrar: () => void; onInscrito: (c: Curso) => void }) {
  const [codigo, setCodigo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [encontrado, setEncontrado] = useState<Curso | null>(null)
  const [inscribiendo, setInscribiendo] = useState(false)

  // US13 (#16): con el curso a la vista, el estudiante confirma la inscripción.
  async function inscribirse() {
    if (!encontrado) return
    setError(null)
    setInscribiendo(true)
    try {
      onInscrito(await inscribirseCurso(encontrado.codigoAcceso ?? codigo))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la inscripción.')
    } finally {
      setInscribiendo(false)
    }
  }

  async function buscar() {
    setError(null)
    setEncontrado(null)
    if (!codigo.trim()) {
      setError('Escribe el código que te compartió tu profesor.')
      return
    }
    setBuscando(true)
    try {
      setEncontrado(await buscarCursoPorCodigo(codigo))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar el curso.')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center p-4" style={{ background: 'rgba(0,0,0,.5)' }} onClick={onCerrar}>
      <div
        role="dialog"
        aria-label="Unirme con código"
        onClick={(e) => e.stopPropagation()}
        className="panel rounded-2xl anim-slide-up p-6 w-full max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Unirme a un curso</p>
          <button type="button" onClick={onCerrar} className="grid place-items-center w-7 h-7 rounded-lg hover:bg-black/5" title="Cerrar">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); buscar() }} className="flex gap-2">
          <input
            autoFocus
            value={codigo}
            onChange={(e) => { setCodigo(e.target.value); setError(null) }}
            maxLength={20}
            placeholder="Código del curso (ej. K7P2QX)"
            aria-label="Código del curso"
            className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm outline-none font-mono uppercase placeholder:normal-case placeholder:font-sans"
            style={estiloCampo}
          />
          <button
            type="submit"
            disabled={buscando}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl accent-bg text-white text-sm font-medium shadow hover:brightness-110 disabled:opacity-50 transition"
          >
            {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Buscar
          </button>
        </form>

        {error && <p role="alert" className="text-sm" style={{ color: '#dc2626' }}>{error}</p>}

        {encontrado && (
          <div className="rounded-xl p-4 space-y-1" style={{ background: 'var(--bg1)', border: '1px solid var(--border)' }} data-testid="curso-encontrado">
            <div className="flex items-start gap-2">
              <h3 className="font-semibold flex-1 break-words">{encontrado.nombre}</h3>
              {encontrado.codigo && <EtiquetaCodigo codigo={encontrado.codigo} />}
            </div>
            {encontrado.descripcion && (
              <p className="text-sm line-clamp-3 whitespace-pre-line" style={{ color: 'var(--ink-soft)' }}>{encontrado.descripcion}</p>
            )}
            <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>Profesor: {encontrado.creadoPorNombre}</p>
            <div className="pt-2">
              {encontrado.inscrito ? (
                <EtiquetaInscrito />
              ) : (
                <button
                  onClick={inscribirse}
                  disabled={inscribiendo}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl accent-bg text-white text-sm font-medium shadow hover:brightness-110 disabled:opacity-50 transition"
                >
                  {inscribiendo && <Loader2 size={14} className="animate-spin" />}
                  {inscribiendo ? 'Inscribiendo…' : 'Inscribirme'}
                </button>
              )}
            </div>
          </div>
        )}
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
        className="panel rounded-2xl anim-slide-up p-6 w-full max-w-md space-y-3"
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
