import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import TemaProvider from './theme'
import { LogoWordmark } from './Logo'
import {
  registrar,
  login,
  verificarEmail,
  obtenerDominiosPermitidos,
  esCorreoInstitucional,
  textoDominios,
  type Usuario,
} from '../api/auth'

type Props = { onEntrar: (usuario: Usuario) => void }

// Login/registro conectados a /auth/registro y /auth/login (#84/#85).
function Auth({ onEntrar }: Props) {
  const [tab, setTab] = useState<'login' | 'registro'>('login')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [esperandoVerificacion, setEsperandoVerificacion] = useState(false)
  const [codigoVerificacion, setCodigoVerificacion] = useState('')
  const [correoPendiente, setCorreoPendiente] = useState('')
  // Dominios de correo institucional aceptados en registro e inicio de sesión.
  const [dominios, setDominios] = useState<string[]>(['eafit.edu.co'])

  useEffect(() => {
    obtenerDominiosPermitidos().then(setDominios)
  }, [])

  const inputClass =
    'w-full rounded-xl px-4 py-3 text-sm outline-none transition'

  async function enviar() {
    setError('')

    if (!email.trim() || !password) {
      setError('Completa correo y contraseña.')
      return
    }
    if (tab === 'registro' && !nombre.trim()) {
      setError('Completa tu nombre.')
      return
    }
    if (!esCorreoInstitucional(email, dominios)) {
      setError(`Usa tu correo institucional (${textoDominios(dominios)}).`)
      return
    }

    setCargando(true)
    try {
      if (tab === 'login') {
        const usuario = await login(email.trim(), password)
        onEntrar(usuario)
        return
      }

      const registro = await registrar(nombre.trim(), email.trim(), password)
      if (!registro.email_verificado && registro.codigo_verificacion) {
        setCorreoPendiente(registro.email)
        setEsperandoVerificacion(true)
        setError('Cuenta creada. Verifica tu correo con el código recibido para activar la cuenta.')
        return
      }

      const usuario = await login(email.trim(), password)
      onEntrar(usuario)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado.')
    } finally {
      setCargando(false)
    }
  }

  async function confirmarVerificacion() {
    if (!correoPendiente || !codigoVerificacion.trim()) {
      setError('Introduce el código de verificación.')
      return
    }

    setCargando(true)
    setError('')
    try {
      await verificarEmail(correoPendiente, codigoVerificacion.trim())
      const usuario = await login(correoPendiente, password)
      setEsperandoVerificacion(false)
      setCodigoVerificacion('')
      setCorreoPendiente('')
      onEntrar(usuario)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'El código de verificación no es válido.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <TemaProvider tema="light" className="min-h-screen" style={{ background: 'var(--bg1)', color: 'var(--ink)' }}>
      <div className="min-h-screen grid place-items-center p-6">
        <div
          className="w-full max-w-sm rounded-3xl p-8 shadow-xl"
          style={{ background: 'var(--bg2)' }}
        >
          <div className="flex justify-center mb-6">
            <LogoWordmark height={36} />
          </div>

          {/* Tabs */}
          <div className="flex rounded-full p-1 mb-6" style={{ background: 'var(--bg1)' }}>
            <button
              onClick={() => { setTab('login'); setError('') }}
              className="flex-1 py-2 rounded-full text-sm font-semibold transition"
              style={tab === 'login' ? { background: 'var(--accent)', color: 'var(--bg2)' } : { color: 'var(--ink-soft)' }}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => { setTab('registro'); setError('') }}
              className="flex-1 py-2 rounded-full text-sm font-semibold transition"
              style={tab === 'registro' ? { background: 'var(--accent)', color: 'var(--bg2)' } : { color: 'var(--ink-soft)' }}
            >
              Crear cuenta
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (esperandoVerificacion) {
                confirmarVerificacion()
              } else {
                enviar()
              }
            }}
            className="space-y-4"
          >
            {esperandoVerificacion ? (
              <>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--ink-soft)' }}>Código de verificación</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={codigoVerificacion}
                    onChange={(e) => setCodigoVerificacion(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={inputClass}
                    style={{ background: 'var(--bg1)', color: 'var(--ink)' }}
                    placeholder="123456"
                  />
                </div>
                <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                  Hemos creado la cuenta para {correoPendiente}. Introduce el código para activarla.
                </p>
              </>
            ) : (
              <>
                {tab === 'registro' && (
                  <div>
                    <label className="block text-sm mb-1.5" style={{ color: 'var(--ink-soft)' }}>Nombre</label>
                    <input
                      type="text"
                      autoComplete="name"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className={inputClass}
                      style={{ background: 'var(--bg1)', color: 'var(--ink)' }}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--ink-soft)' }}>Correo Electrónico</label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder={tab === 'registro' ? `tu.nombre@${dominios[0]}` : undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    style={{ background: 'var(--bg1)', color: 'var(--ink)' }}
                  />
                  {tab === 'registro' && (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--ink-soft)' }}>
                      Usa tu correo institucional ({textoDominios(dominios)}).
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--ink-soft)' }}>Contraseña</label>
                  <div className="relative">
                    <input
                      type={verPassword ? 'text' : 'password'}
                      autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-11`}
                      style={{ background: 'var(--bg1)', color: 'var(--ink)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setVerPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-6 h-6 hover:opacity-70 transition"
                      style={{ color: 'var(--ink-soft)' }}
                      title={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {tab === 'registro' && (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--ink-soft)' }}>
                      Mínimo 12 caracteres, con mayúscula, minúscula y número.
                    </p>
                  )}
                </div>
              </>
            )}

            {error && (
              <div
                className="rounded-xl px-3 py-2 text-sm flex items-start gap-2"
                role="alert"
                style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.4)', color: '#b91c1c' }}
              >
                <span>⚠️</span><span className="whitespace-pre-line">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full py-3 rounded-full font-bold shadow-lg hover:brightness-105 active:scale-[0.98] transition disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'var(--bg2)' }}
            >
              {cargando
                ? 'Un momento...'
                : esperandoVerificacion
                  ? 'Confirmar verificación'
                  : tab === 'login'
                    ? 'Entrar a la mesa de trabajo'
                    : 'Crear cuenta y entrar'}
            </button>
          </form>
        </div>
      </div>
    </TemaProvider>
  )
}

export default Auth
