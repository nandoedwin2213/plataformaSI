import type { RegistroHistorial } from '../domain/types'
import { colorNivel, etiquetaNivel } from '../domain/catalogos'
import { descargarArchivo, historialACsv } from '../lib/almacenamiento'

interface Props {
  registros: RegistroHistorial[]
  onEliminar: (id: string) => void
}

export function Historial({ registros, onEliminar }: Props) {
  if (registros.length === 0) {
    return (
      <div className="card text-sm text-slate-400">
        Aún no hay evaluaciones guardadas. Calcula un diagnóstico y guárdalo para construir el historial del
        escuadrón.
      </div>
    )
  }

  const promedio = Math.round(
    registros.reduce((suma, registro) => suma + registro.resultado.puntaje, 0) / registros.length,
  )
  const enRiesgo = registros.filter(
    (registro) => registro.resultado.nivel === 'alto' || registro.resultado.nivel === 'critico',
  ).length

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Evaluaciones</p>
          <p className="text-3xl font-bold text-cyan-200">{registros.length}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Índice promedio</p>
          <p className="text-3xl font-bold text-cyan-200">{promedio}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Riesgo alto o crítico</p>
          <p className="text-3xl font-bold text-cyan-200">{enRiesgo}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 no-print">
        <button
          className="btn-ghost"
          onClick={() =>
            descargarArchivo('historial-fatiga.csv', historialACsv(registros), 'text/csv;charset=utf-8')
          }
        >
          Exportar CSV
        </button>
        <button
          className="btn-ghost"
          onClick={() =>
            descargarArchivo(
              'historial-fatiga.json',
              JSON.stringify(registros, null, 2),
              'application/json',
            )
          }
        >
          Exportar JSON
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase text-slate-400">
              <th className="py-2 pr-4">Fecha</th>
              <th className="py-2 pr-4">Grado y nombre</th>
              <th className="py-2 pr-4">Unidad</th>
              <th className="py-2 pr-4">KSS</th>
              <th className="py-2 pr-4">S-P</th>
              <th className="py-2 pr-4">Índice</th>
              <th className="py-2 pr-4">Nivel</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {registros.map((registro) => (
              <tr key={registro.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-4">{registro.evaluacion.fecha}</td>
                <td className="py-2 pr-4">
                  {`${registro.evaluacion.grado ?? ''} ${registro.evaluacion.piloto}`.trim() || '—'}
                </td>
                <td className="py-2 pr-4">{registro.evaluacion.unidad || '—'}</td>
                <td className="py-2 pr-4">{registro.evaluacion.kss}</td>
                <td className="py-2 pr-4">{registro.evaluacion.samnPerelli}</td>
                <td className="py-2 pr-4 font-semibold">{registro.resultado.puntaje}</td>
                <td className="py-2 pr-4">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${colorNivel[registro.resultado.nivel]}`}
                  >
                    {etiquetaNivel[registro.resultado.nivel]}
                  </span>
                </td>
                <td className="py-2 text-right no-print">
                  <button
                    className="text-xs font-semibold text-red-600 hover:underline"
                    onClick={() => onEliminar(registro.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
