import { useEffect, useState } from 'react'
import { Activity, ChevronDown, Loader2, Search } from 'lucide-react'
import {
  obtenerDetalleUsoUsuario, obtenerUsoPlataforma, obtenerUsoUsuarios,
  type DetalleUsoUsuario, type ListaUsoUsuarios, type OrdenUsuarios, type PuntoDiario, type UsoPlataforma,
} from '../api/metricasUso'
import { GraficoBarras, GraficoColumnas, type Barra } from './GraficosUso'

const PERIODOS = [7, 30, 90] as const
const ROLES = [['', 'Todos los roles'], ['estudiante', 'Estudiantes'], ['profesor', 'Profesores'], ['administrador', 'Administradores']] as const
const ORDENES: [OrdenUsuarios, string][] = [
  ['interacciones', 'Más interacciones'], ['dias_activos', 'Más días activos'], ['ultima_actividad', 'Actividad más reciente'], ['nombre', 'Nombre'],
]
const NOMBRE_ROL: Record<string, string> = { estudiante: 'Estudiante', profesor: 'Profesor', administrador: 'Administrador' }
const estiloCampo = { background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--ink)' }

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

function fechaCorta(iso: string) {
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}`
}

function fechaHora(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin actividad'
}

function Tarjeta({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <section className="panel rounded-2xl p-5 space-y-3" aria-label={titulo}>
      <div>
        <h3 className="font-semibold">{titulo}</h3>
        {ayuda && <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{ayuda}</p>}
      </div>
      {children}
    </section>
  )
}

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string | number; detalle: string }) {
  return (
    <div className="panel rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{etiqueta}</p>
      <p className="text-2xl font-bold tabular-nums mt-0.5">{valor}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>{detalle}</p>
    </div>
  )
}

function barrasDiarias(serie: PuntoDiario[], campo: 'interacciones' | 'usuarios_activos', unidad: [string, string]): Barra[] {
  return serie.map((p) => ({ etiqueta: fechaCorta(p.fecha), valor: p[campo], detalle: plural(p[campo], unidad[0], unidad[1]) }))
}

// Equivalente en tabla de los gráficos diarios: nada depende del hover.
function TablaDiaria({ serie }: { serie: PuntoDiario[] }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer select-none" style={{ color: 'var(--ink-soft)' }}>Ver datos como tabla</summary>
      <div className="overflow-x-auto max-h-64 overflow-y-auto mt-2 rounded-lg" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-left">
          <thead style={{ background: 'var(--bg1)' }}>
            <tr><th className="px-3 py-1.5 font-medium">Día</th><th className="px-3 py-1.5 font-medium text-right">Interacciones</th><th className="px-3 py-1.5 font-medium text-right">Inicios de sesión</th><th className="px-3 py-1.5 font-medium text-right">Usuarios activos</th></tr>
          </thead>
          <tbody>
            {[...serie].reverse().map((p) => (
              <tr key={p.fecha} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="px-3 py-1">{fechaCorta(p.fecha)}</td>
                <td className="px-3 py-1 text-right tabular-nums">{p.interacciones}</td>
                <td className="px-3 py-1 text-right tabular-nums">{p.inicios_sesion}</td>
                <td className="px-3 py-1 text-right tabular-nums">{p.usuarios_activos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

// ============================================================
//  US30 — Frecuencia de uso e interacciones (solo administrador).
//  Un periodo (7/30/90 días) gobierna todo lo que hay debajo.
// ============================================================
export default function UsoPlataformaVista() {
  const [dias, setDias] = useState<number>(30)
  const [uso, setUso] = useState<UsoPlataforma | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    obtenerUsoPlataforma(dias)
      .then((r) => { if (!cancelado) { setUso(r); setError(null) } })
      .catch((e) => !cancelado && setError(e instanceof Error ? e.message : 'No se pudo cargar el uso de la plataforma.'))
      .finally(() => !cancelado && setCargando(false))
    return () => { cancelado = true }
  }, [dias])

  function cambiarPeriodo(d: number) {
    if (d === dias) return
    setCargando(true)
    setDias(d)
  }

  return (
    <section aria-label="Uso de la plataforma" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Activity size={18} style={{ color: 'var(--accent)' }} /> Uso de la plataforma</h2>
        <div className="flex gap-1 rounded-lg p-1 ml-auto" style={{ background: 'var(--bg2)' }} role="tablist" aria-label="Periodo">
          {PERIODOS.map((d) => (
            <button
              key={d} role="tab" aria-selected={dias === d} onClick={() => cambiarPeriodo(d)}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition"
              style={{ background: dias === d ? 'var(--bg1)' : 'transparent', color: dias === d ? 'var(--ink)' : 'var(--ink-soft)' }}
            >
              Últimos {d} días
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl px-3 py-2 text-sm" style={{ color: '#dc2626', background: 'rgba(220,38,38,.08)' }}>{error}</p>}

      {!uso ? (
        !error && <p className="text-sm text-center py-10 flex items-center justify-center gap-2" style={{ color: 'var(--ink-soft)' }}><Loader2 size={15} className="animate-spin" /> Calculando uso…</p>
      ) : (
        // Mientras recarga, se conserva lo anterior atenuado (sin saltos de layout).
        <div className="space-y-4 transition-opacity" style={{ opacity: cargando ? 0.55 : 1 }} aria-busy={cargando}>
          <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            Del {fechaCorta(uso.periodo.desde)} al {fechaCorta(uso.periodo.hasta)} · horas y días en {uso.periodo.zona_horaria}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Indicador etiqueta="Usuarios activos" valor={uso.resumen.usuarios_activos} detalle={`${uso.resumen.porcentaje_activos}% de ${uso.resumen.usuarios_totales} cuentas`} />
            <Indicador etiqueta="Interacciones" valor={uso.resumen.interacciones} detalle={`${uso.resumen.promedio_interacciones_por_usuario} por usuario activo`} />
            <Indicador etiqueta="Inicios de sesión" valor={uso.resumen.inicios_sesion} detalle="Veces que se ingresó a la plataforma" />
            <Indicador etiqueta="Frecuencia" valor={`${uso.resumen.promedio_dias_activos} días`} detalle={`activos por usuario, de ${uso.periodo.dias}`} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Tarjeta titulo="Interacciones por día" ayuda="Lo que hacen los usuarios: circuitos, preguntas, entregas, retos…">
              <GraficoColumnas titulo="Interacciones por día" barras={barrasDiarias(uso.serie_diaria, 'interacciones', ['interacción', 'interacciones'])} />
            </Tarjeta>
            <Tarjeta titulo="Usuarios activos por día" ayuda="Personas distintas con alguna actividad ese día.">
              <GraficoColumnas titulo="Usuarios activos por día" barras={barrasDiarias(uso.serie_diaria, 'usuarios_activos', ['usuario', 'usuarios'])} />
            </Tarjeta>
          </div>
          <TablaDiaria serie={uso.serie_diaria} />

          <div className="grid lg:grid-cols-2 gap-4">
            <Tarjeta titulo="Qué hacen los usuarios" ayuda="Interacciones del periodo por tipo.">
              {uso.resumen.interacciones === 0 ? (
                <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Todavía no hay interacciones en este periodo.</p>
              ) : (
                <GraficoBarras titulo="Interacciones por tipo" barras={uso.por_tipo.filter((t) => t.es_interaccion && t.total > 0).map((t) => ({ etiqueta: t.etiqueta, valor: t.total }))} />
              )}
            </Tarjeta>
            <Tarjeta titulo="Horas de mayor uso" ayuda={`Actividad registrada por hora del día (${uso.periodo.zona_horaria}).`}>
              <GraficoColumnas
                titulo="Actividad por hora" alto={170} cadaN={3}
                barras={uso.por_hora.map((h) => ({ etiqueta: `${h.hora}h`, valor: h.eventos, detalle: plural(h.eventos, 'registro', 'registros') }))}
              />
            </Tarjeta>
          </div>

          <Tarjeta titulo="Por rol" ayuda="Usuarios activos e interacciones en el periodo.">
            {uso.por_rol.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Sin actividad en este periodo.</p>
            ) : (
              <GraficoBarras
                titulo="Interacciones por rol"
                barras={uso.por_rol.map((r) => ({ etiqueta: `${NOMBRE_ROL[r.rol] ?? r.rol} (${plural(r.usuarios_activos, 'activo', 'activos')})`, valor: r.interacciones }))}
              />
            )}
          </Tarjeta>

          <UsuariosUso dias={dias} />
        </div>
      )}
    </section>
  )
}

// ---------- Tabla por usuario ----------
function UsuariosUso({ dias }: { dias: number }) {
  const [buscar, setBuscar] = useState('')
  const [rol, setRol] = useState('')
  const [orden, setOrden] = useState<OrdenUsuarios>('interacciones')
  const [lista, setLista] = useState<ListaUsoUsuarios | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    // Pausa de 300 ms al escribir para no pedir en cada tecla.
    const t = setTimeout(() => {
      obtenerUsoUsuarios({ dias, rol, buscar, orden })
        .then((r) => { if (!cancelado) { setLista(r); setError(null) } })
        .catch((e) => !cancelado && setError(e instanceof Error ? e.message : 'No se pudo cargar la lista de usuarios.'))
    }, buscar ? 300 : 0)
    return () => { cancelado = true; clearTimeout(t) }
  }, [dias, rol, buscar, orden])

  return (
    <Tarjeta titulo="Uso por usuario" ayuda="Frecuencia = % de los días del periodo en que el usuario tuvo actividad. Toca un usuario para ver su detalle.">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-44">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-soft)' }} />
          <input
            type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre o correo…" aria-label="Buscar usuarios"
            maxLength={100} className="w-full rounded-xl pl-8 pr-3 py-2 text-sm outline-none" style={estiloCampo}
          />
        </div>
        <select value={rol} onChange={(e) => setRol(e.target.value)} aria-label="Filtrar por rol" className="rounded-xl px-3 py-2 text-sm outline-none" style={estiloCampo}>
          {ROLES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <select value={orden} onChange={(e) => setOrden(e.target.value as OrdenUsuarios)} aria-label="Ordenar por" className="rounded-xl px-3 py-2 text-sm outline-none" style={estiloCampo}>
          {ORDENES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="text-sm" style={{ color: '#dc2626' }}>{error}</p>}
      {!lista ? (
        !error && <p className="text-sm flex items-center gap-2" style={{ color: 'var(--ink-soft)' }}><Loader2 size={14} className="animate-spin" /> Cargando…</p>
      ) : lista.usuarios.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--ink-soft)' }}>Ningún usuario coincide.</p>
      ) : (
        <>
          <ul className="divide-y" style={{ borderTop: '1px solid var(--border)' }}>
            {lista.usuarios.map((u) => (
              <li key={u.usuario_id} style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={() => setAbierto((a) => (a === u.usuario_id ? null : u.usuario_id))}
                  aria-expanded={abierto === u.usuario_id}
                  className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,.6fr))_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5 text-left text-sm hover:bg-black/5 transition rounded-lg px-1"
                >
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{u.nombre}</span>
                    <span className="block text-xs truncate" style={{ color: 'var(--ink-soft)' }}>{NOMBRE_ROL[u.rol] ?? u.rol} · {u.email}</span>
                  </span>
                  <span className="hidden sm:block tabular-nums"><span className="font-semibold">{u.interacciones}</span> <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>inter.</span></span>
                  <span className="hidden sm:block tabular-nums"><span className="font-semibold">{u.dias_activos}</span> <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>días ({u.frecuencia}%)</span></span>
                  <span className="hidden sm:block tabular-nums"><span className="font-semibold">{u.inicios_sesion}</span> <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>ingresos</span></span>
                  <span className="hidden sm:block text-xs" style={{ color: 'var(--ink-soft)' }}>{fechaHora(u.ultima_actividad)}</span>
                  <ChevronDown size={15} className="transition-transform" style={{ transform: abierto === u.usuario_id ? 'rotate(180deg)' : 'none', color: 'var(--ink-soft)' }} />
                </button>
                {abierto === u.usuario_id && <DetalleUsuario usuarioId={u.usuario_id} dias={dias} />}
              </li>
            ))}
          </ul>
          <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>Mostrando {lista.usuarios.length} de {lista.total} usuarios.</p>
        </>
      )}
    </Tarjeta>
  )
}

function DetalleUsuario({ usuarioId, dias }: { usuarioId: string; dias: number }) {
  const [detalle, setDetalle] = useState<DetalleUsoUsuario | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    obtenerDetalleUsoUsuario(usuarioId, dias)
      .then((r) => !cancelado && setDetalle(r))
      .catch((e) => !cancelado && setError(e instanceof Error ? e.message : 'No se pudo cargar el detalle.'))
    return () => { cancelado = true }
  }, [usuarioId, dias])

  if (error) return <p role="alert" className="text-sm px-1 pb-3" style={{ color: '#dc2626' }}>{error}</p>
  if (!detalle) return <p className="text-sm px-1 pb-3 flex items-center gap-2" style={{ color: 'var(--ink-soft)' }}><Loader2 size={14} className="animate-spin" /> Cargando detalle…</p>

  const tipos = detalle.por_tipo.filter((t) => t.total > 0)
  return (
    <div className="px-1 pb-4 space-y-3 anim-slide-up">
      <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
        Último acceso: {fechaHora(detalle.ultimo_acceso)} · {plural(detalle.usuario.dias_activos, 'día activo', 'días activos')} de {dias}
      </p>
      <div className="max-w-2xl">
        <GraficoColumnas titulo={`Interacciones por día de ${detalle.usuario.nombre}`} alto={150} barras={barrasDiarias(detalle.serie_diaria, 'interacciones', ['interacción', 'interacciones'])} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold mb-1.5">Qué hizo</p>
          {tipos.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>Sin registros en el periodo.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {tipos.map((t) => (
                <li key={t.tipo} className="rounded-md px-2 py-1 text-xs" style={{ background: 'var(--bg1)' }}>
                  {t.etiqueta}: <span className="font-semibold tabular-nums">{t.total}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold mb-1.5">Actividad reciente</p>
          {detalle.recientes.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>Sin actividad registrada.</p>
          ) : (
            <ul className="space-y-0.5 text-xs">
              {detalle.recientes.slice(0, 8).map((e, i) => (
                <li key={`${e.fecha}-${i}`} className="flex justify-between gap-3">
                  <span>{e.etiqueta}</span>
                  <span style={{ color: 'var(--ink-soft)' }}>{fechaHora(e.fecha)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
