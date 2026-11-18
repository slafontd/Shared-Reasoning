import { useState } from 'react'

// Gráficos de barras sin dependencias, de una sola serie (un color: el
// acento del tema). Marcas finas, extremo redondeado de 4 px, cuadrícula
// recesiva, tooltip al pasar el mouse o al enfocar con teclado. Cada gráfico
// admite una tabla equivalente (ver TablaDatos) para no depender del hover.

export type Barra = { etiqueta: string; valor: number; detalle: string }

// Escalón "redondo" (1, 2, 5 × 10^n, nunca menor que 1: son conteos) para que
// el eje muestre enteros limpios y el techo sea múltiplo de ese escalón.
function escalaLimpia(max: number) {
  const bruto = Math.max(max, 1) / 4
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const m = bruto / potencia
  const paso = Math.max(1, (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * potencia)
  const techo = paso * Math.max(Math.ceil(max / paso), 2)
  return { techo, ticks: Array.from({ length: techo / paso + 1 }, (_, k) => k * paso) }
}

function barraRedondeada(x: number, base: number, ancho: number, alto: number, r = 4) {
  if (alto <= 0) return ''
  const radio = Math.min(r, alto, ancho / 2)
  return `M${x},${base} V${base - alto + radio} a${radio},${radio} 0 0 1 ${radio},${-radio} H${x + ancho - radio} a${radio},${radio} 0 0 1 ${radio},${radio} V${base} Z`
}

function Tooltip({ left, top, texto }: { left: string; top: string; texto: string }) {
  return (
    <div
      role="tooltip"
      className="absolute z-10 pointer-events-none px-2 py-1 rounded-lg text-xs shadow-lg whitespace-nowrap anim-popover"
      style={{ left, top, transform: 'translate(-50%, calc(-100% - 6px))', background: 'var(--ink)', color: 'var(--bg2)' }}
    >
      {texto}
    </div>
  )
}

// ---------- Columnas (series por día u hora) ----------
export function GraficoColumnas({ barras, titulo, alto = 190, cadaN }: {
  barras: Barra[]
  titulo: string
  alto?: number
  // Cada cuántas columnas se rotula el eje X (por defecto, lo justo para que no se pisen).
  cadaN?: number
}) {
  const [activa, setActiva] = useState<{ i: number; x: number; y: number } | null>(null)
  const ancho = 720
  const margen = { izq: 34, der: 8, sup: 10, inf: 22 }
  const graf = { w: ancho - margen.izq - margen.der, h: alto - margen.sup - margen.inf }
  const { techo, ticks } = escalaLimpia(Math.max(0, ...barras.map((b) => b.valor)))
  const slot = graf.w / Math.max(barras.length, 1)
  const grosor = Math.min(24, slot * 0.7)
  const salto = cadaN ?? Math.max(1, Math.ceil(barras.length / 10))
  const base = margen.sup + graf.h

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full h-auto" role="img" aria-label={titulo}>
        {ticks.map((t) => {
          const y = base - (t / techo) * graf.h
          return (
            <g key={t}>
              <line x1={margen.izq} x2={ancho - margen.der} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
              <text x={margen.izq - 6} y={y + 3} textAnchor="end" fontSize={10} fill="var(--ink-soft)">{t}</text>
            </g>
          )
        })}
        {barras.map((b, i) => {
          const x0 = margen.izq + i * slot + (slot - grosor) / 2
          const h = (b.valor / techo) * graf.h
          const activo = activa?.i === i
          return (
            <g key={i}>
              {i % salto === 0 && (
                <text x={margen.izq + i * slot + slot / 2} y={alto - 6} textAnchor="middle" fontSize={10} fill="var(--ink-soft)">{b.etiqueta}</text>
              )}
              <path d={barraRedondeada(x0, base, grosor, h)} fill="var(--accent)" opacity={activa && !activo ? 0.55 : 1} style={{ transition: 'opacity .15s' }} />
              {/* Zona de hover/foco más ancha que la marca. */}
              <rect
                x={margen.izq + i * slot} y={margen.sup} width={slot} height={graf.h + 4} fill="transparent"
                tabIndex={0}
                aria-label={`${b.etiqueta}: ${b.detalle}`}
                onPointerEnter={() => setActiva({ i, x: ((margen.izq + i * slot + slot / 2) / ancho) * 100, y: base - h })}
                onPointerLeave={() => setActiva(null)}
                onFocus={() => setActiva({ i, x: ((margen.izq + i * slot + slot / 2) / ancho) * 100, y: base - h })}
                onBlur={() => setActiva(null)}
                style={{ outline: 'none' }}
              />
              {activo && <line x1={margen.izq + i * slot + slot / 2} x2={margen.izq + i * slot + slot / 2} y1={margen.sup} y2={base} stroke="var(--ink-soft)" strokeWidth={1} opacity={0.35} />}
            </g>
          )
        })}
      </svg>
      {activa && (
        <Tooltip left={`${activa.x}%`} top={`${(activa.y / alto) * 100}%`} texto={`${barras[activa.i].etiqueta} · ${barras[activa.i].detalle}`} />
      )}
    </div>
  )
}

// ---------- Barras horizontales (categorías, ya ordenadas) ----------
export function GraficoBarras({ barras, titulo }: { barras: { etiqueta: string; valor: number }[]; titulo: string }) {
  const max = Math.max(1, ...barras.map((b) => b.valor))
  return (
    <ul className="space-y-2" aria-label={titulo}>
      {barras.map((b) => (
        <li key={b.etiqueta} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 text-sm">
          <span className="truncate" title={b.etiqueta}>{b.etiqueta}</span>
          <span className="h-3 rounded-full" style={{ background: 'var(--bg1)' }}>
            <span
              className="block h-full rounded-full anim-progress"
              style={{ width: `${(b.valor / max) * 100}%`, background: 'var(--accent)', minWidth: b.valor > 0 ? 6 : 0 }}
            />
          </span>
          <span className="text-right tabular-nums font-medium">{b.valor}</span>
        </li>
      ))}
    </ul>
  )
}
