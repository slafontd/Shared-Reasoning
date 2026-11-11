import type { Nivel, Rol } from '../ui/tipos'
import { fetchAutenticado } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Gestión de usuarios y roles (US06) por administrador — ver Backend/admin.py.
// Todas estas llamadas fallan con 403 si el usuario actual no es admin
// (requerir_admin); el front solo decide si MUESTRA la pantalla, nunca hace
// de gatekeeper real.
export type UsuarioAdmin = {
  id: string
  nombre: string
  email: string
  nivel: Nivel
  rol: Rol
  activo: boolean
  fechaRegistro: string
  // US07: última vez que la cuenta entró o usó la app, y si su desactivación
  // fue automática por inactividad (y no de un administrador).
  ultimoAcceso: string | null
  desactivadoPorInactividad: boolean
}

type UsuarioAdminAPI = {
  id: string
  nombre: string
  email: string
  nivel: Nivel
  rol: Rol
  activo: boolean
  fecha_registro: string
  ultimo_acceso?: string | null
  desactivado_por_inactividad?: boolean
}

function aUsuarioAdmin(u: UsuarioAdminAPI): UsuarioAdmin {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    nivel: u.nivel,
    rol: u.rol,
    activo: u.activo,
    fechaRegistro: u.fecha_registro,
    ultimoAcceso: u.ultimo_acceso ?? null,
    desactivadoPorInactividad: u.desactivado_por_inactividad ?? false,
  }
}

async function mensajeDeError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null)
  const detalle = data?.detail
  if (typeof detalle === 'string') return detalle
  if (Array.isArray(detalle)) {
    return detalle.map((e: { msg?: string }) => e.msg).filter(Boolean).join('; ') || res.statusText
  }
  return res.statusText || 'Error desconocido'
}

export async function listarUsuariosAdmin(opciones: { busqueda?: string } = {}): Promise<UsuarioAdmin[]> {
  const params = new URLSearchParams()
  if (opciones.busqueda?.trim()) params.set('busqueda', opciones.busqueda.trim())
  const res = await fetchAutenticado(`${API_URL}/admin/usuarios?${params}`)
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return ((await res.json()) as UsuarioAdminAPI[]).map(aUsuarioAdmin)
}

export async function crearUsuarioAdmin(datos: {
  nombre: string
  email: string
  contrasena: string
  nivel: Nivel
  rol: Rol
}): Promise<UsuarioAdmin> {
  const res = await fetchAutenticado(`${API_URL}/admin/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: datos.nombre,
      email: datos.email,
      contrasena: datos.contrasena,
      nivel: datos.nivel,
      rol: datos.rol,
    }),
  })
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return aUsuarioAdmin(await res.json())
}

export async function actualizarUsuarioAdmin(
  id: string,
  cambios: { nombre?: string; email?: string; nivel?: Nivel; rol?: Rol; activo?: boolean },
): Promise<UsuarioAdmin> {
  const res = await fetchAutenticado(`${API_URL}/admin/usuarios/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: cambios.nombre,
      email: cambios.email,
      nivel: cambios.nivel,
      rol: cambios.rol,
      activo: cambios.activo,
    }),
  })
  if (!res.ok) throw new Error(await mensajeDeError(res))
  return aUsuarioAdmin(await res.json())
}

export async function eliminarUsuarioAdmin(id: string): Promise<void> {
  const res = await fetchAutenticado(`${API_URL}/admin/usuarios/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await mensajeDeError(res))
}

// US07 (#9): desactiva de una vez todas las cuentas que superaron el plazo
// de inactividad (DIAS_INACTIVIDAD en el .env del backend).
export async function desactivarInactivosAdmin(): Promise<{ diasInactividad: number; desactivados: number; correos: string[] }> {
  const res = await fetchAutenticado(`${API_URL}/admin/usuarios/desactivar-inactivos`, { method: 'POST' })
  if (!res.ok) throw new Error(await mensajeDeError(res))
  const datos = await res.json()
  return { diasInactividad: datos.dias_inactividad, desactivados: datos.desactivados, correos: datos.correos }
}
