import { CircuitBoard, ClipboardCheck, Clock, FileText, GraduationCap, MessageSquare, PenLine, UserRound } from 'lucide-react'
import type { EventoActividad, MetricasEstudiante } from '../api/metricasEstudiante'
import { fechaLegible } from './cursosComun'

const NIVELES: Record<string, string> = { basico: 'Básico', experto: 'Experto' }

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function duracion(segundos: number | null) {
  if (segundos === null) return '—'
  const total = Math.round(segundos)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h} h ${m} min`
  if (m > 0) return `${m} min ${s} s`
  return `${s} s`
}

const iconoEvento: Record<EventoActividad['tipo'], typeof FileText> = {
  entrega: ClipboardCheck,
  borrador: PenLine,
  circuito: CircuitBoard,
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg1)' }}>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{etiqueta}</p>
      <p className="text-lg font-semibold tabular-nums mt-0.5">{valor}</p>
    </div>
  )
}

function Barra({ porcentaje }: { porcentaje: number }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }} role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full anim-progress" style={{ width: `${porcentaje}%`, background: '#16a34a' }} />
    </div>
  )
}

// ============================================================
//  Ficha de un estudiante: sus datos, su progreso en los cursos del
//  profesor y su actividad (ejercicios y uso de la herramienta).
// ============================================================
export default function FichaEstudiante({ metricas }: { metricas: MetricasEstudiante }) {
  const { perfil, progreso, cursos, circuitos, actividadReciente } = metricas
  const cuenta = !perfil.activo
    ? perfil.desactivadoPorInactividad ? 'Desactivada por inactividad' : 'Desactivada'
    : 'Activa'

  return (
    <div className="space-y-4 anim-fade-in">
      {/* Información del estudiante */}
      <section className="panel rounded-2xl p-5 space-y-3" aria-label="Información del estudiante">
        <div className="flex items-start gap-3">
          <div className="grid place-items-center w-11 h-11 rounded-full shrink-0 text-base font-bold" style={{ background: 'var(--accent)', color: 'var(--bg2)' }}>
            {perfil.nombre.trim().charAt(0).toUpperCase() || <UserRound size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold break-words">{perfil.nombre}</h2>
            <p className="text-xs break-all" style={{ color: 'var(--ink-soft)' }}>{perfil.email}</p>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0"
            style={perfil.activo ? { color: '#15803d', background: 'rgba(22,163,74,.12)' } : { color: '#b45309', background: 'rgba(217,119,6,.12)' }}
          >
            {cuenta}
          </span>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <dt style={{ color: 'var(--ink-soft)' }}>Nivel</dt>
            <dd className="font-medium">{NIVELES[perfil.nivel] ?? perfil.nivel}{!perfil.nivelConfirmado && ' (sin confirmar)'}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--ink-soft)' }}>Registro</dt>
            <dd className="font-medium">{perfil.fechaRegistro ? fechaLegible(perfil.fechaRegistro) : '—'}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--ink-soft)' }}>Último acceso</dt>
            <dd className="font-medium">{perfil.ultimoAcceso ? fechaHora(perfil.ultimoAcceso) : 'Sin registro'}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--ink-soft)' }}>En tus cursos</dt>
            <dd className="font-medium">{progreso.cursos}</dd>
          </div>
        </dl>
      </section>

      {/* Progreso */}
      <section className="panel rounded-2xl p-5 space-y-3" aria-label="Progreso">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold flex items-center gap-2"><GraduationCap size={16} style={{ color: 'var(--accent)' }} /> Progreso</h3>
          <span className="text-2xl font-bold tabular-nums">{progreso.porcentaje}%</span>
        </div>
        <Barra porcentaje={progreso.porcentaje} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Dato etiqueta="Completados" valor={`${progreso.completados} de ${progreso.totalEjercicios}`} />
          <Dato etiqueta="En progreso" valor={String(progreso.enProgreso)} />
          <Dato etiqueta="Con feedback" valor={String(progreso.entregasConFeedback)} />
          <Dato etiqueta="Revisados" valor={String(progreso.revisados)} />
        </div>
        {cursos.length > 1 && (
          <ul className="space-y-2.5 pt-1">
            {cursos.map((c) => (
              <li key={c.cursoId} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium break-words">{c.cursoNombre}</span>
                  <span className="tabular-nums text-xs" style={{ color: 'var(--ink-soft)' }}>{c.completados}/{c.totalEjercicios} · {c.porcentaje}%</span>
                </div>
                <Barra porcentaje={c.porcentaje} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Actividad con la herramienta */}
      <section className="panel rounded-2xl p-5 space-y-3" aria-label="Actividad">
        <h3 className="font-semibold flex items-center gap-2"><CircuitBoard size={16} style={{ color: 'var(--accent)' }} /> Actividad con circuitos</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Dato etiqueta="Circuitos armados" valor={String(circuitos.sesiones)} />
          <Dato etiqueta="Finalizados" valor={String(circuitos.sesionesFinalizadas)} />
          <Dato etiqueta="Tiempo total" valor={duracion(circuitos.sesionesFinalizadas ? circuitos.tiempoTotalSegundos : null)} />
          <Dato etiqueta="Tiempo promedio" valor={duracion(circuitos.tiempoPromedioSegundos)} />
        </div>
        <p className="text-xs flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'var(--ink-soft)' }}>
          <span className="flex items-center gap-1.5"><MessageSquare size={12} /> {circuitos.interaccionesChat} preguntas al asistente</span>
          <span className="flex items-center gap-1.5"><Clock size={12} /> Último circuito: {circuitos.ultimaSesion ? fechaHora(circuitos.ultimaSesion) : 'ninguno'}</span>
        </p>
      </section>

      {/* Actividad reciente */}
      <section className="panel rounded-2xl p-5 space-y-3" aria-label="Actividad reciente">
        <h3 className="font-semibold flex items-center gap-2"><Clock size={16} style={{ color: 'var(--accent)' }} /> Actividad reciente</h3>
        {actividadReciente.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Este estudiante todavía no registra actividad.</p>
        ) : (
          <ol className="space-y-2">
            {actividadReciente.map((e, i) => {
              const Icono = iconoEvento[e.tipo]
              return (
                <li key={`${e.fecha}-${i}`} className="flex items-start gap-2.5 text-sm anim-fade-in" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
                  <span className="grid place-items-center w-7 h-7 rounded-full shrink-0" style={{ background: 'var(--bg1)' }}>
                    <Icono size={14} style={{ color: 'var(--accent)' }} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block break-words">{e.descripcion}</span>
                    <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      {fechaHora(e.fecha)}{e.cursoNombre && ` · ${e.cursoNombre}`}
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
