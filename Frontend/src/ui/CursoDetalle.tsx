import { useEffect, useState } from 'react'
import {
  ArrowLeft, Sun, Moon, Loader2, GraduationCap, Trash2, ClipboardList, ImagePlus, Plus, X, ChevronDown, Lock, Pencil, Check,
} from 'lucide-react'
import TemaProvider, { type Tema } from './theme'
import { LogoWordmark } from './Logo'
import type { Usuario } from '../api/auth'
import { eliminarCurso, type Curso } from '../api/cursos'
import {
  listarEjercicios, crearEjercicio, actualizarEjercicio, eliminarEjercicio, subirImagenEjercicio, eliminarImagenEjercicio, cargarImagenEjercicio,
  MAX_IMAGENES_POR_EJERCICIO, MAX_BYTES_IMAGEN, TIPOS_IMAGEN, type Ejercicio, type ImagenEjercicio, type Solucion,
} from '../api/ejercicios'
import { MiniaturaArchivo, VisorImagen, validarArchivos } from './ArchivosAutenticados'
import { SolucionEstudiante, SolucionesRecibidas } from './SolucionesEjercicio'
import { CodigoAcceso, EtiquetaCodigo, fechaLegible } from './cursosComun'

type Props = {
  curso: Curso
  usuario: Usuario | null
  tema: Tema
  onCambiarTema: () => void
  onVolver: () => void
  // El curso se eliminó desde esta pantalla: la lista debe sacarlo.
  onEliminado: (curso: Curso) => void
}

const estiloCampo = { background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--ink)' }
const LIMITES_IMAGEN = { tipos: TIPOS_IMAGEN, maxBytes: MAX_BYTES_IMAGEN, maxCantidad: MAX_IMAGENES_POR_EJERCICIO }

// ============================================================
//  Un curso: su información y sus ejercicios, organizados en el orden en
//  que los subió el profesor (el primero que publicó, primero).
// ============================================================
function CursoDetalle({ curso, usuario, tema, onCambiarTema, onVolver, onEliminado }: Props) {
  const esAdmin = usuario?.rol === 'administrador'
  // Solo el profesor que creó el curso crea ejercicios y les adjunta imágenes.
  const esProfesorDelCurso = usuario?.rol === 'profesor' && curso.creadoPor === usuario.usuarioId
  const gestiona = esProfesorDelCurso || esAdmin
  const esEstudiante = usuario?.rol === 'estudiante'
  const puedeVerEjercicios = gestiona || curso.inscrito

  const [ejercicios, setEjercicios] = useState<Ejercicio[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [abiertoId, setAbiertoId] = useState<string | null>(null)
  const [visor, setVisor] = useState<{ url: string; nombre: string } | null>(null)

  useEffect(() => {
    if (!puedeVerEjercicios) return
    let cancelado = false
    listarEjercicios(curso.id)
      .then((lista) => {
        if (cancelado) return
        setEjercicios(lista)
        // El estudiante abre de entrada el primer ejercicio pendiente.
        if (esEstudiante) setAbiertoId(lista.find((e) => !e.miSolucion)?.id ?? null)
      })
      .catch((e) => !cancelado && setError(e instanceof Error ? e.message : 'No se pudieron cargar los ejercicios.'))
    return () => { cancelado = true }
  }, [curso.id, puedeVerEjercicios, esEstudiante])

  function actualizar(id: string, cambios: Partial<Ejercicio>) {
    setEjercicios((actuales) => (actuales ?? []).map((e) => (e.id === id ? { ...e, ...cambios } : e)))
  }

  async function eliminarEsteCurso() {
    if (!confirm(`¿Eliminar el curso "${curso.nombre}"? Se borrarán también sus ejercicios y las soluciones recibidas. No se puede deshacer.`)) return
    setError(null)
    try {
      await eliminarCurso(curso.id)
      onEliminado(curso)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el curso.')
    }
  }

  const entregados = (ejercicios ?? []).filter((e) => e.miSolucion).length
  const total = ejercicios?.length ?? 0

  return (
    <TemaProvider tema={tema} className="min-h-screen" style={{ color: 'var(--ink)', background: 'linear-gradient(135deg,var(--bg1),var(--bg2))' }}>
      <header className="flex items-center gap-3 px-6 h-16 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={onVolver} className="grid place-items-center w-9 h-9 rounded-lg hover:bg-black/5 transition" title="Volver a los cursos">
          <ArrowLeft size={18} />
        </button>
        <LogoWordmark height={28} />
        <span className="text-sm font-semibold ml-1 truncate">{curso.nombre}</span>
        <button
          onClick={onCambiarTema}
          className="ml-auto grid place-items-center w-9 h-9 rounded-full panel hover:-translate-y-0.5 transition shrink-0"
          title={tema === 'light' ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
        >
          {tema === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </header>

      <main className="p-6 max-w-3xl mx-auto space-y-5">
        {/* Información del curso */}
        <section className="panel rounded-2xl p-6 space-y-4 anim-fade-in" aria-label="Información del curso">
          <div className="flex items-start gap-3">
            <div className="grid place-items-center w-11 h-11 rounded-xl shrink-0" style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}>
              <GraduationCap size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-xl break-words">{curso.nombre}</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                Profesor: {curso.creadoPorNombre} · creado el {fechaLegible(curso.fechaCreacion)}
              </p>
            </div>
            {curso.codigo && <EtiquetaCodigo codigo={curso.codigo} />}
          </div>
          <p className="text-sm whitespace-pre-line break-words" style={{ color: curso.descripcion ? 'var(--ink)' : 'var(--ink-soft)' }}>
            {curso.descripcion ?? 'Este curso no tiene descripción.'}
          </p>
          {curso.codigoAcceso && <CodigoAcceso codigo={curso.codigoAcceso} />}
          {gestiona && (
            <button
              onClick={eliminarEsteCurso}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:bg-black/5"
              style={{ color: '#dc2626', border: '1px solid rgba(220,38,38,.4)' }}
            >
              <Trash2 size={13} />
              Eliminar curso
            </button>
          )}
        </section>

        {/* Ejercicios */}
        <section className="space-y-3" aria-label="Ejercicios">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <ClipboardList size={17} style={{ color: 'var(--accent)' }} /> Ejercicios
              {ejercicios && <span className="text-xs font-normal" style={{ color: 'var(--ink-soft)' }}>({total})</span>}
            </h2>
            {esEstudiante && total > 0 && (
              <div className="flex items-center gap-2 ml-auto text-xs" style={{ color: 'var(--ink-soft)' }} aria-label={`${entregados} de ${total} ejercicios entregados`}>
                <span>{entregados} de {total} entregados</span>
                <div className="w-28 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full anim-progress" style={{ width: `${(entregados / total) * 100}%`, background: 'var(--accent)' }} />
                </div>
              </div>
            )}
          </div>

          {aviso && <p role="status" className="text-xs" style={{ color: '#15803d' }}>{aviso}</p>}
          {error && <p role="alert" className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}

          {!puedeVerEjercicios ? (
            <div className="panel rounded-2xl p-6 text-center space-y-1.5">
              <Lock size={22} className="mx-auto" style={{ color: 'var(--ink-soft)' }} />
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                Los ejercicios son solo para los estudiantes inscritos. Únete con el código de acceso que te comparta el profesor.
              </p>
            </div>
          ) : ejercicios === null ? (
            !error && <p className="text-sm flex items-center gap-2 py-6 justify-center" style={{ color: 'var(--ink-soft)' }}><Loader2 size={14} className="animate-spin" /> Cargando ejercicios…</p>
          ) : ejercicios.length === 0 ? (
            <div className="panel rounded-2xl p-6 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
              {esProfesorDelCurso
                ? 'Todavía no has publicado ejercicios. Crea el primero abajo.'
                : 'El profesor todavía no ha publicado ejercicios en este curso.'}
            </div>
          ) : (
            <ol className="space-y-2.5">
              {ejercicios.map((e, indice) => (
                <TarjetaEjercicio
                  key={e.id}
                  ejercicio={e}
                  numero={indice + 1}
                  abierto={abiertoId === e.id}
                  onAlternar={() => setAbiertoId((a) => (a === e.id ? null : e.id))}
                  puedeEliminar={gestiona}
                  puedeAdjuntar={esProfesorDelCurso}
                  esEstudiante={esEstudiante}
                  onVisor={(url, nombre) => setVisor({ url, nombre })}
                  onCambio={(cambios) => actualizar(e.id, cambios)}
                  onEliminado={() => {
                    setEjercicios((actuales) => (actuales ?? []).filter((x) => x.id !== e.id))
                    setAviso(`Ejercicio «${e.titulo}» eliminado.`)
                  }}
                  onError={setError}
                  indiceAnimacion={indice}
                />
              ))}
            </ol>
          )}

          {esProfesorDelCurso && (
            <FormularioNuevoEjercicio
              cursoId={curso.id}
              onCreado={(nuevo) => {
                setEjercicios((actuales) => [...(actuales ?? []), nuevo])
                setAbiertoId(nuevo.id)
                setAviso(null)
              }}
              onError={setError}
            />
          )}
        </section>
      </main>

      {visor && <VisorImagen url={visor.url} nombre={visor.nombre} onCerrar={() => setVisor(null)} />}
    </TemaProvider>
  )
}

// ------------------------------------------------------------
//  Un ejercicio dentro de la lista: acordeón numerado.
// ------------------------------------------------------------
function TarjetaEjercicio({
  ejercicio, numero, abierto, onAlternar, puedeEliminar, puedeAdjuntar, esEstudiante,
  onVisor, onCambio, onEliminado, onError, indiceAnimacion,
}: {
  ejercicio: Ejercicio
  numero: number
  abierto: boolean
  onAlternar: () => void
  puedeEliminar: boolean
  puedeAdjuntar: boolean
  esEstudiante: boolean
  onVisor: (url: string, nombre: string) => void
  onCambio: (cambios: Partial<Ejercicio>) => void
  onEliminado: () => void
  onError: (mensaje: string | null) => void
  indiceAnimacion: number
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [editando, setEditando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [enunciado, setEnunciado] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Si el acordeón se cierra a media edición, el formulario deja de mostrarse
  // (y vuelve el lápiz); el borrador se conserva al reabrirlo.
  const enEdicion = editando && abierto

  function abrirEdicion() {
    setTitulo(ejercicio.titulo)
    setEnunciado(ejercicio.enunciado ?? '')
    onError(null)
    setEditando(true)
  }

  // US16: los cambios se guardan en el servidor y la tarjeta muestra de
  // inmediato la versión nueva (los estudiantes la ven al abrir el curso).
  async function guardarEdicion() {
    if (titulo.trim().length < 3) {
      onError('El título del ejercicio debe tener al menos 3 caracteres.')
      return
    }
    onError(null)
    setGuardando(true)
    try {
      const nuevo = await actualizarEjercicio(ejercicio.id, { titulo: titulo.trim(), enunciado: enunciado.trim() || null })
      onCambio({ titulo: nuevo.titulo, enunciado: nuevo.enunciado, fechaActualizacion: nuevo.fechaActualizacion })
      setEditando(false)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo actualizar el ejercicio.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    onError(null)
    setEliminando(true)
    try {
      await eliminarEjercicio(ejercicio.id)
      onEliminado()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo eliminar el ejercicio.')
      setEliminando(false)
    }
  }

  async function agregarImagenes(lista: FileList | null) {
    if (!lista) return
    const { validos, error } = validarArchivos(Array.from(lista), ejercicio.imagenes.length, LIMITES_IMAGEN)
    onError(error)
    if (validos.length === 0) return
    setSubiendo(true)
    const subidas: ImagenEjercicio[] = []
    const fallidas: string[] = []
    for (const f of validos) {
      try {
        subidas.push(await subirImagenEjercicio(ejercicio.id, f))
      } catch (e) {
        fallidas.push(`${f.name} (${e instanceof Error ? e.message : 'error'})`)
      }
    }
    onCambio({ imagenes: [...ejercicio.imagenes, ...subidas] })
    if (fallidas.length) onError(`No se pudo subir: ${fallidas.join('; ')}`)
    setSubiendo(false)
  }

  async function quitarImagen(imagen: ImagenEjercicio) {
    if (!confirm(`¿Quitar la imagen «${imagen.nombre}» de este ejercicio?`)) return
    onError(null)
    try {
      await eliminarImagenEjercicio(imagen.id)
      onCambio({ imagenes: ejercicio.imagenes.filter((i) => i.id !== imagen.id) })
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo quitar la imagen.')
    }
  }

  const entregado = !!ejercicio.miSolucion

  return (
    <li
      className="panel rounded-2xl overflow-hidden anim-fade-in"
      style={{
        animationDelay: `${Math.min(indiceAnimacion, 8) * 0.06}s`,
        // Mismo recurso que el paso activo de la guía de Elektra: borde de
        // acento a la izquierda cuando el ejercicio está abierto.
        borderLeft: `3px solid ${abierto ? 'var(--accent)' : 'transparent'}`,
        transition: 'border-color 0.15s ease',
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onAlternar} className="flex items-center gap-3 flex-1 min-w-0 text-left" aria-expanded={abierto}>
          <span
            className="grid place-items-center w-7 h-7 rounded-full text-xs font-bold shrink-0"
            style={{
              background: abierto ? 'var(--accent)' : 'var(--bg1)',
              color: abierto ? 'var(--bg2)' : 'var(--ink-soft)',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            {numero}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold break-words">{ejercicio.titulo}</span>
            {(ejercicio.imagenes.length > 0 || ejercicio.fechaActualizacion) && (
              <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                {ejercicio.imagenes.length > 0 && `${ejercicio.imagenes.length} ${ejercicio.imagenes.length === 1 ? 'imagen' : 'imágenes'}`}
                {ejercicio.imagenes.length > 0 && ejercicio.fechaActualizacion && ' · '}
                {ejercicio.fechaActualizacion && `actualizado el ${fechaLegible(ejercicio.fechaActualizacion)}`}
              </span>
            )}
          </span>
          {esEstudiante && (
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-medium shrink-0"
              style={entregado ? { background: 'rgba(22,163,74,.12)', color: '#15803d' } : { background: 'rgba(217,119,6,.12)', color: '#b45309' }}
            >
              {entregado ? 'Entregado' : 'Pendiente'}
            </span>
          )}
          {!esEstudiante && ejercicio.totalSoluciones !== null && (
            <span className="rounded-md px-2 py-0.5 text-[11px] font-medium shrink-0" style={{ background: 'var(--bg1)', color: 'var(--ink-soft)' }}>
              {ejercicio.totalSoluciones} {ejercicio.totalSoluciones === 1 ? 'solución' : 'soluciones'}
            </span>
          )}
          <ChevronDown size={16} className="transition-transform shrink-0" style={{ transform: abierto ? 'rotate(180deg)' : 'none', color: 'var(--ink-soft)' }} />
        </button>
        {puedeAdjuntar && !enEdicion && (
          <button
            onClick={() => { if (!abierto) onAlternar(); abrirEdicion() }}
            className="grid place-items-center w-7 h-7 rounded-lg hover:bg-black/5 transition shrink-0"
            style={{ color: 'var(--ink-soft)' }}
            title="Editar ejercicio"
          >
            <Pencil size={14} />
          </button>
        )}
        {puedeEliminar && !confirmando && (
          <button onClick={() => setConfirmando(true)} className="grid place-items-center w-7 h-7 rounded-lg hover:bg-black/5 transition shrink-0" style={{ color: '#dc2626' }} title="Eliminar ejercicio">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* US17: el sistema solicita confirmación antes de eliminar. */}
      {confirmando && (
        <div role="alertdialog" aria-label={`Confirmar eliminación de ${ejercicio.titulo}`} className="mx-4 mb-3 rounded-lg p-2 flex flex-wrap items-center gap-2 anim-slide-up" style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.3)' }}>
          <span className="text-xs flex-1 min-w-40">¿Eliminar este ejercicio? Los estudiantes dejarán de verlo y se borrarán sus soluciones. No se puede deshacer.</span>
          <button onClick={() => setConfirmando(false)} disabled={eliminando} className="px-2.5 py-1 rounded-lg text-xs hover:bg-black/5 transition">Cancelar</button>
          <button onClick={eliminar} disabled={eliminando} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-white transition disabled:opacity-50" style={{ background: '#dc2626' }}>
            {eliminando && <Loader2 size={12} className="animate-spin" />}
            Sí, eliminar
          </button>
        </div>
      )}

      {abierto && (
        <div className="px-4 pb-4 anim-slide-up">
          {enEdicion ? (
            <form onSubmit={(ev) => { ev.preventDefault(); guardarEdicion() }} className="space-y-2 anim-slide-up" aria-label="Editar ejercicio">
              <input
                value={titulo}
                onChange={(ev) => setTitulo(ev.target.value)}
                maxLength={150}
                aria-label="Título del ejercicio"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={estiloCampo}
              />
              <textarea
                value={enunciado}
                onChange={(ev) => setEnunciado(ev.target.value)}
                maxLength={5000}
                rows={4}
                aria-label="Enunciado"
                placeholder="Enunciado (opcional)"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-y"
                style={estiloCampo}
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={guardando || titulo.trim().length < 3}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg accent-bg text-white text-xs font-medium shadow hover:brightness-110 disabled:opacity-40 transition"
                >
                  {guardando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Guardar cambios
                </button>
                <button type="button" onClick={() => setEditando(false)} disabled={guardando} className="px-2.5 py-1.5 rounded-lg text-xs hover:bg-black/5 transition">
                  Cancelar
                </button>
              </div>
            </form>
          ) : ejercicio.enunciado ? (
            <p className="text-sm whitespace-pre-line break-words">{ejercicio.enunciado}</p>
          ) : (
            <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>Este ejercicio no tiene enunciado escrito.</p>
          )}

          {(ejercicio.imagenes.length > 0 || puedeAdjuntar) && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {ejercicio.imagenes.map((img) => (
                <MiniaturaArchivo
                  key={img.id}
                  id={img.id}
                  nombre={img.nombre}
                  mime={img.mime}
                  cargar={cargarImagenEjercicio}
                  onAbrir={onVisor}
                  onEliminar={puedeAdjuntar ? () => quitarImagen(img) : undefined}
                />
              ))}
              {puedeAdjuntar && ejercicio.imagenes.length < MAX_IMAGENES_POR_EJERCICIO && (
                <label
                  className="w-24 h-24 rounded-lg grid place-items-center text-center cursor-pointer hover:brightness-95 transition shrink-0"
                  style={{ border: '1px dashed var(--border)', color: 'var(--ink-soft)' }}
                  title="Agregar imágenes"
                >
                  <input type="file" accept={TIPOS_IMAGEN} multiple className="hidden" disabled={subiendo}
                    onChange={(ev) => { agregarImagenes(ev.target.files); ev.target.value = '' }} />
                  <span className="flex flex-col items-center gap-1 text-[11px]">
                    {subiendo ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                    {subiendo ? 'Subiendo…' : 'Agregar imagen'}
                  </span>
                </label>
              )}
            </div>
          )}

          {esEstudiante && (
            <SolucionEstudiante
              ejercicio={ejercicio}
              onCambio={(solucion: Solucion | null) => onCambio({ miSolucion: solucion })}
              onVisor={onVisor}
            />
          )}
          {!esEstudiante && ejercicio.totalSoluciones !== null && <SolucionesRecibidas ejercicio={ejercicio} onVisor={onVisor} />}
        </div>
      )}
    </li>
  )
}

// ------------------------------------------------------------
//  Crear un ejercicio (solo el profesor del curso), con imágenes opcionales.
// ------------------------------------------------------------
function FormularioNuevoEjercicio({ cursoId, onCreado, onError }: {
  cursoId: string
  onCreado: (e: Ejercicio) => void
  onError: (mensaje: string | null) => void
}) {
  const [titulo, setTitulo] = useState('')
  const [enunciado, setEnunciado] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])
  const [guardando, setGuardando] = useState(false)

  function elegir(lista: FileList | null) {
    if (!lista) return
    const { validos, error } = validarArchivos(Array.from(lista), archivos.length, LIMITES_IMAGEN)
    setArchivos((actuales) => [...actuales, ...validos])
    onError(error)
  }

  async function agregar() {
    if (titulo.trim().length < 3) {
      onError('El título del ejercicio debe tener al menos 3 caracteres.')
      return
    }
    onError(null)
    setGuardando(true)
    try {
      const nuevo = await crearEjercicio(cursoId, { titulo: titulo.trim(), enunciado: enunciado.trim() || undefined })
      const subidas: ImagenEjercicio[] = []
      const fallidas: string[] = []
      for (const f of archivos) {
        try {
          subidas.push(await subirImagenEjercicio(nuevo.id, f))
        } catch (e) {
          fallidas.push(`${f.name} (${e instanceof Error ? e.message : 'error'})`)
        }
      }
      onCreado({ ...nuevo, imagenes: subidas })
      setTitulo('')
      setEnunciado('')
      setArchivos([])
      if (fallidas.length) onError(`El ejercicio se creó, pero no se pudo subir: ${fallidas.join('; ')}`)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo crear el ejercicio.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); agregar() }} className="panel rounded-2xl p-4 space-y-2.5 anim-fade-in" aria-label="Agregar ejercicio">
      <p className="text-sm font-semibold">Nuevo ejercicio</p>
      <input
        value={titulo}
        onChange={(ev) => setTitulo(ev.target.value)}
        maxLength={150}
        placeholder="Título del ejercicio"
        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
        style={estiloCampo}
      />
      <textarea
        value={enunciado}
        onChange={(ev) => setEnunciado(ev.target.value)}
        maxLength={5000}
        rows={3}
        placeholder="Enunciado (opcional)"
        className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-y"
        style={estiloCampo}
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer hover:brightness-95 transition" style={{ border: '1px dashed var(--border)', color: 'var(--ink-soft)' }}>
          <ImagePlus size={13} />
          Adjuntar imágenes
          <input type="file" accept={TIPOS_IMAGEN} multiple className="hidden" disabled={archivos.length >= MAX_IMAGENES_POR_EJERCICIO}
            onChange={(ev) => { elegir(ev.target.files); ev.target.value = '' }} />
        </label>
        {archivos.map((f, i) => (
          <span key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-md pl-2 pr-1 py-0.5 text-[11px] anim-bubble-in" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <span className="max-w-32 truncate" title={f.name}>{f.name}</span>
            <button type="button" onClick={() => setArchivos((a) => a.filter((_, k) => k !== i))} className="grid place-items-center w-4 h-4 rounded hover:bg-black/10" title="Quitar">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <button
        type="submit"
        disabled={guardando || titulo.trim().length < 3}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl accent-bg text-white text-sm font-medium shadow hover:brightness-110 disabled:opacity-40 transition"
      >
        {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        {guardando && archivos.length ? 'Subiendo imágenes…' : 'Publicar ejercicio'}
      </button>
    </form>
  )
}

export default CursoDetalle
