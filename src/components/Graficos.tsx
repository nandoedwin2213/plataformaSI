interface PuntoSerie {
  etiqueta: string
  valor: number
}

export function LineaTendencia({
  datos,
  proyeccion = [],
  alto = 120,
}: {
  datos: PuntoSerie[]
  proyeccion?: PuntoSerie[]
  alto?: number
}) {
  if (datos.length === 0) {
    return <p className="text-sm text-slate-400">Sin datos suficientes para graficar.</p>
  }

  const ancho = 100
  const maximo = 100
  const totales = datos.length + proyeccion.length
  const paso = totales > 1 ? ancho / (totales - 1) : 0
  const coordenada = (punto: PuntoSerie, indice: number) =>
    `${indice * paso},${alto - (punto.valor / maximo) * alto}`
  const puntos = datos.map(coordenada).join(' ')
  const puntosProyectados =
    proyeccion.length > 0
      ? [
          coordenada(datos[datos.length - 1], datos.length - 1),
          ...proyeccion.map((punto, indice) => coordenada(punto, datos.length + indice)),
        ].join(' ')
      : ''

  return (
    <div>
      <svg viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" className="h-32 w-full">
        {[25, 50, 75].map((linea) => (
          <line
            key={linea}
            x1={0}
            x2={ancho}
            y1={alto - (linea / maximo) * alto}
            y2={alto - (linea / maximo) * alto}
            stroke="currentColor"
            className="text-white/10"
            strokeWidth={0.5}
          />
        ))}
        <polyline
          points={puntos}
          fill="none"
          stroke="currentColor"
          className="text-cyan-400"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        {puntosProyectados && (
          <polyline
            points={puntosProyectados}
            fill="none"
            stroke="currentColor"
            className="text-fuchsia-400"
            strokeWidth={1.5}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {datos.map((punto, indice) => (
          <circle
            key={punto.etiqueta}
            cx={indice * paso}
            cy={alto - (punto.valor / maximo) * alto}
            r={1.2}
            className="fill-cyan-300"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{datos[0]?.etiqueta}</span>
        <span>{(proyeccion[proyeccion.length - 1] ?? datos[datos.length - 1])?.etiqueta}</span>
      </div>
    </div>
  )
}

export function BarrasHorizontales({ datos }: { datos: PuntoSerie[] }) {
  const maximo = Math.max(...datos.map((punto) => punto.valor), 1)
  return (
    <ul className="space-y-2">
      {datos.map((punto) => (
        <li key={punto.etiqueta}>
          <div className="flex justify-between text-xs text-slate-300">
            <span>{punto.etiqueta}</span>
            <span className="font-semibold text-cyan-300">{punto.valor}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-400"
              style={{ width: `${(punto.valor / maximo) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function MapaCalor({ datos }: { datos: { fecha: string; valor: number | null }[] }) {
  const color = (valor: number | null) => {
    if (valor === null) return 'bg-white/5'
    if (valor >= 60) return 'bg-red-500/80'
    if (valor >= 40) return 'bg-orange-500/80'
    if (valor >= 20) return 'bg-amber-400/80'
    return 'bg-emerald-500/80'
  }

  return (
    <div className="flex flex-wrap gap-1">
      {datos.map((dia) => (
        <div
          key={dia.fecha}
          title={`${dia.fecha}: ${dia.valor ?? 'sin registro'}`}
          className={`h-6 w-6 rounded ${color(dia.valor)}`}
        />
      ))}
    </div>
  )
}
