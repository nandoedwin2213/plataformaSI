import type { Estrategia, Evaluacion, Resultado } from '../domain/types'
import { barraNivel, colorNivel, etiquetaHorizonte, etiquetaNivel } from '../domain/catalogos'

interface Props {
  evaluacion: Evaluacion
  resultado: Resultado
  onGuardar: () => void
  guardado: boolean
}

const ordenHorizonte: Estrategia['horizonte'][] = ['inmediato', 'previo_vuelo', 'post_vuelo', 'organizacional']

export function PanelResultado({ evaluacion, resultado, onGuardar, guardado }: Props) {
  const maximoContribuyente = Math.max(...resultado.contribuyentes.map((c) => c.puntos), 1)
  const datosPerfil = [
    resultado.edad !== null ? `${resultado.edad} años` : null,
    resultado.imc !== null ? `IMC ${resultado.imc}` : null,
    evaluacion.funcionPrincipal || null,
    evaluacion.cargoAdicional ? `+ ${evaluacion.cargoAdicional}` : null,
    `${evaluacion.horasLaboralesDiarias} h laborales/día`,
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <section className={`card border-2 ${colorNivel[resultado.nivel]}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider">Diagnóstico de fatiga</p>
            <h2 className="text-2xl font-extrabold">{etiquetaNivel[resultado.nivel]}</h2>
            <p className="mt-1 text-sm">
              {evaluacion.grado} {evaluacion.piloto || '(sin identificar)'} ·{' '}
              {evaluacion.unidad || 'Unidad no indicada'} · {evaluacion.fecha}
            </p>
            <p className="mt-1 text-xs">{datosPerfil.join(' · ')}</p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-black leading-none">{resultado.puntaje}</p>
            <p className="text-xs font-semibold uppercase">Índice de riesgo / 100</p>
          </div>
        </div>
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${barraNivel[resultado.nivel]}`}
            style={{ width: `${resultado.puntaje}%` }}
          />
        </div>
        <p className="mt-4 text-sm font-medium">{resultado.aptitud}</p>
        <div className="mt-4 flex flex-wrap gap-3 no-print">
          <button className="btn-primary" onClick={onGuardar} disabled={guardado}>
            {guardado ? 'Guardado en el historial' : 'Guardar en el historial'}
          </button>
          <button className="btn-ghost" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
        </div>
      </section>

      <section className="card">
        <h3 className="section-title">Factores que más contribuyen</h3>
        <ul className="space-y-3">
          {resultado.contribuyentes.map((contribuyente) => (
            <li key={contribuyente.factor}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium text-slate-300">{contribuyente.factor}</span>
                <span className="text-sm font-semibold text-cyan-200">
                  {contribuyente.puntos}/{contribuyente.maximo} pts
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-500"
                  style={{ width: `${(contribuyente.puntos / maximoContribuyente) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">{contribuyente.detalle}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3 className="section-title">Estrategias de mitigación</h3>
        <div className="space-y-6">
          {ordenHorizonte.map((horizonte) => {
            const grupo = resultado.estrategias.filter((estrategia) => estrategia.horizonte === horizonte)
            if (grupo.length === 0) return null
            return (
              <div key={horizonte}>
                <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-cyan-300">
                  {etiquetaHorizonte[horizonte]}
                </h4>
                <ul className="space-y-3">
                  {grupo.map((estrategia) => (
                    <li key={estrategia.titulo} className="rounded-lg border border-white/10 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-100">{estrategia.titulo}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                            estrategia.prioridad === 'alta'
                              ? 'bg-red-100 text-red-700'
                              : estrategia.prioridad === 'media'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-white/10 text-slate-400'
                          }`}
                        >
                          Prioridad {estrategia.prioridad}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{estrategia.descripcion}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
