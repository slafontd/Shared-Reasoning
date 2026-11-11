import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, ChevronDown, FileUp, Loader2, Send, Trash2, X } from 'lucide-react'
import {
  cargarProgresoEjercicio, entregarSolucion, guardarFeedbackSolucion, guardarProgresoEjercicio, retirarSolucion, listarSoluciones, cargarArchivoSolucion, descargarArchivoSolucion,
  MAX_ARCHIVOS_POR_SOLUCION, MAX_BYTES_ARCHIVO_SOLUCION, MAX_TEXTO_SOLUCION, TIPOS_SOLUCION,
  type Ejercicio, type ProgresoEjercicio, type Solucion,
} from '../api/ejercicios'
import { MiniaturaArchivo, validarArchivos, tamanoLegible } from './ArchivosAutenticados'

const estiloCampo = { background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--ink)' }
const LIMITES = { tipos: TIPOS_SOLUCION, maxBytes: MAX_BYTES_ARCHIVO_SOLUCION, maxCantidad: MAX_ARCHIVOS_POR_SOLUCION }

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function mensajeDeFalla(error: unknown) {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return 'No se pudo conectar con el servidor. Verifica que el backend esté encendido e inténtalo de nuevo.'
  }
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
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
  const [cargandoProgreso, setCargandoProgreso] = useState(!entregada)
  const [progresoListo, setProgresoListo] = useState(false)
  const [estadoProgreso, setEstadoProgreso] = useState<'cargando' | 'listo' | 'pendiente' | 'guardando' | 'guardado' | 'error'>('cargando')
  const [reintentosCarga, setReintentosCarga] = useState(0)
  const [archivos, setArchivos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const progresoActual = useRef<Pick<ProgresoEjercicio, 'respuestas' | 'preguntasCompletadas' | 'puntoActual'>>({
    respuestas: {},
    preguntasCompletadas: [],
    puntoActual: 0,
  })
  const ultimoGuardado = useRef<string | null>(null)
  const ultimoEncolado = useRef<string | null>(null)
  const colaGuardados = useRef<Promise<void>>(Promise.resolve())
  const encolarRef = useRef<(progreso: Pick<ProgresoEjercicio, 'respuestas' | 'preguntasCompletadas' | 'puntoActual'>) => void>(() => {})
  const progresoListoRef = useRef(progresoListo)
  const formularioActivoRef = useRef(!entregada || editando)
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mostrarFormulario = !entregada || editando

  useEffect(() => {
    progresoListoRef.current = progresoListo
    formularioActivoRef.current = mostrarFormulario
  }, [progresoListo, mostrarFormulario])

  useEffect(() => {
    let cancelado = false
    if (entregada) {
      return () => { cancelado = true }
    }

    cargarProgresoEjercicio(ejercicio.id)
      .then((progreso) => {
        if (cancelado) return
        const respuestas = progreso?.respuestas ?? {}
        const inicial: Pick<ProgresoEjercicio, 'respuestas' | 'preguntasCompletadas' | 'puntoActual'> = {
          respuestas,
          preguntasCompletadas: progreso?.preguntasCompletadas ?? [],
          puntoActual: progreso?.puntoActual ?? 0,
        }
        progresoActual.current = inicial
        const serializado = JSON.stringify(inicial)
        ultimoGuardado.current = serializado
        ultimoEncolado.current = serializado
        setTexto(typeof respuestas.respuesta === 'string' ? respuestas.respuesta : '')
        setProgresoListo(true)
        setError(null)
        setEstadoProgreso(progreso ? 'guardado' : 'listo')
      })
      .catch((e) => {
        if (cancelado) return
        const inicial: Pick<ProgresoEjercicio, 'respuestas' | 'preguntasCompletadas' | 'puntoActual'> = {
          respuestas: {},
          preguntasCompletadas: [],
          puntoActual: 0,
        }
        progresoActual.current = inicial
        const serializado = JSON.stringify(inicial)
        ultimoGuardado.current = serializado
        ultimoEncolado.current = serializado
        setTexto('')
        setProgresoListo(true)
        setError(`No se pudo recuperar el borrador. El formulario sigue disponible. ${mensajeDeFalla(e)}`)
        setEstadoProgreso('error')
      })
      .finally(() => {
        if (!cancelado) setCargandoProgreso(false)
      })
    return () => { cancelado = true }
  }, [ejercicio.id, entregada, reintentosCarga])

  const encolarGuardado = useCallback((progreso: Pick<ProgresoEjercicio, 'respuestas' | 'preguntasCompletadas' | 'puntoActual'>) => {
    const serializado = JSON.stringify(progreso)
    if (serializado === ultimoEncolado.current) return
    ultimoEncolado.current = serializado
    const pendiente = colaGuardados.current.catch(() => {}).then(async () => {
      await guardarProgresoEjercicio(ejercicio.id, progreso)
      ultimoGuardado.current = serializado
      if (ultimoEncolado.current === serializado && progresoListoRef.current && formularioActivoRef.current) {
        setEstadoProgreso('guardado')
        setError(null)
      }
    })
    colaGuardados.current = pendiente
    pendiente.catch((e: unknown) => {
      if (ultimoEncolado.current === serializado) {
        ultimoEncolado.current = ultimoGuardado.current
      }
      if (ultimoEncolado.current === ultimoGuardado.current && progresoListoRef.current && formularioActivoRef.current) {
        setEstadoProgreso('error')
        setError(`No se pudo guardar el progreso. ${mensajeDeFalla(e)}`)
      }
    })
  }, [ejercicio.id])

  useEffect(() => {
    encolarRef.current = encolarGuardado
  }, [encolarGuardado])

  useEffect(() => {
    if (!mostrarFormulario || !progresoListo || cargandoProgreso) return
    const snapshot = progresoActual.current
    if (JSON.stringify(snapshot) === ultimoEncolado.current) return
    setEstadoProgreso('pendiente')
    temporizadorRef.current = setTimeout(() => {
      setEstadoProgreso('guardando')
      encolarGuardado(snapshot)
    }, 650)
    return () => {
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current)
    }
  }, [texto, mostrarFormulario, progresoListo, cargandoProgreso, encolarGuardado])

  useEffect(() => () => {
    if (temporizadorRef.current) clearTimeout(temporizadorRef.current)
    const debeGuardar = progresoListoRef.current && formularioActivoRef.current
    formularioActivoRef.current = false
    if (debeGuardar) {
      encolarRef.current(progresoActual.current)
    }
  }, [])

  function cambiarTextoBorrador(valor: string) {
    setTexto(valor)
    progresoActual.current = {
      ...progresoActual.current,
      respuestas: { ...progresoActual.current.respuestas, respuesta: valor },
    }
    setError(null)
  }

  function abrirParaReemplazar() {
    setTexto(entregada?.texto ?? '')
    progresoActual.current = {
      ...progresoActual.current,
      respuestas: { ...progresoActual.current.respuestas, respuesta: entregada?.texto ?? '' },
    }
    const serializado = JSON.stringify(progresoActual.current)
    ultimoGuardado.current = serializado
    ultimoEncolado.current = serializado
    setArchivos([])
    setProgresoListo(true)
    setCargandoProgreso(false)
    setEstadoProgreso('listo')
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
    if (!progresoListo) {
      setError('Recupera tu progreso antes de entregar la solución.')
      return
    }
    setError(null)
    setEnviando(true)
    if (temporizadorRef.current) clearTimeout(temporizadorRef.current)
    try {
      const solucion = await entregarSolucion(ejercicio.id, { texto, archivos })
      onCambio(solucion)
      setEditando(false)
      setTexto('')
      progresoActual.current = { respuestas: {}, preguntasCompletadas: [], puntoActual: 0 }
      ultimoGuardado.current = null
      ultimoEncolado.current = null
      setArchivos([])
    } catch (e) {
      setError(`No se pudo entregar la solución. ${mensajeDeFalla(e)}`)
    } finally {
      setEnviando(false)
    }
  }

  async function retirar() {
    if (!confirm('¿Retirar tu solución? Tendrás que enviarla de nuevo si quieres entregarla.')) return
    setError(null)
    try {
      await retirarSolucion(ejercicio.id)
      setProgresoListo(false)
      setCargandoProgreso(true)
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
          <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold">Feedback del profesor</p>
            {entregada.feedback ? (
              <>
                <p className="text-sm whitespace-pre-line break-words mt-1">{entregada.feedback}</p>
                {entregada.feedbackActualizadoEn && (
                  <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>
                    Actualizado el {fechaHora(entregada.feedbackActualizadoEn)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
                Tu profesor aún no ha enviado comentarios.
              </p>
            )}
          </div>
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
            onChange={(ev) => cambiarTextoBorrador(ev.target.value)}
            onBlur={() => {
              if (progresoListo && mostrarFormulario && estadoProgreso !== 'error') {
                setEstadoProgreso('guardando')
                encolarGuardado(progresoActual.current)
              }
            }}
            maxLength={MAX_TEXTO_SOLUCION}
            rows={3}
            placeholder="Tu respuesta o procedimiento (opcional si adjuntas un archivo)"
            disabled={cargandoProgreso}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-y"
            style={estiloCampo}
          />
          {estadoProgreso === 'cargando' && cargandoProgreso && (
            <p role="status" className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-soft)' }}>
              <Loader2 size={12} className="animate-spin" /> Recuperando tu progreso…
            </p>
          )}
          {estadoProgreso === 'pendiente' && <p role="status" className="text-xs" style={{ color: 'var(--ink-soft)' }}>Cambios pendientes de guardar…</p>}
          {estadoProgreso === 'guardando' && <p role="status" className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-soft)' }}><Loader2 size={12} className="animate-spin" /> Guardando progreso…</p>}
          {estadoProgreso === 'guardado' && progresoListo && (
            <p role="status" className="flex items-center gap-1.5 text-xs" style={{ color: '#15803d' }}>
              <CheckCircle2 size={12} /> Progreso guardado automáticamente
            </p>
          )}
          {estadoProgreso === 'listo' && progresoListo && (
            <p role="status" className="text-xs" style={{ color: 'var(--ink-soft)' }}>Tu respuesta se guardará automáticamente.</p>
          )}
          {!progresoListo && !entregada && !cargandoProgreso && (
            <button
              type="button"
              onClick={() => {
                setError(null)
                setCargandoProgreso(true)
                setEstadoProgreso('cargando')
                setReintentosCarga((n) => n + 1)
              }}
              className="text-xs underline"
              style={{ color: 'var(--accent)' }}
            >
              Reintentar cargar el progreso
            </button>
          )}
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
              disabled={enviando || cargandoProgreso}
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
              <SolucionRecibida
                key={s.id}
                ejercicio={ejercicio}
                solucion={s}
                onVisor={onVisor}
                onActualizar={(actualizada) => setSoluciones((actuales) =>
                  actuales?.map((solucion) => solucion.id === actualizada.id ? actualizada : solucion) ?? null,
                )}
                animationDelay={`${Math.min(i, 6) * 0.05}s`}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function SolucionRecibida({ ejercicio, solucion, onVisor, onActualizar, animationDelay }: {
  ejercicio: Ejercicio
  solucion: Solucion
  onVisor: (url: string, nombre: string) => void
  onActualizar: (solucion: Solucion) => void
  animationDelay: string
}) {
  const [editando, setEditando] = useState(false)
  const [comentario, setComentario] = useState(solucion.feedback ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (!comentario.trim()) {
      setError('Escribe un comentario antes de guardar.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const actualizada = await guardarFeedbackSolucion(ejercicio.id, solucion.id, comentario)
      onActualizar(actualizada)
      setComentario(actualizada.feedback ?? '')
      setEditando(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el feedback.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rounded-lg p-3 anim-fade-in" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', animationDelay }}>
      <p className="text-xs font-semibold">
        {solucion.estudianteNombre} <span className="font-normal" style={{ color: 'var(--ink-soft)' }}>· {fechaHora(solucion.fechaEntrega)}</span>
      </p>
      {solucion.texto && <p className="text-sm whitespace-pre-line break-words mt-1">{solucion.texto}</p>}
      <ArchivosDeSolucion solucion={solucion} onVisor={onVisor} />
      <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px dashed var(--border)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs" style={{ color: solucion.feedback ? '#15803d' : 'var(--ink-soft)' }}>
            {solucion.feedback ? 'Feedback enviado' : 'Pendiente de feedback'}
            {solucion.feedbackActualizadoEn ? ` · ${fechaHora(solucion.feedbackActualizadoEn)}` : ''}
          </p>
          {!editando && (
            <button
              type="button"
              onClick={() => {
                setComentario(solucion.feedback ?? '')
                setError(null)
                setEditando(true)
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium accent-bg text-white hover:brightness-110 transition"
            >
              {solucion.feedback ? 'Editar feedback' : 'Enviar feedback'}
            </button>
          )}
        </div>
        {solucion.feedback && !editando && (
          <p className="text-sm whitespace-pre-line break-words">{solucion.feedback}</p>
        )}
        {editando && (
          <form onSubmit={guardar} className="space-y-2">
            <textarea
              value={comentario}
              onChange={(ev) => setComentario(ev.target.value)}
              maxLength={5000}
              rows={3}
              autoFocus
              aria-label={`Feedback para ${solucion.estudianteNombre}`}
              placeholder="Escribe observaciones para ayudar al estudiante a mejorar…"
              className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-y"
              style={estiloCampo}
            />
            {error && <p role="alert" className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={guardando || !comentario.trim()}
                className="rounded-lg px-3 py-1.5 text-xs font-medium accent-bg text-white disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : 'Guardar feedback'}
              </button>
              <button
                type="button"
                onClick={() => { setEditando(false); setError(null) }}
                disabled={guardando}
                className="rounded-lg px-3 py-1.5 text-xs hover:bg-black/5"
                style={{ border: '1px solid var(--border)' }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
