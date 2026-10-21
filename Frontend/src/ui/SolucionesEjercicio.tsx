import { useState } from 'react'
import { CheckCircle2, ChevronDown, FileUp, Loader2, Send, Trash2, X } from 'lucide-react'
import {
  entregarSolucion, retirarSolucion, listarSoluciones, cargarArchivoSolucion, descargarArchivoSolucion,
  MAX_ARCHIVOS_POR_SOLUCION, MAX_BYTES_ARCHIVO_SOLUCION, MAX_TEXTO_SOLUCION, TIPOS_SOLUCION,
  type Ejercicio, type Solucion,
} from '../api/ejercicios'
import { MiniaturaArchivo, validarArchivos, tamanoLegible } from './ArchivosAutenticados'

const estiloCampo = { background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--ink)' }
const LIMITES = { tipos: TIPOS_SOLUCION, maxBytes: MAX_BYTES_ARCHIVO_SOLUCION, maxCantidad: MAX_ARCHIVOS_POR_SOLUCION }

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function ArchivosDeSolucion({ solucion, onVisor }: { solucion: Solucion; onVisor: (url: string, nombre: string) => void }) {
  if (solucion.archivos.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {solucion.archivos.map((a) => (
        <MiniaturaArchivo
          key={a.id}
          id={a.id}
          nombre={a.nombre}
          mime={a.mime}
          cargar={cargarArchivoSolucion}
          onAbrir={onVisor}
          onDescargar={() => descargarArchivoSolucion(a)}
        />
      ))}
    </div>
  )
}

// ============================================================
//  Lo que ve el ESTUDIANTE: entregar, ver, reemplazar o retirar su solución.
// ============================================================
export function SolucionEstudiante({ ejercicio, onCambio, onVisor }: {
  ejercicio: Ejercicio
  onCambio: (solucion: Solucion | null) => void
  onVisor: (url: string, nombre: string) => void
}) {
  const entregada = ejercicio.miSolucion
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mostrarFormulario = !entregada || editando

  function abrirParaReemplazar() {
    setTexto(entregada?.texto ?? '')
    setArchivos([])
    setError(null)
    setEditando(true)
  }

  function elegir(lista: FileList | null) {
    if (!lista) return
    const { validos, error: err } = validarArchivos(Array.from(lista), archivos.length, LIMITES)
    setArchivos((actuales) => [...actuales, ...validos])
    setError(err)
  }

  async function enviar() {
    if (!texto.trim() && archivos.length === 0) {
      setError('Escribe una respuesta o adjunta al menos un archivo.')
      return
    }
    setError(null)
    setEnviando(true)
    try {
      const solucion = await entregarSolucion(ejercicio.id, { texto, archivos })
      onCambio(solucion)
      setEditando(false)
      setTexto('')
      setArchivos([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entregar la solución.')
    } finally {
      setEnviando(false)
    }
  }

  async function retirar() {
    if (!confirm('¿Retirar tu solución? Tendrás que enviarla de nuevo si quieres entregarla.')) return
    setError(null)
    try {
      await retirarSolucion(ejercicio.id)
      onCambio(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo retirar la solución.')
    }
  }

  return (
    <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px dashed var(--border)' }}>
      {entregada && !editando && (
        <div className="rounded-lg p-3 anim-slide-up" style={{ background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.3)' }}>
          <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#15803d' }}>
            <CheckCircle2 size={14} /> Tu solución · enviada el {fechaHora(entregada.fechaEntrega)}
          </p>
          {entregada.texto && <p className="text-sm whitespace-pre-line break-words mt-1.5">{entregada.texto}</p>}
          <ArchivosDeSolucion solucion={entregada} onVisor={onVisor} />
          <div className="flex gap-2 mt-2.5">
            <button onClick={abrirParaReemplazar} className="px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-black/5 transition" style={{ border: '1px solid var(--border)' }}>
              Reemplazar
            </button>
            <button onClick={retirar} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs hover:bg-black/5 transition" style={{ color: '#dc2626' }}>
              <Trash2 size={12} /> Retirar
            </button>
          </div>
        </div>
      )}

      {mostrarFormulario && (
        <form onSubmit={(ev) => { ev.preventDefault(); enviar() }} className="space-y-2 anim-slide-up" aria-label="Entregar solución">
          <p className="text-xs font-semibold">{entregada ? 'Reemplazar tu solución' : 'Sube tu solución'}</p>
          <textarea
            value={texto}
            onChange={(ev) => setTexto(ev.target.value)}
            maxLength={MAX_TEXTO_SOLUCION}
            rows={3}
            placeholder="Tu respuesta o procedimiento (opcional si adjuntas un archivo)"
            className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-y"
            style={estiloCampo}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer hover:brightness-95 transition" style={{ border: '1px dashed var(--border)', color: 'var(--ink-soft)' }}>
              <FileUp size={13} />
              Adjuntar imágenes o PDF
              <input type="file" accept={TIPOS_SOLUCION} multiple className="hidden" disabled={archivos.length >= MAX_ARCHIVOS_POR_SOLUCION}
                onChange={(ev) => { elegir(ev.target.files); ev.target.value = '' }} />
            </label>
            {archivos.map((f, i) => (
              <span key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-md pl-2 pr-1 py-0.5 text-[11px] anim-bubble-in" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <span className="max-w-32 truncate" title={f.name}>{f.name}</span>
                <span style={{ color: 'var(--ink-soft)' }}>{tamanoLegible(f.size)}</span>
                <button type="button" onClick={() => setArchivos((a) => a.filter((_, k) => k !== i))} className="grid place-items-center w-4 h-4 rounded hover:bg-black/10" title="Quitar">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          {error && <p role="alert" className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}
          {entregada && editando && (
            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Al enviar, esta versión reemplaza por completo la que entregaste antes (texto y archivos).</p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={enviando}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg accent-bg text-white text-xs font-medium shadow hover:brightness-110 disabled:opacity-40 transition"
            >
              {enviando ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {enviando ? 'Enviando…' : entregada ? 'Enviar nueva versión' : 'Entregar solución'}
            </button>
            {entregada && editando && (
              <button type="button" onClick={() => { setEditando(false); setError(null) }} disabled={enviando} className="px-2.5 py-1.5 rounded-lg text-xs hover:bg-black/5 transition">
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
      {!mostrarFormulario && error && <p role="alert" className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}
    </div>
  )
}

// ============================================================
//  Lo que ve el PROFESOR: las soluciones que han entregado sus estudiantes.
// ============================================================
export function SolucionesRecibidas({ ejercicio, onVisor }: {
  ejercicio: Ejercicio
  onVisor: (url: string, nombre: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [soluciones, setSoluciones] = useState<Solucion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const total = ejercicio.totalSoluciones ?? 0

  async function alternar() {
    const siguiente = !abierto
    setAbierto(siguiente)
    // Se recarga cada vez que se abre: así se ven las entregas nuevas.
    if (siguiente) {
      setError(null)
      try {
        setSoluciones(await listarSoluciones(ejercicio.id))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar las soluciones.')
      }
    }
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--border)' }}>
      <button onClick={alternar} className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition" aria-expanded={abierto}>
        <ChevronDown size={14} className="transition-transform" style={{ transform: abierto ? 'none' : 'rotate(-90deg)' }} />
        Soluciones recibidas
        <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: total > 0 ? 'rgba(22,163,74,.12)' : 'var(--bg2)', color: total > 0 ? '#15803d' : 'var(--ink-soft)' }}>
          {total}
        </span>
      </button>

      {abierto && (
        <div className="mt-2 space-y-2">
          {error && <p role="alert" className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}
          {soluciones === null ? (
            !error && <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}><Loader2 size={12} className="animate-spin" /> Cargando…</p>
          ) : soluciones.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>Ningún estudiante ha entregado este ejercicio todavía.</p>
          ) : (
            soluciones.map((s, i) => (
              <div key={s.id} className="rounded-lg p-3 anim-fade-in" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', animationDelay: `${Math.min(i, 6) * 0.05}s` }}>
                <p className="text-xs font-semibold">
                  {s.estudianteNombre} <span className="font-normal" style={{ color: 'var(--ink-soft)' }}>· {fechaHora(s.fechaEntrega)}</span>
                </p>
                {s.texto && <p className="text-sm whitespace-pre-line break-words mt-1">{s.texto}</p>}
                <ArchivosDeSolucion solucion={s} onVisor={onVisor} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
