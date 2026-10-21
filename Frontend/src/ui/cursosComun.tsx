import { useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'

export function fechaLegible(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function EtiquetaCodigo({ codigo }: { codigo: string }) {
  return (
    <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-mono" style={{ background: 'var(--bg1)', color: 'var(--ink-soft)' }}>
      {codigo}
    </span>
  )
}

export function EtiquetaInscrito() {
  return (
    <span className="w-fit flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(22,163,74,.12)', color: '#15803d' }}>
      <Check size={12} /> Inscrito
    </span>
  )
}

// US12: el código que el profesor comparte con sus estudiantes. Solo llega
// del backend para quien creó el curso o un administrador.
export function CodigoAcceso({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // Sin permiso de portapapeles: el código igual queda a la vista.
    }
  }

  return (
    <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--bg1)', border: '1px dashed var(--border)' }}>
      <KeyRound size={18} style={{ color: 'var(--accent)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>Código de acceso · compártelo con tus estudiantes</p>
        <p className="font-mono text-lg font-semibold tracking-[0.2em]" data-testid="codigo-acceso">{codigo}</p>
      </div>
      <button onClick={copiar} className="grid place-items-center w-8 h-8 rounded-lg hover:bg-black/5 transition" title="Copiar código">
        {copiado ? <Check size={16} style={{ color: '#16a34a' }} /> : <Copy size={16} />}
      </button>
    </div>
  )
}
