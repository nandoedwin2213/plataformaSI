import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import {
  colorNivelRiesgo,
  etiquetaDominio,
  etiquetaNivelRiesgo,
  type MiRiesgo as DatosRiesgo,
} from '../domain/riesgo'

const direccionTexto: Record<string, string> = {
  deterioro: 'Tendencia al deterioro',
  recuperacion: 'Tendencia a la recuperación',
  estable: 'Tendencia estable',
  sin_datos: 'Sin datos suficientes para estimar tendencia',
}

export function MiRiesgo() {
  const [datos, setDatos] = useState<DatosRiesgo | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void api
      .miRiesgo()
      .then(setDatos)
      .catch((fallo: unknown) =>
        setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar tu situación'),
      )
  }, [])

  if (error) return <p className="card text-sm text-red-400">{error}</p>
  if (!datos) return <p className="card text-sm text-slate-400">Cargando tu situación…</p>

  if (!datos.resultado) {
    return (
      <div className="card space-y-3 text-sm text-slate-400">
        <p>Todavía no hay un resultado integrado: completa al menos un instrumento.</p>
        <Link to="/pruebas" className="btn-primary inline-block">
          Ir a mis instrumentos
        </Link>
      </div>
    )
  }

  const { resultado } = datos

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Mi situación de fatiga</h1>
        <p className="mt-1 text-sm text-slate-400">
          Resultado integrado calculado con el modelo v{resultado.versionModelo} el{' '}
          {resultado.calculadoEn.slice(0, 10)}. Es una ayuda a la decisión, no un diagnóstico médico.
        </p>
      </div>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-4xl font-bold text-white">{resultado.puntaje}</p>
          <span className={`rounded px-2 py-1 text-sm ${colorNivelRiesgo[resultado.nivel]}`}>
            {etiquetaNivelRiesgo[resultado.nivel]}
          </span>
          <span className="text-xs text-slate-500">
            Confianza {resultado.confianza} · cobertura {Math.round(resultado.cobertura * 100)}%
          </span>
        </div>
        <p className="text-sm text-slate-300">{direccionTexto[resultado.tendencia.direccion]}</p>
        <ul className="space-y-1 text-xs text-slate-400">
          {datos.explicacion.map((linea) => (
            <li key={linea}>· {linea}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="section-title">Aporte de cada instrumento</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Dominio</th>
              <th>Medición</th>
              <th>Peso</th>
              <th>Aporte</th>
              <th>vs. línea base</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {resultado.componentes.map((componente) => (
              <tr key={componente.dominio} className="border-t border-white/5">
                <td className="py-2 text-slate-300">
                  {etiquetaDominio[componente.dominio] ?? componente.nombre}
                </td>
                <td className="text-slate-200">
                  {componente.vigente ? `${Math.round(componente.normalizado)}/100` : 'Sin medición vigente'}
                </td>
                <td className="text-slate-400">{Math.round(componente.pesoEfectivo * 100)}%</td>
                <td className="text-slate-400">{componente.aporte}</td>
                <td className="text-slate-400">
                  {componente.z === null ? '—' : `${componente.z > 0 ? '+' : ''}${componente.z} z`}
                </td>
                <td className="text-slate-500">{componente.fecha?.slice(0, 10) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {datos.estrategias.length > 0 && (
        <section className="card space-y-3">
          <h2 className="section-title">Estrategias de mitigación sugeridas</h2>
          {datos.estrategias.map((estrategia) => (
            <div key={estrategia.id} className="border-t border-white/5 pt-3 first:border-0 first:pt-0">
              <p className="text-sm font-semibold text-slate-200">{estrategia.titulo}</p>
              <p className="text-xs text-slate-400">{estrategia.descripcion}</p>
              {estrategia.acciones && <p className="mt-1 text-xs text-slate-400">{estrategia.acciones}</p>}
              <p className="mt-1 text-[11px] text-slate-500">
                {estrategia.reevaluarDias ? `Reevaluar en ${estrategia.reevaluarDias} días. ` : ''}
                {estrategia.requiereValidacion
                  ? 'Recomendación general pendiente de validación institucional.'
                  : ''}
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2 className="section-title">Evolución del índice integrado</h2>
        {datos.historial.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay historial suficiente.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Fecha</th>
                <th>Índice</th>
                <th>Nivel</th>
              </tr>
            </thead>
            <tbody>
              {datos.historial.map((punto) => (
                <tr key={punto.fecha} className="border-t border-white/5">
                  <td className="py-2 text-slate-400">{punto.fecha.slice(0, 16).replace('T', ' ')}</td>
                  <td className="text-slate-200">{punto.puntaje}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs ${colorNivelRiesgo[punto.nivel]}`}>
                      {etiquetaNivelRiesgo[punto.nivel]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
