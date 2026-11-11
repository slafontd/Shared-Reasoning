import { useEffect, useState } from 'react'
import { ArrowLeft, Sun, Moon, Plus, X, Loader2, Search, ShieldCheck, GraduationCap, User, Trash2, Pencil, UserX, UserCheck, Clock, CheckCircle2 } from 'lucide-react'
import TemaProvider, { type Tema } from './theme'
import { LogoWordmark } from './Logo'
import type { Nivel, Rol } from './tipos'
import {
  listarUsuariosAdmin, crearUsuarioAdmin, actualizarUsuarioAdmin, eliminarUsuarioAdmin, desactivarInactivosAdmin,
  type UsuarioAdmin,
} from '../api/admin'

type Props = {
  usuarioActualId: string
  onVolver: () => void
}

const NIVELES: { id: Nivel; etiqueta: string }[] = [
  { id: 'basico', etiqueta: 'Básico' },
  { id: 'intermedio', etiqueta: 'Intermedio' },
  { id: 'experto', etiqueta: 'Experto' },
]

// Roles del sistema (US06) — ver Backend/roles.py. El orden acá es el orden
// en que aparecen en el selector.
const ROLES: { id: Rol; etiqueta: string; Icono: typeof ShieldCheck; color: string }[] = [
  { id: 'administrador', etiqueta: 'Administrador', Icono: ShieldCheck, color: 'var(--accent)' },
  { id: 'profesor', etiqueta: 'Profesor', Icono: GraduationCap, color: '#2563eb' },
  { id: 'estudiante', etiqueta: 'Estudiante', Icono: User, color: 'var(--ink-soft)' },
]

function infoRol(rol: Rol) {
  return ROLES.find((r) => r.id === rol) ?? ROLES[2]
}

// US07: "hace 3 días", "hace 2 meses"… para la columna de último acceso.
function haceCuanto(iso: string | null): string {
  if (!iso) return 'Nunca'
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `Hace ${dias} días`
  const meses = Math.floor(dias / 30)
  return meses < 12 ? `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}` : `Hace más de ${Math.floor(meses / 12)} ${meses < 24 ? 'año' : 'años'}`
}

const estiloCampo = { background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--ink)' }

// ============================================================
//  Gestión de usuarios y roles (US06): consultar, crear, actualizar,
//  eliminar/desactivar, asignar rol — restringido en el backend a
//  rol=administrador (admin.py).
// ============================================================
function Admin({ usuarioActualId, onVolver }: Props) {
  const [tema, setTema] = useState<Tema>('light')
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false)
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null)
  const [barriendo, setBarriendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    const temporizador = setTimeout(() => {
      setCargando(true)
      setError(null)
      listarUsuariosAdmin({ busqueda })
        .then((lista) => !cancelado && setUsuarios(lista))
        .catch((e) => !cancelado && setError(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios.'))
        .finally(() => !cancelado && setCargando(false))
    }, busqueda ? 300 : 0)
    return () => { cancelado = true; clearTimeout(temporizador) }
  }, [busqueda])

  function alCrear(u: UsuarioAdmin) {
    setUsuarios((actuales) => [u, ...actuales])
    setModalCrearAbierto(false)
  }

  function alActualizar(u: UsuarioAdmin) {
    setUsuarios((actuales) => actuales.map((x) => (x.id === u.id ? u : x)))
    setEditando(null)
  }

  async function alternarActivo(u: UsuarioAdmin) {
    setError(null)
    try {
      const actualizado = await actualizarUsuarioAdmin(u.id, { activo: !u.activo })
      alActualizar(actualizado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el usuario.')
    }
  }

  // US07 (#9): desactiva todas las cuentas inactivas de una vez.
  async function desactivarInactivos() {
    if (!confirm('¿Desactivar todas las cuentas que llevan demasiado tiempo sin ingresar? Los administradores no se ven afectados y puedes reactivarlas después.')) return
    setError(null)
    setAviso(null)
    setBarriendo(true)
    try {
      const r = await desactivarInactivosAdmin()
      setAviso(r.desactivados === 0
        ? `Ninguna cuenta supera los ${r.diasInactividad} días de inactividad.`
        : r.desactivados === 1
          ? `Se desactivó 1 cuenta con más de ${r.diasInactividad} días sin ingresar: ${r.correos[0]}.`
          : `Se desactivaron ${r.desactivados} cuentas con más de ${r.diasInactividad} días sin ingresar: ${r.correos.join(', ')}.`)
      setUsuarios(await listarUsuariosAdmin({ busqueda }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron desactivar las cuentas inactivas.')
    } finally {
      setBarriendo(false)
    }
  }

  async function eliminar(u: UsuarioAdmin) {
    if (!confirm(`¿Eliminar la cuenta de "${u.nombre}" (${u.email})? Esta acción no se puede deshacer.`)) return
    setError(null)
    try {
      await eliminarUsuarioAdmin(u.id)
      setUsuarios((actuales) => actuales.filter((x) => x.id !== u.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el usuario.')
    }
  }

  return (
    <TemaProvider tema={tema} className="min-h-screen" style={{ color: 'var(--ink)', background: 'linear-gradient(135deg,var(--bg1),var(--bg2))' }}>
      <header className="flex items-center gap-3 px-6 h-16 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={onVolver} className="grid place-items-center w-9 h-9 rounded-lg hover:bg-black/5 transition" title="Volver">
          <ArrowLeft size={18} />
        </button>
        <LogoWordmark height={28} />
        <span className="text-sm font-semibold ml-1">Administración</span>
        <button
          onClick={() => setTema((t) => (t === 'light' ? 'dark' : 'light'))}
          className="ml-auto grid place-items-center w-9 h-9 rounded-full panel hover:-translate-y-0.5 transition"
          title={tema === 'light' ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
        >
          {tema === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-soft)' }} />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o correo…"
              aria-label="Buscar usuarios"
              className="w-full rounded-xl pl-9 pr-3 py-2 text-sm outline-none"
              style={estiloCampo}
            />
          </div>
          <button
            onClick={desactivarInactivos}
            disabled={barriendo}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl panel text-sm font-medium hover:-translate-y-0.5 transition disabled:opacity-50"
            title="Desactivar las cuentas que superan el plazo de inactividad"
          >
            {barriendo ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />}
            Desactivar inactivos
          </button>
          <button
            onClick={() => setModalCrearAbierto(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl accent-bg text-white text-sm font-medium shadow hover:brightness-110 transition"
          >
            <Plus size={15} />
            Nuevo usuario
          </button>
        </div>

        {aviso && (
          <div role="status" className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: 'rgba(22,163,74,.1)', border: '1px solid rgba(22,163,74,.4)' }}>
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
            <span className="flex-1">{aviso}</span>
            <button onClick={() => setAviso(null)} className="grid place-items-center w-6 h-6 rounded hover:bg-black/5" title="Cerrar aviso"><X size={14} /></button>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl px-3 py-2 text-sm" style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.4)', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {cargando ? (
          <p className="text-sm text-center py-16 flex items-center justify-center gap-2" style={{ color: 'var(--ink-soft)' }}>
            <Loader2 size={15} className="animate-spin" /> Cargando usuarios…
          </p>
        ) : usuarios.length === 0 ? (
          <p className="text-sm text-center py-16" style={{ color: 'var(--ink-soft)' }}>
            {busqueda.trim() ? `Ningún usuario coincide con «${busqueda.trim()}».` : 'No hay usuarios registrados.'}
          </p>
        ) : (
          <div className="panel rounded-2xl overflow-hidden anim-fade-in">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--ink-soft)' }}>Usuario</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--ink-soft)' }}>Nivel</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--ink-soft)' }}>Rol</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--ink-soft)' }}>Estado</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--ink-soft)' }}>Último acceso</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--ink-soft)' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const esYoMismo = u.id === usuarioActualId
                  return (
                    <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{u.nombre}{esYoMismo && <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--ink-soft)' }}>(tú)</span>}</p>
                        <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{u.email}</p>
                      </td>
                      <td className="px-4 py-2.5 capitalize">{u.nivel}</td>
                      <td className="px-4 py-2.5">
                        {(() => {
                          const { etiqueta, Icono, color } = infoRol(u.rol)
                          return (
                            <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color }}>
                              <Icono size={13} /> {etiqueta}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={u.activo
                            ? { background: 'rgba(22,163,74,.12)', color: '#16a34a' }
                            : { background: 'rgba(220,38,38,.12)', color: '#dc2626' }}
                        >
                          {u.activo ? 'Activo' : 'Desactivado'}
                        </span>
                        {!u.activo && u.desactivadoPorInactividad && (
                          <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>por inactividad</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--ink-soft)' }} title={u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString('es-CO') : undefined}>
                        {haceCuanto(u.ultimoAcceso)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditando(u)} className="grid place-items-center w-7 h-7 rounded-lg hover:bg-black/5 transition" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => alternarActivo(u)}
                            disabled={esYoMismo && u.activo}
                            className="grid place-items-center w-7 h-7 rounded-lg hover:bg-black/5 transition disabled:opacity-30"
                            title={esYoMismo && u.activo ? 'No puedes desactivar tu propia cuenta' : u.activo ? 'Desactivar' : 'Activar'}
                          >
                            {u.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                          <button
                            onClick={() => eliminar(u)}
                            disabled={esYoMismo}
                            className="grid place-items-center w-7 h-7 rounded-lg hover:bg-black/5 transition disabled:opacity-30"
                            style={{ color: '#dc2626' }}
                            title={esYoMismo ? 'No puedes eliminar tu propia cuenta' : 'Eliminar'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {modalCrearAbierto && <ModalUsuario onCerrar={() => setModalCrearAbierto(false)} onGuardado={alCrear} />}
      {editando && (
        <ModalUsuario
          usuario={editando}
          esUnoMismo={editando.id === usuarioActualId}
          onCerrar={() => setEditando(null)}
          onGuardado={alActualizar}
        />
      )}
    </TemaProvider>
  )
}

// Modal único para crear (sin `usuario`) y editar (con `usuario`) — los
// campos y validaciones son casi idénticos, y mantenerlos en un solo
// formulario evita que las dos rutas se desincronicen con el tiempo.
function ModalUsuario({ usuario, esUnoMismo, onCerrar, onGuardado }: {
  usuario?: UsuarioAdmin
  esUnoMismo?: boolean
  onCerrar: () => void
  onGuardado: (u: UsuarioAdmin) => void
}) {
  const editando = !!usuario
  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [contrasena, setContrasena] = useState('')
  const [nivel, setNivel] = useState<Nivel>(usuario?.nivel ?? 'basico')
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? 'estudiante')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nombreValido = nombre.trim().length > 0
  const emailValido = email.trim().length > 3
  const contrasenaValida = editando || contrasena.length >= 12

  async function enviar() {
    setError(null)
    if (!nombreValido || !emailValido || !contrasenaValida) {
      setError('Revisa los campos marcados.')
      return
    }
    setGuardando(true)
    try {
      const resultado = editando
        ? await actualizarUsuarioAdmin(usuario!.id, { nombre: nombre.trim(), email: email.trim(), nivel, rol })
        : await crearUsuarioAdmin({ nombre: nombre.trim(), email: email.trim(), contrasena, nivel, rol })
      onGuardado(resultado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el usuario.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center p-4" style={{ background: 'rgba(0,0,0,.5)' }} onClick={onCerrar}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); enviar() }}
        className="panel rounded-2xl anim-slide-up p-6 w-full max-w-sm space-y-3"
        aria-label={editando ? 'Editar usuario' : 'Nuevo usuario'}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{editando ? 'Editar usuario' : 'Nuevo usuario'}</p>
          <button type="button" onClick={onCerrar} className="grid place-items-center w-7 h-7 rounded-lg hover:bg-black/5" title="Cerrar">
            <X size={16} />
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>Nombre</span>
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={estiloCampo} />
        </label>

        <label className="block space-y-1">
          <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>Correo institucional</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={estiloCampo} />
        </label>

        {!editando && (
          <label className="block space-y-1">
            <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>Contraseña inicial (mín. 12 caracteres)</span>
            <input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} maxLength={128}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={estiloCampo} />
          </label>
        )}

        <label className="block space-y-1">
          <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>Nivel</span>
          <select value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={estiloCampo}>
            {NIVELES.map((n) => <option key={n.id} value={n.id}>{n.etiqueta}</option>)}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>Rol</span>
          <select
            value={rol}
            disabled={esUnoMismo && rol === 'administrador'}
            onChange={(e) => setRol(e.target.value as Rol)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none disabled:opacity-60"
            style={estiloCampo}
          >
            {ROLES.map((r) => <option key={r.id} value={r.id}>{r.etiqueta}</option>)}
          </select>
          {esUnoMismo && rol === 'administrador' && (
            <span className="block text-xs" style={{ color: 'var(--ink-soft)' }}>No puedes quitarte a ti mismo el rol de administrador.</span>
          )}
        </label>

        {error && <p role="alert" className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}

        <button
          type="submit"
          disabled={!nombreValido || !emailValido || !contrasenaValida || guardando}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl accent-bg text-white text-sm font-medium shadow hover:brightness-110 disabled:opacity-40 transition"
        >
          {guardando && <Loader2 size={14} className="animate-spin" />}
          {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear usuario'}
        </button>
      </form>
    </div>
  )
}

export default Admin
