import { useEffect, useState } from 'react'
import { ArrowLeft, Sun, Moon, Plus, X, Loader2, Search, ShieldCheck, GraduationCap, User, Trash2, Pencil, UserX, UserCheck } from 'lucide-react'
import TemaProvider, { type Tema } from './theme'
import { LogoWordmark } from './Logo'
import type { Nivel, Rol } from './tipos'
import {
  listarUsuariosAdmin, crearUsuarioAdmin, actualizarUsuarioAdmin, eliminarUsuarioAdmin,
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
            onClick={() => setModalCrearAbierto(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl accent-bg text-white text-sm font-medium shadow hover:brightness-110 transition"
          >
            <Plus size={15} />
            Nuevo usuario
          </button>
        </div>

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
          <div className="panel rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--ink-soft)' }}>Usuario</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--ink-soft)' }}>Nivel</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--ink-soft)' }}>Rol</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--ink-soft)' }}>Estado</th>
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
        className="panel rounded-2xl p-6 w-full max-w-sm space-y-3"
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
