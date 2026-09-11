import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import {
  colorNivelRiesgo,
  etiquetaDominio,
  etiquetaNivelRiesgo,
  type DetallePersona,
} from '../../domain/riesgo'

export function DetalleEvaluado() {
  const { id } = useParams()
  const [datos, setDatos] = useState<DetallePersona | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    void api
      .panelPersona(id)
      .then(setDatos)
      .catch((fallo: unknown) =>
        setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar el detalle'),
      )
  }, [id])

  if (error) return <p className="card text-sm text-red-400">{error}</p>
  if (!datos) return <p className="card text-sm text-slate-400">Cargando detalle…</p>

  const { persona, resultado } = datos

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/poblacion" className="text-xs text-cyan-400 hover:underline">
          ← Personal evaluado
        </Link>
        <h1 className="mt-1 text-xl font-bold text-white">
          {persona.grado} {persona.nombre}
        </h1>
        <p className="text-sm text-slate-400">
          {persona.unidad} · {persona.correo} · {persona.activo ? 'Activo' : 'Inactivo'}
        </p>
      </div>

      <section className="card space-y-3">
        <h2 className="section-title">Índice integrado</h2>
        {!resultado ? (
          <p className="text-sm text-slate-400">Esta persona todavía no tiene un resultado calculado.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-4xl font-bold text-white">{resultado.puntaje}</p>
              <span className={`rounded px-2 py-1 text-sm ${colorNivelRiesgo[resultado.nivel]}`}>
                {etiquetaNivelRiesgo[resultado.nivel]}
              </span>
              <span className="text-xs text-slate-500">
                Modelo v{resultado.versionModelo} · confianza {resultado.confianza} · cobertura{' '}
                {Math.round(resultado.cobertura * 100)}% · {resultado.calculadoEn.slice(0, 16).replace('T', ' ')}
              </span>
            </div>
            <ul className="space-y-1 text-xs text-slate-400">
              {datos.explicacion.map((linea) => (
                <li key={linea}>· {linea}</li>
              ))}
            </ul>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Dominio</th>
                  <th>Medición</th>
                  <th>Peso efectivo</th>
                  <th>Aporte</th>
                  <th>Línea base</th>
                </tr>
              </thead>
              <tbody>
                {resultado.componentes.map((componente) => (
                  <tr key={componente.dominio} className="border-t border-white/5">
                    <td className="py-2 text-slate-300">
                      {etiquetaDominio[componente.dominio] ?? componente.nombre}
                    </td>
                    <td className="text-slate-200">
                      {componente.vigente ? `${Math.round(componente.normalizado)}/100` : 'Sin vigencia'}
                    </td>
                    <td className="text-slate-400">{Math.round(componente.pesoEfectivo * 100)}%</td>
                    <td className="text-slate-400">{componente.aporte}</td>
                    <td className="text-slate-400">
                      {datos.lineasBase[componente.dominio]
                        ? `${Math.round(datos.lineasBase[componente.dominio].media)} (n=${datos.lineasBase[componente.dominio].n}${datos.lineasBase[componente.dominio].provisional ? ', provisional' : ''})`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">Últimas aplicaciones por instrumento</h2>
        {datos.aplicaciones.length === 0 ? (
          <p className="text-sm text-slate-400">Sin aplicaciones finalizadas.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Instrumento</th>
                <th>Puntaje</th>
                <th>Normalizado</th>
                <th>Interpretación</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {datos.aplicaciones.map((aplicacion) => (
                <tr key={`${aplicacion.clave}-${aplicacion.fecha}`} className="border-t border-white/5">
                  <td className="py-2 text-slate-300">{aplicacion.nombre}</td>
                  <td className="text-slate-200">{aplicacion.puntaje}</td>
                  <td className="text-slate-400">
                    {aplicacion.normalizado === null ? '—' : `${Math.round(aplicacion.normalizado)}/100`}
                  </td>
                  <td className="text-slate-400">{aplicacion.interpretacion}</td>
                  <td className="text-slate-500">{aplicacion.fecha.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">Historial longitudinal</h2>
        {datos.historial.length === 0 ? (
          <p className="text-sm text-slate-400">Sin historial.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-300">
            {datos.historial.map((punto) => (
              <li key={punto.fecha} className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{punto.fecha.slice(0, 16).replace('T', ' ')}</span>
                <span>{punto.puntaje}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${colorNivelRiesgo[punto.nivel]}`}>
                  {etiquetaNivelRiesgo[punto.nivel]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {datos.alertas.length > 0 && (
        <section className="card">
          <h2 className="section-title">Alertas</h2>
          <ul className="space-y-2 text-sm text-slate-300">
            {datos.alertas.map((alerta) => (
              <li key={alerta.id}>
                <span className="text-xs uppercase text-slate-500">{alerta.severidad}</span> — {alerta.motivo}{' '}
                <span className="text-xs text-slate-500">({alerta.estado})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {datos.estrategias.length > 0 && (
        <section className="card space-y-2">
          <h2 className="section-title">Estrategias sugeridas</h2>
          {datos.estrategias.map((estrategia) => (
            <div key={estrategia.id}>
              <p className="text-sm font-semibold text-slate-200">{estrategia.titulo}</p>
              <p className="text-xs text-slate-400">{estrategia.descripcion}</p>
              {estrategia.requiereValidacion && (
                <p className="text-[11px] text-amber-300">Pendiente de validación institucional.</p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
