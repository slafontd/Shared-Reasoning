import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, Sun, Moon, Upload, Download, Trash2, X, FileText,
  BookOpen, Sparkles, Send, Loader2, File as FileIcon,
} from 'lucide-react'
import TemaProvider, { type Tema } from './theme'
import { LogoWordmark } from './Logo'
import type { Usuario } from '../api/auth'
import {
  listarMateriales, subirMaterial, descargarMaterial, eliminarMaterial,
  obtenerTutorial, preguntarTutorial,
  type Material, type Categoria, type Dificultad, type Tutorial,
} from '../api/materiales'

type Props = {
  usuario: Usuario | null
  onVolver: () => void
}

const CATEGORIAS: { id: Categoria | 'todos'; etiqueta: string }[] = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'libro', etiqueta: 'Libros' },
  { id: 'pdf', etiqueta: 'PDFs' },
  { id: 'guia', etiqueta: 'Guías' },
  { id: 'datasheet', etiqueta: 'Datasheets' },
]

const DIFICULTADES: { id: Dificultad; etiqueta: string }[] = [
  { id: 'basico', etiqueta: 'Básico' },
  { id: 'intermedio', etiqueta: 'Intermedio' },
  { id: 'experto', etiqueta: 'Experto' },
  { id: 'referencia', etiqueta: 'Referencia' },
]

function Biblioteca({ usuario, onVolver }: Props) {
  const [tema, setTema] = useState<Tema>('light')
  const [tab, setTab] = useState<'materiales' | 'tutoriales'>('materiales')

  return (
    <TemaProvider tema={tema} className="min-h-screen" style={{ color: 'var(--ink)', background: 'linear-gradient(135deg,var(--bg1),var(--bg2))' }}>
      <header className="flex items-center gap-3 px-6 h-16 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={onVolver} className="grid place-items-center w-9 h-9 rounded-lg hover:bg-black/5 transition" title="Volver">
          <ArrowLeft size={18} />
        </button>
        <LogoWordmark height={28} />
        <span className="text-sm font-semibold ml-1">Biblioteca</span>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg2)' }}>
            {(['materiales', 'tutoriales'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition"
                style={{ background: tab === t ? 'var(--bg1)' : 'transparent', color: tab === t ? 'var(--ink)' : 'var(--ink-soft)' }}
              >
                {t === 'materiales' ? <BookOpen size={13} /> : <Sparkles size={13} />}
                {t === 'materiales' ? 'Materiales' : 'Tutoriales IA'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setTema((t) => (t === 'light' ? 'dark' : 'light'))}
            className="grid place-items-center w-9 h-9 rounded-full panel hover:-translate-y-0.5 transition"
            title={tema === 'light' ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
          >
            {tema === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {tab === 'materiales' ? <PestanaMateriales usuario={usuario} /> : <PestanaTutoriales />}
      </main>
    </TemaProvider>
  )
}

// ============================================================
//  Materiales: subir/listar/descargar/borrar PDFs y guías
// ============================================================
function PestanaMateriales({ usuario }: { usuario: Usuario | null }) {
  const [materiales, setMateriales] = useState<Material[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoria, setCategoria] = useState<Categoria | 'todos'>('todos')
  const [dificultad, setDificultad] = useState<Dificultad | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [modalSubidaAbierto, setModalSubidaAbierto] = useState(false)

  function cargar() {
    setCargando(true)
    setError(null)
    listarMateriales({
      categoria: categoria === 'todos' ? undefined : categoria,
      dificultad: dificultad ?? undefined,
    })
      .then(setMateriales)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error desconocido'))
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [categoria, dificultad])

  const visibles = materiales.filter((m) => m.titulo.toLowerCase().includes(busqueda.trim().toLowerCase()))

  async function borrar(m: Material) {
    if (!confirm(`¿Eliminar "${m.titulo}"? Esta acción no se puede deshacer.`)) return
    try {
      await eliminarMaterial(m.id)
      setMateriales((actuales) => actuales.filter((x) => x.id !== m.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por título…"
          className="rounded-xl px-3 py-2 text-sm outline-none flex-1 min-w-48"
          style={{ background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        />
        <button
          onClick={() => setModalSubidaAbierto(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl accent-bg text-white text-sm font-medium shadow hover:brightness-110 transition"
        >
          <Upload size={15} />
          Subir material
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIAS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoria(c.id)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition"
            style={{
              background: categoria === c.id ? 'var(--accent)' : 'var(--bg2)',
              color: categoria === c.id ? 'var(--bg2)' : 'var(--ink-soft)',
            }}
          >
            {c.etiqueta}
          </button>
        ))}
        <span className="w-px mx-1" style={{ background: 'var(--border)' }} />
        {DIFICULTADES.map((d) => (
          <button
            key={d.id}
            onClick={() => setDificultad((actual) => (actual === d.id ? null : d.id))}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition"
            style={{
              background: dificultad === d.id ? 'var(--accent)' : 'var(--bg2)',
              color: dificultad === d.id ? 'var(--bg2)' : 'var(--ink-soft)',
            }}
          >
            {d.etiqueta}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl px-3 py-2 text-sm" style={{ background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.4)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-center py-16" style={{ color: 'var(--ink-soft)' }}>Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-center py-16" style={{ color: 'var(--ink-soft)' }}>
          {materiales.length === 0 ? 'Todavía no hay materiales en la biblioteca.' : 'Sin resultados para este filtro.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {visibles.map((m) => (
            <MaterialCard
              key={m.id}
              material={m}
              puedeBorrar={!!usuario && usuario.usuarioId === m.subidoPor}
              onDescargar={() => descargarMaterial(m).catch((e) => setError(e instanceof Error ? e.message : 'Error al descargar.'))}
              onBorrar={() => borrar(m)}
            />
          ))}
        </div>
      )}

      {modalSubidaAbierto && (
        <ModalSubirMaterial
          onCerrar={() => setModalSubidaAbierto(false)}
          onSubido={(m) => { setMateriales((actuales) => [m, ...actuales]); setModalSubidaAbierto(false) }}
        />
      )}
    </div>
  )
}

function MaterialCard({ material, puedeBorrar, onDescargar, onBorrar }: {
  material: Material
  puedeBorrar: boolean
  onDescargar: () => void
  onBorrar: () => void
}) {
  return (
    <div className="panel rounded-2xl overflow-hidden flex flex-col group">
      <div className="aspect-[3/4] grid place-items-center overflow-hidden" style={{ background: 'var(--bg2)' }}>
        {material.portadaUrl ? (
          <img src={material.portadaUrl} alt={material.titulo} className="w-full h-full object-cover" />
        ) : (
          <FileIcon size={32} style={{ color: 'var(--ink-soft)' }} />
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-medium leading-snug line-clamp-2" title={material.titulo}>{material.titulo}</p>
        <p className="text-xs capitalize" style={{ color: 'var(--ink-soft)' }}>{material.categoria} · {material.dificultad}</p>
        <div className="mt-auto pt-2 flex items-center gap-1">
          <button
            onClick={onDescargar}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition hover:brightness-95"
            style={{ background: 'var(--bg2)' }}
            title="Descargar"
          >
            <Download size={13} />
            Descargar
          </button>
          {puedeBorrar && (
            <button
              onClick={onBorrar}
              className="grid place-items-center w-7 h-7 rounded-lg transition hover:bg-black/5"
              style={{ color: '#dc2626' }}
              title="Eliminar"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ModalSubirMaterial({ onCerrar, onSubido }: { onCerrar: () => void; onSubido: (m: Material) => void }) {
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState<Categoria>('pdf')
  const [dificultad, setDificultad] = useState<Dificultad>('intermedio')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar() {
    if (!titulo.trim() || !archivo) return
    setSubiendo(true)
    setError(null)
    try {
      const material = await subirMaterial({ titulo: titulo.trim(), categoria, dificultad, archivo })
      onSubido(material)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el material.')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center p-4" style={{ background: 'rgba(0,0,0,.5)' }}>
      <div className="panel rounded-2xl p-6 w-full max-w-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Subir material</p>
          <button onClick={onCerrar} className="grid place-items-center w-7 h-7 rounded-lg hover:bg-black/5"><X size={16} /></button>
        </div>

        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título"
          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        />

        <div className="flex gap-2">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as Categoria)}
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--ink)' }}
          >
            {CATEGORIAS.filter((c) => c.id !== 'todos').map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
          </select>
          <select
            value={dificultad}
            onChange={(e) => setDificultad(e.target.value as Dificultad)}
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--ink)' }}
          >
            {DIFICULTADES.map((d) => <option key={d.id} value={d.id}>{d.etiqueta}</option>)}
          </select>
        </div>

        <label
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm cursor-pointer"
          style={{ background: 'var(--bg1)', border: '1px dashed var(--border)', color: archivo ? 'var(--ink)' : 'var(--ink-soft)' }}
        >
          <FileText size={15} />
          {archivo ? archivo.name : 'Elegir archivo (PDF u otro)'}
          <input type="file" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        </label>

        {error && <p className="text-xs" style={{ color: '#fca5a5' }}>{error}</p>}

        <button
          onClick={enviar}
          disabled={!titulo.trim() || !archivo || subiendo}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl accent-bg text-white text-sm font-medium shadow hover:brightness-110 disabled:opacity-40 transition"
        >
          {subiendo && <Loader2 size={14} className="animate-spin" />}
          {subiendo ? 'Subiendo…' : 'Subir'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
//  Tutoriales IA: explicación de un componente + chat de seguimiento
// ============================================================
type MensajeTutorial = { de: 'ai' | 'tu'; texto: string }

function PestanaTutoriales() {
  const [componente, setComponente] = useState('')
  const [componenteActivo, setComponenteActivo] = useState<string | null>(null)
  const [tutorial, setTutorial] = useState<Tutorial | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<MensajeTutorial[]>([])
  const [pregunta, setPregunta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const finRef = useRef<HTMLDivElement>(null)

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes])

  async function generar() {
    if (!componente.trim()) return
    setCargando(true)
    setError(null)
    setTutorial(null)
    setMensajes([])
    try {
      const t = await obtenerTutorial(componente.trim())
      setTutorial(t)
      setComponenteActivo(componente.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el tutorial.')
    } finally {
      setCargando(false)
    }
  }

  async function enviarPregunta() {
    const texto = pregunta.trim()
    if (!texto || !componenteActivo) return
    const historialParaApi = mensajes.map((m) => ({ role: (m.de === 'tu' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.texto }))
    setMensajes((m) => [...m, { de: 'tu', texto }])
    setPregunta('')
    setEnviando(true)
    try {
      const respuesta = await preguntarTutorial(componenteActivo, texto, historialParaApi)
      setMensajes((m) => [...m, { de: 'ai', texto: respuesta }])
    } catch (e) {
      setMensajes((m) => [...m, { de: 'ai', texto: e instanceof Error ? e.message : 'No se pudo responder.' }])
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex gap-2">
        <input
          value={componente}
          onChange={(e) => setComponente(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && generar()}
          placeholder="Nombre del componente (ej. resistencia, LED, transistor NPN)…"
          className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        />
        <button
          onClick={generar}
          disabled={!componente.trim() || cargando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl accent-bg text-white text-sm font-medium shadow hover:brightness-110 disabled:opacity-40 transition"
        >
          {cargando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Explicar
        </button>
      </div>

      {error && (
        <div className="rounded-xl px-3 py-2 text-sm" style={{ background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.4)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {tutorial && componenteActivo && (
        <div className="panel rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold capitalize">{componenteActivo}</p>
          <p className="text-sm">{tutorial.resumen}</p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--ink-soft)' }}>Cómo funciona</p>
            <p className="text-sm">{tutorial.comoFunciona}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--ink-soft)' }}>Usos comunes</p>
            <ul className="text-sm list-disc list-inside space-y-0.5">
              {tutorial.usosComunes.map((u, i) => <li key={i}>{u}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--ink-soft)' }}>Consejos de conexión</p>
            <p className="text-sm">{tutorial.consejosConexion}</p>
          </div>

          {/* Chat de seguimiento */}
          <div className="pt-2 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
            {mensajes.map((m, i) => (
              <div key={i} className="text-sm rounded-xl px-3 py-2 max-w-[85%]" style={{
                background: m.de === 'tu' ? 'var(--accent)' : 'var(--bg2)',
                color: m.de === 'tu' ? 'var(--bg2)' : 'var(--ink)',
                marginLeft: m.de === 'tu' ? 'auto' : 0,
              }}>
                {m.texto}
              </div>
            ))}
            <div ref={finRef} />
            <div className="flex gap-2 pt-1">
              <input
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarPregunta()}
                placeholder="¿Alguna duda de seguimiento?"
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              />
              <button
                onClick={enviarPregunta}
                disabled={!pregunta.trim() || enviando}
                className="grid place-items-center w-9 h-9 rounded-xl accent-bg text-white disabled:opacity-40 transition"
              >
                {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Biblioteca
