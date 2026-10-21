import { useEffect, useState } from 'react'
import { Loader2, X, FileText } from 'lucide-react'

// Piezas compartidas por los enunciados (imágenes del ejercicio) y las
// soluciones (imágenes o PDF): todas exigen sesión, así que se descargan con
// el token y se muestran desde una URL de objeto que se libera al desmontar.

export type LimitesArchivos = { tipos: string; maxBytes: number; maxCantidad: number }

// Mismas reglas que el backend (ejercicios.py): el servidor las vuelve a
// validar, esto solo avisa antes de subir.
export function validarArchivos(nuevos: File[], yaHay: number, limites: LimitesArchivos): { validos: File[]; error: string | null } {
  const permitidos = limites.tipos.split(',')
  let error: string | null = null
  const validos: File[] = []
  for (const f of nuevos) {
    if (!permitidos.includes(f.type)) error = `«${f.name}» no es un tipo de archivo permitido.`
    else if (f.size > limites.maxBytes) error = `«${f.name}» supera los ${limites.maxBytes / (1024 * 1024)} MB.`
    else if (yaHay + validos.length >= limites.maxCantidad) error = `Máximo ${limites.maxCantidad} archivos.`
    else validos.push(f)
  }
  return { validos, error }
}

export function tamanoLegible(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type MiniaturaProps = {
  id: string
  nombre: string
  mime: string
  cargar: (id: string) => Promise<string>
  onAbrir: (url: string, nombre: string) => void
  // Solo para PDF (no se pueden mostrar en línea): lo descarga.
  onDescargar?: () => void
  onEliminar?: () => void
}

export function MiniaturaArchivo({ id, nombre, mime, cargar, onAbrir, onDescargar, onEliminar }: MiniaturaProps) {
  const esImagen = mime.startsWith('image/')
  const [url, setUrl] = useState<string | null>(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (!esImagen) return
    let cancelado = false
    let creada: string | null = null
    cargar(id)
      .then((u) => {
        if (cancelado) URL.revokeObjectURL(u)
        else { creada = u; setUrl(u) }
      })
      .catch(() => !cancelado && setFallo(true))
    return () => {
      cancelado = true
      if (creada) URL.revokeObjectURL(creada)
    }
  }, [id, esImagen, cargar])

  return (
    <div className="relative group w-24 h-24 rounded-lg overflow-hidden shrink-0 anim-fade-in" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      {esImagen ? (
        url ? (
          <button onClick={() => onAbrir(url, nombre)} className="w-full h-full block" title={`Ampliar ${nombre}`}>
            <img src={url} alt={nombre} className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="w-full h-full grid place-items-center text-[10px] text-center px-1" style={{ color: 'var(--ink-soft)' }}>
            {fallo ? 'No se pudo cargar' : <Loader2 size={14} className="animate-spin" />}
          </div>
        )
      ) : (
        <button onClick={onDescargar} className="w-full h-full flex flex-col items-center justify-center gap-1 px-1 text-center" title={`Descargar ${nombre}`}>
          <FileText size={22} style={{ color: 'var(--accent)' }} />
          <span className="text-[10px] leading-tight break-all line-clamp-2">{nombre}</span>
        </button>
      )}
      {onEliminar && (
        <button
          onClick={onEliminar}
          className="absolute top-1 right-1 grid place-items-center w-5 h-5 rounded-full text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
          style={{ background: 'rgba(0,0,0,.6)' }}
          title="Quitar"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

export function VisorImagen({ url, nombre, onCerrar }: { url: string; nombre: string; onCerrar: () => void }) {
  useEffect(() => {
    // En fase de captura y consumiendo el evento: la pantalla que lo abre
    // también puede escuchar Escape, y sin esto cerraría ambas de un solo golpe.
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCerrar()
    }
    window.addEventListener('keydown', alTeclear, true)
    return () => window.removeEventListener('keydown', alTeclear, true)
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 anim-popover" style={{ background: 'rgba(0,0,0,.8)' }} onClick={onCerrar} role="dialog" aria-label={nombre}>
      <button onClick={onCerrar} className="absolute top-4 right-4 grid place-items-center w-9 h-9 rounded-full text-white" style={{ background: 'rgba(255,255,255,.15)' }} title="Cerrar">
        <X size={18} />
      </button>
      <img src={url} alt={nombre} onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full rounded-lg object-contain" />
    </div>
  )
}
