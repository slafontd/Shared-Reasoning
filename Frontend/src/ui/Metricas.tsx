import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Sun, Moon, Loader2, X, BarChart3 } from 'lucide-react'
import TemaProvider, { type Tema } from './theme'
import { LogoWordmark } from './Logo'
import {
  obtenerResumenMetricas, obtenerMetricasProfesores, obtenerMetricasCursos, obtenerDetalleMetricasCurso,
  type ResumenMetricas, type MetricasProfesor, type MetricasCurso, type DetalleMetricasCurso,
} from '../api/metricas'

type Props = {
  esAdmin: boolean
  onVolver: () => void
}

// ============================================================
//  Métricas — EP07: US26 dashboard (#33), US27 por profesor (#34),
//  US28 por curso (#35). El administrador ve la plataforma completa;
//  un profesor, solo sus cursos (lo filtra el backend).
// ============================================================
function Metricas({ esAdmin, onVolver }: Props) {
  const [tema, setTema] = useState<Tema>('light')
  const [resumen, setResumen] = useState<ResumenMetricas | null>(null)
  const [profesores, setProfesores] = useState<MetricasProfesor[]>([])
  const [cursos, setCursos] = useState<MetricasCurso[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cursoAbierto, setCursoAbierto] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    Promise.all([
      obtenerResumenMetricas(),
      esAdmin ? obtenerMetricasProfesores() : Promise.resolve([]),
      obtenerMetricasCursos(),
    ])
      .then(([r, p, c]) => {
        if (cancelado) return
        setResumen(r)
        setProfesores(p)
        setCursos(c)
      })
      .catch((e) => !cancelado && setError(e instanceof Error ? e.message : 'No se pudieron cargar las métricas.'))
    return () => { cancelado = true }
  }, [esAdmin])

  return (
    <TemaProvider tema={tema} className="min-h-screen" style={{ color: 'var(--ink)', background: 'linear-gradient(135deg,var(--bg1),var(--bg2))' }}>
      <header className="flex items-center gap-3 px-6 h-16 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={onVolver} className="grid place-items-center w-9 h-9 rounded-lg hover:bg-black/5 transition" title="Volver">
          <ArrowLeft size={18} />
        </button>
        <LogoWordmark height={28} />
        <span className="text-sm font-semibold ml-1">Métricas</span>
        <button
          onClick={() => setTema((t) => (t === 'light' ? 'dark' : 'light'))}
          className="ml-auto grid place-items-center w-9 h-9 rounded-full panel hover:-translate-y-0.5 transition"
          title={tema === 'light' ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
        >
          {tema === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </header>

      <main className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        {error && (
          <div role="alert" className="rounded-xl px-3 py-2 text-sm" style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.4)', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {!resumen && !error ? (
          <p className="text-sm text-center py-16 flex items-center justify-center gap-2" style={{ color: 'var(--ink-soft)' }}>
            <Loader2 size={15} className="animate-spin" /> Calculando métricas…
          </p>
        ) : resumen && (
          <>
            {/* US26: dashboard */}
            <section aria-label="Resumen" className="space-y-3">
              <h1 className="text-lg font-semibold">
                {resumen.alcance === 'plataforma' ? 'Resumen de la plataforma' : 'Resumen de mis cursos'}
              </h1>
              {resumen.alcance === 'plataforma' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Indicador etiqueta="Usuarios" valor={resumen.usuarios_total ?? 0}
                    detalle={`${resumen.usuarios_por_rol?.estudiante ?? 0} estudiantes · ${resumen.usuarios_por_rol?.profesor ?? 0} profesores · ${resumen.usuarios_por_rol?.administrador ?? 0} admin`} />
                  <Indicador etiqueta="Activos (7 días)" valor={resumen.activos_7_dias ?? 0} detalle="Entraron o usaron la app esta semana" />
                  <Indicador etiqueta="Activos (30 días)" valor={resumen.activos_30_dias ?? 0} detalle="En el último mes" />
                  <Indicador etiqueta="Desactivados" valor={resumen.desactivados ?? 0} detalle="Por un admin o por inactividad" />
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Indicador etiqueta="Cursos" valor={resumen.cursos} detalle={plural(resumen.ejercicios, 'ejercicio', 'ejercicios')} />
                <Indicador etiqueta="Estudiantes" valor={resumen.estudiantes} detalle={plural(resumen.inscripciones, 'inscripción', 'inscripciones')} />
                <Indicador etiqueta="Entregas" valor={resumen.entregas} detalle={`${resumen.sin_feedback} esperando feedback`} />
                <Indicador etiqueta="Con feedback" valor={`${resumen.tasa_feedback}%`} detalle={`${resumen.con_feedback} de ${resumen.entregas} entregas`} />
              </div>
            </section>

            {/* US27: por profesor (solo admin; un profesor ya ve lo suyo arriba) */}
            {esAdmin && (
              <section aria-label="Métricas por profesor" className="space-y-3">
                <h2 className="text-base font-semibold">Por profesor</h2>
                {profesores.length === 0 ? (
                  <Vacio texto="Todavía no hay profesores." />
                ) : (
                  <Tabla encabezados={['Profesor', 'Cursos', 'Estudiantes', 'Ejercicios', 'Entregas', 'Feedback dado', 'Último acceso']}>
                    {profesores.map((p) => (
                      <tr key={p.profesor_id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{p.nombre}</p>
                          <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{p.email}</p>
                        </td>
                        <Numero valor={p.cursos} />
                        <Numero valor={p.estudiantes} />
                        <Numero valor={p.ejercicios} />
                        <Numero valor={p.entregas} />
                        <td className="px-4 py-2.5"><Barra porcentaje={p.tasa_feedback} detalle={`${p.con_feedback} de ${p.entregas} entregas con feedback · ${p.sin_feedback} pendientes`} /></td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--ink-soft)' }}>{fecha(p.ultimo_acceso)}</td>
                      </tr>
                    ))}
                  </Tabla>
                )}
              </section>
            )}

            {/* US28: por curso */}
            <section aria-label="Métricas por curso" className="space-y-3">
              <h2 className="text-base font-semibold">Por curso</h2>
              {cursos.length === 0 ? (
                <Vacio texto={esAdmin ? 'Todavía no hay cursos.' : 'Todavía no has creado cursos.'} />
              ) : (
                <Tabla encabezados={['Curso', ...(esAdmin ? ['Profesor'] : []), 'Inscritos', 'Ejercicios', 'Entregas', 'Tasa de entrega', 'Feedback dado', '']}>
                  {cursos.map((c) => (
                    <tr key={c.curso_id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{c.nombre}</p>
                        <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                          {c.codigo ? `${c.codigo} · ` : ''}Última entrega: {fecha(c.ultima_entrega)}
                        </p>
                      </td>
                      {esAdmin && <td className="px-4 py-2.5 text-sm">{c.profesor_nombre}</td>}
                      <Numero valor={c.inscritos} />
                      <Numero valor={c.ejercicios} />
                      <Numero valor={c.entregas} />
                      <td className="px-4 py-2.5"><Barra porcentaje={c.tasa_entrega} detalle={`${c.entregas} de ${c.inscritos * c.ejercicios} entregas posibles`} /></td>
                      <td className="px-4 py-2.5"><Barra porcentaje={c.tasa_feedback} detalle={`${c.con_feedback} de ${c.entregas} con feedback · ${c.sin_feedback} pendientes`} /></td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => setCursoAbierto(c.curso_id)} className="text-xs font-medium px-2.5 py-1 rounded-lg hover:bg-black/5 transition" style={{ color: 'var(--accent)' }}>
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </Tabla>
              )}
            </section>
          </>
        )}
      </main>

      {cursoAbierto && <ModalDetalleCurso cursoId={cursoAbierto} onCerrar={() => setCursoAbierto(null)} />}
    </TemaProvider>
  )
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`
}

function fecha(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: number | string; detalle: string }) {
  return (
    <div className="panel rounded-2xl p-4">
      <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{etiqueta}</p>
      <p className="text-2xl font-semibold tabular-nums mt-1" data-testid={`indicador-${etiqueta}`}>{valor}</p>
      <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>{detalle}</p>
    </div>
  )
}

function Tabla({ encabezados, children }: { encabezados: string[]; children: ReactNode }) {
  return (
    <div className="panel rounded-2xl overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr>
            {encabezados.map((e, i) => (
              <th key={`${e}-${i}`} className={`px-4 py-2.5 font-medium text-xs ${i === 0 ? 'text-left' : 'text-left'}`} style={{ color: 'var(--ink-soft)' }}>{e}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Numero({ valor }: { valor: number }) {
  return <td className="px-4 py-2.5 tabular-nums">{valor}</td>
}

// Barra de porcentaje: un solo tono (magnitud), con el número escrito al
// lado — el color nunca es lo único que comunica el valor.
function Barra({ porcentaje, detalle }: { porcentaje: number; detalle: string }) {
  return (
    <div className="flex items-center gap-2 min-w-28" title={detalle}>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg2)' }} role="img" aria-label={`${porcentaje}%: ${detalle}`}>
        <div className="h-full rounded-full" style={{ width: `${porcentaje}%`, background: 'var(--accent)' }} />
      </div>
      <span className="text-xs tabular-nums w-9 text-right">{porcentaje}%</span>
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="panel rounded-2xl p-8 text-center space-y-2">
      <BarChart3 size={24} className="mx-auto" style={{ color: 'var(--accent)' }} />
      <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{texto}</p>
    </div>
  )
}

// US28: desglose por ejercicio de un curso.
function ModalDetalleCurso({ cursoId, onCerrar }: { cursoId: string; onCerrar: () => void }) {
  const [detalle, setDetalle] = useState<DetalleMetricasCurso | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    obtenerDetalleMetricasCurso(cursoId)
      .then((d) => !cancelado && setDetalle(d))
      .catch((e) => !cancelado && setError(e instanceof Error ? e.message : 'No se pudo cargar el detalle.'))
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', alTeclear)
    return () => { cancelado = true; window.removeEventListener('keydown', alTeclear) }
  }, [cursoId, onCerrar])

  return (
    <div className="fixed inset-0 z-30 grid place-items-center p-4" style={{ background: 'rgba(0,0,0,.5)' }} onClick={onCerrar}>
      <div role="dialog" aria-label="Métricas del curso" onClick={(e) => e.stopPropagation()} className="panel rounded-2xl p-6 w-full max-w-2xl space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg break-words">{detalle?.nombre ?? 'Cargando…'}</h2>
            {detalle && (
              <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                {plural(detalle.inscritos, 'inscrito', 'inscritos')} · {plural(detalle.ejercicios, 'ejercicio', 'ejercicios')} · {plural(detalle.entregas, 'entrega', 'entregas')} · {detalle.tasa_entrega}% de entrega · {detalle.sin_feedback} sin feedback
              </p>
            )}
          </div>
          <button onClick={onCerrar} className="grid place-items-center w-7 h-7 rounded-lg hover:bg-black/5" title="Cerrar"><X size={16} /></button>
        </div>
        {error && <p role="alert" className="text-sm" style={{ color: '#dc2626' }}>{error}</p>}
        {!detalle && !error && <p className="text-sm flex items-center gap-2" style={{ color: 'var(--ink-soft)' }}><Loader2 size={14} className="animate-spin" /> Cargando…</p>}
        {detalle && (detalle.por_ejercicio.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Este curso todavía no tiene ejercicios.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Ejercicio', 'Entregas', 'Entregaron', 'Con feedback'].map((e) => (
                  <th key={e} className="text-left px-2 py-2 font-medium text-xs" style={{ color: 'var(--ink-soft)' }}>{e}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detalle.por_ejercicio.map((e) => (
                <tr key={e.ejercicio_id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="px-2 py-2 font-medium break-words">{e.titulo}</td>
                  <td className="px-2 py-2 tabular-nums">{e.entregas}</td>
                  <td className="px-2 py-2"><Barra porcentaje={e.tasa_entrega} detalle={`${e.entregas} de ${detalle.inscritos} inscritos entregaron`} /></td>
                  <td className="px-2 py-2"><Barra porcentaje={e.tasa_feedback} detalle={`${e.con_feedback} de ${e.entregas} con feedback`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  )
}

export default Metricas
