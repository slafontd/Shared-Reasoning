import { useEffect, useState } from 'react'
import { ArrowLeft, Check, CheckCircle2, ClipboardList, Loader2, Users } from 'lucide-react'
import { listarMisCursos, type Curso } from '../api/cursos'
import {
  actualizarRevisionEjercicio, obtenerDetalleProgreso, obtenerProgresoCurso,
  type CursoProgreso, type DetalleProgresoEstudiante, type EjercicioProgresoDetalle,
} from '../api/seguimiento'
import { LogoWordmark } from './Logo'
import { fechaLegible } from './cursosComun'

type Props = { onVolver: () => void }

const coloresEstado = {
  completado: { etiqueta: 'Completado', color: '#16a34a', fondo: 'rgba(22,163,74,.12)' },
  en_progreso: { etiqueta: 'En progreso', color: '#3b82f6', fondo: 'rgba(59,130,246,.12)' },
  no_iniciado: { etiqueta: 'No iniciado', color: 'var(--ink-soft)', fondo: 'var(--bg2)' },
} as const

function BarraEstados({ completados, enProgreso, sinIniciar, total }: {
  completados: number
  enProgreso: number
  sinIniciar: number
  total: number
}) {
  if (!total) {
    return <div className="h-2.5 rounded-full" style={{ background: 'var(--border)' }} aria-label="Sin ejercicios" />
  }
  return (
    <div
      className="flex h-2.5 overflow-hidden rounded-full"
      role="img"
      aria-label={`${completados} completados, ${enProgreso} en progreso, ${sinIniciar} sin iniciar`}
      style={{ background: 'var(--border)' }}
    >
      {completados > 0 && <span style={{ width: `${(completados / total) * 100}%`, background: '#16a34a' }} />}
      {enProgreso > 0 && <span style={{ width: `${(enProgreso / total) * 100}%`, background: '#3b82f6' }} />}
      {sinIniciar > 0 && <span style={{ width: `${(sinIniciar / total) * 100}%`, background: '#9ca3af' }} />}
    </div>
  )
}

function estadoActividad(iso: string | null) {
  return iso ? fechaLegible(iso) : 'Sin actividad registrada'
}

export default function ProgresoEstudiantes({ onVolver }: Props) {
  const [cursos, setCursos] = useState<Curso[]>([])
  const [cursoId, setCursoId] = useState('')
  const [resumen, setResumen] = useState<CursoProgreso | null>(null)
  const [estudiante, setEstudiante] = useState<DetalleProgresoEstudiante | null>(null)
  const [cargandoCursos, setCargandoCursos] = useState(true)
  const [cargandoResumen, setCargandoResumen] = useState(false)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [actualizandoRevision, setActualizandoRevision] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    listarMisCursos()
      .then((lista) => {
        if (cancelado) return
        setCursos(lista)
        if (lista.length) {
          setCargandoResumen(true)
          setCursoId(lista[0].id)
        }
      })
      .catch((e) => !cancelado && setError(e instanceof Error ? e.message : 'No se pudieron cargar tus cursos.'))
      .finally(() => !cancelado && setCargandoCursos(false))
    return () => { cancelado = true }
  }, [])

  useEffect(() => {
    if (!cursoId) return
    let cancelado = false
    obtenerProgresoCurso(cursoId)
      .then((resultado) => !cancelado && setResumen(resultado))
      .catch((e) => !cancelado && setError(e instanceof Error ? e.message : 'No se pudo cargar el progreso del curso.'))
      .finally(() => !cancelado && setCargandoResumen(false))
    return () => { cancelado = true }
  }, [cursoId])

  async function seleccionarEstudiante(estudianteId: string) {
    setError(null)
    setCargandoDetalle(true)
    try {
      setEstudiante(await obtenerDetalleProgreso(cursoId, estudianteId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el detalle del estudiante.')
    } finally {
      setCargandoDetalle(false)
    }
  }

  async function cambiarRevision(ejercicio: EjercicioProgresoDetalle) {
    if (!estudiante) return
    setError(null)
    setActualizandoRevision(ejercicio.ejercicioId)
    try {
      await actualizarRevisionEjercicio(
        estudiante.cursoId,
        estudiante.estudianteId,
        ejercicio.ejercicioId,
        !ejercicio.revisado,
      )
      setEstudiante(await obtenerDetalleProgreso(estudiante.cursoId, estudiante.estudianteId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la revisión.')
    } finally {
      setActualizandoRevision(null)
    }
  }

  const cursoSeleccionado = cursos.find((curso) => curso.id === cursoId)

  return (
    <div className="min-h-screen" style={{ color: 'var(--ink)', background: 'linear-gradient(135deg,var(--bg1),var(--bg2))' }}>
      <header className="flex items-center gap-3 px-6 h-16" style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={onVolver} className="grid place-items-center w-9 h-9 rounded-lg hover:bg-black/5 transition" title="Volver a cursos">
          <ArrowLeft size={18} />
        </button>
        <LogoWordmark height={28} />
        <span className="text-sm font-semibold ml-1">Progreso de estudiantes</span>
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-5">
        <section className="panel rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-semibold">Progreso de estudiantes</h1>
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ color: '#16a34a', background: 'rgba(22,163,74,.12)' }}>
              Panel profesor
            </span>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Curso seleccionado</span>
            <select
              value={cursoId}
              onChange={(event) => {
                setResumen(null)
                setEstudiante(null)
                setCargandoResumen(true)
                setError(null)
                setCursoId(event.target.value)
              }}
              disabled={cargandoCursos || cursos.length === 0}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            >
              {cargandoCursos && <option value="">Cargando cursos…</option>}
              {!cargandoCursos && cursos.length === 0 && <option value="">No tienes cursos asignados</option>}
              {cursos.map((curso) => <option key={curso.id} value={curso.id}>{curso.nombre}</option>)}
            </select>
          </label>

          {cursoSeleccionado && resumen && (
            <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
              {resumen.estudiantes.length} estudiantes · {resumen.totalEjercicios} ejercicios
            </p>
          )}
        </section>

        {error && <p role="alert" className="rounded-xl px-3 py-2 text-sm" style={{ color: '#dc2626', background: 'rgba(220,38,38,.08)' }}>{error}</p>}

        {cargandoCursos || cargandoResumen ? (
          <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm" style={{ color: 'var(--ink-soft)' }}>
            <Loader2 size={16} className="animate-spin" /> Cargando seguimiento…
          </p>
        ) : !cursoSeleccionado ? (
          <div className="panel rounded-2xl p-8 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
            Crea un curso para comenzar a hacer seguimiento de tus estudiantes.
          </div>
        ) : estudiante ? (
          <section className="space-y-4">
            <button onClick={() => setEstudiante(null)} className="flex items-center gap-1.5 text-sm hover:underline" style={{ color: 'var(--accent)' }}>
              <ArrowLeft size={15} /> Seguimiento individual
            </button>
            {cargandoDetalle ? (
              <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: 'var(--ink-soft)' }}>
                <Loader2 size={16} className="animate-spin" /> Cargando detalle…
              </p>
            ) : (
              <DetalleEstudiante
                estudiante={estudiante}
                alCambiarRevision={cambiarRevision}
                actualizandoRevision={actualizandoRevision}
              />
            )}
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Users size={17} style={{ color: 'var(--accent)' }} /> Seguimiento individual
            </h2>
            {!resumen?.estudiantes.length ? (
              <div className="panel rounded-2xl p-8 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
                Aún no hay estudiantes inscritos en este curso.
              </div>
            ) : resumen.estudiantes.map((persona) => (
              <button
                key={persona.estudianteId}
                onClick={() => seleccionarEstudiante(persona.estudianteId)}
                className="panel w-full rounded-2xl p-4 text-left space-y-2.5 hover:-translate-y-0.5 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{persona.nombre}</span>
                  <span className="text-lg font-bold tabular-nums">{persona.porcentaje}%</span>
                </div>
                <BarraEstados
                  completados={persona.completados}
                  enProgreso={persona.enProgreso}
                  sinIniciar={persona.sinIniciar}
                  total={persona.totalEjercicios}
                />
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
                  <span>{persona.completados} de {persona.totalEjercicios} ejercicios completados</span>
                  <span>{persona.enProgreso} en progreso · {persona.sinIniciar} sin iniciar</span>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                  Última actividad: {estadoActividad(persona.ultimaActividad)}
                </p>
              </button>
            ))}
            <div className="flex flex-wrap gap-4 pt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#16a34a' }} /> Completado</span>
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#3b82f6' }} /> En progreso</span>
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#9ca3af' }} /> Sin iniciar</span>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function DetalleEstudiante({ estudiante, alCambiarRevision, actualizandoRevision }: {
  estudiante: DetalleProgresoEstudiante
  alCambiarRevision: (ejercicio: EjercicioProgresoDetalle) => void
  actualizandoRevision: string | null
}) {
  return (
    <section className="panel rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{estudiante.cursoNombre}</p>
          <h1 className="text-xl font-semibold">{estudiante.estudianteNombre}</h1>
        </div>
        <p className="text-2xl font-bold tabular-nums">{estudiante.porcentaje}%</p>
      </div>
      <BarraEstados
        completados={estudiante.completados}
        enProgreso={estudiante.enProgreso}
        sinIniciar={estudiante.sinIniciar}
        total={estudiante.totalEjercicios}
      />
      <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
        {estudiante.completados} completados · {estudiante.enProgreso} en progreso · {estudiante.sinIniciar} sin iniciar
      </p>
      <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
        Última actividad: {estadoActividad(estudiante.ultimaActividad)}
      </p>

      <div className="space-y-2">
        <h2 className="font-semibold flex items-center gap-2"><ClipboardList size={16} /> Ejercicios del curso</h2>
        {estudiante.ejercicios.map((ejercicio) => {
          const estado = coloresEstado[ejercicio.estado]
          const actualizando = actualizandoRevision === ejercicio.ejercicioId
          return (
            <article key={ejercicio.ejercicioId} className="rounded-xl p-3 space-y-2" style={{ border: '1px solid var(--border)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{ejercicio.titulo}</h3>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ color: estado.color, background: estado.fondo }}>
                  {estado.etiqueta}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                  Última actividad: {estadoActividad(ejercicio.ultimaActividad)}
                </span>
                <button
                  type="button"
                  onClick={() => alCambiarRevision(ejercicio)}
                  disabled={actualizando}
                  aria-pressed={ejercicio.revisado}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50"
                  style={{
                    color: ejercicio.revisado ? '#15803d' : 'var(--ink-soft)',
                    border: `1px solid ${ejercicio.revisado ? 'rgba(22,163,74,.4)' : 'var(--border)'}`,
                  }}
                >
                  {actualizando ? <Loader2 size={13} className="animate-spin" /> : ejercicio.revisado ? <CheckCircle2 size={13} /> : <Check size={13} />}
                  {ejercicio.revisado ? 'Revisado' : 'Marcar revisado'}
                </button>
              </div>
              {ejercicio.revisado && ejercicio.revisadoEn && (
                <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Revisado el {fechaLegible(ejercicio.revisadoEn)}</p>
              )}
            </article>
          )
        })}
        {estudiante.ejercicios.length === 0 && (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--ink-soft)' }}>Este curso aún no tiene ejercicios.</p>
        )}
      </div>
    </section>
  )
}
