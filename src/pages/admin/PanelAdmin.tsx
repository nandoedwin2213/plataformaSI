import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import {
  colorNivelRiesgo,
  etiquetaNivelRiesgo,
  type NivelRiesgo,
  type ResumenPoblacional,
} from '../../domain/riesgo'

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: number | string; detalle?: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase text-slate-400">{titulo}</p>
      <p className="mt-1 text-3xl font-bold text-amber-300">{valor}</p>
      {detalle && <p className="text-xs text-slate-500">{detalle}</p>}
    </div>
  )
}

// Gráfico de barras mínimo: evita dependencias nuevas y se mantiene legible con 30 puntos.
function Tendencia({ datos }: { datos: ResumenPoblacional['tendencia'] }) {
  if (datos.length === 0) return <p className="text-sm text-slate-400">Sin mediciones en los últimos 30 días.</p>
  const maximo = Math.max(...datos.map((punto) => punto.promedio), 1)
  return (
    <div className="flex h-32 items-end gap-1">
      {datos.map((punto) => (
        <div
          key={punto.dia}
          className="flex-1 rounded-t bg-amber-500/40"
          style={{ height: `${Math.max(4, (punto.promedio / maximo) * 100)}%` }}
          title={`${punto.dia}: índice medio ${punto.promedio} · ${punto.mediciones} mediciones · ${punto.elevados} elevadas`}
        />
      ))}
    </div>
  )
}

export function PanelAdmin() {
  const [resumen, setResumen] = useState<ResumenPoblacional | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void api
      .panelResumen()
      .then(setResumen)
      .catch((fallo: unknown) =>
        setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar el panel'),
      )
  }, [])

  if (error) return <p className="card text-sm text-red-400">{error}</p>
  if (!resumen) return <p className="card text-sm text-slate-400">Cargando panel poblacional…</p>

  const niveles: NivelRiesgo[] = ['bajo', 'moderado', 'alto', 'critico']
  const alertas = Object.values(resumen.alertasAbiertas).reduce((total, valor) => total + (valor ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Vigilancia poblacional de fatiga</h1>
        <p className="mt-1 text-sm text-slate-400">
          Corte del {resumen.fecha}. Las cifras se agregan en base de datos; el listado de personal se
          consulta paginado.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          titulo="Personal registrado"
          valor={resumen.personal}
          detalle={`${resumen.personalActivo} activos`}
        />
        <Indicador
          titulo="Aplicaciones (7 días)"
          valor={resumen.aplicaciones7d}
          detalle={`${resumen.aplicaciones} acumuladas · ${resumen.enCurso} en curso`}
        />
        <Indicador
          titulo="Adherencia 7 días"
          valor={`${resumen.adherencia7d}%`}
          detalle={`${resumen.sinEvaluar7d} sin evaluación reciente`}
        />
        <Indicador
          titulo="Alertas abiertas"
          valor={alertas}
          detalle={`${resumen.alertasAbiertas.alta ?? 0} de severidad alta`}
        />
      </div>

      <section className="card">
        <h2 className="section-title">Distribución por nivel de riesgo integrado</h2>
        <div className="flex flex-wrap gap-3">
          {niveles.map((nivel) => (
            <Link
              key={nivel}
              to={`/admin/poblacion?nivel=${nivel}`}
              className={`rounded px-3 py-2 text-sm ${colorNivelRiesgo[nivel]}`}
            >
              {etiquetaNivelRiesgo[nivel]}: <strong>{resumen.distribucion[nivel] ?? 0}</strong>
            </Link>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {resumen.senales.deterioro} en deterioro · {resumen.senales.persistentes} con riesgo persistente ·{' '}
          {resumen.senales.recuperacion} en recuperación · {resumen.senales.confianzaBaja} con confianza baja
        </p>
      </section>

      <section className="card">
        <h2 className="section-title">Evolución del índice integrado (30 días)</h2>
        <Tendencia datos={resumen.tendencia} />
      </section>

      <section className="card">
        <h2 className="section-title">Resultados por instrumento</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Instrumento</th>
              <th>Frecuencia</th>
              <th>Aplicaciones</th>
              <th>Últimos 7 días</th>
              <th>Evaluados 7 días</th>
              <th>Promedio 30 días</th>
            </tr>
          </thead>
          <tbody>
            {resumen.instrumentos.map((instrumento) => (
              <tr key={instrumento.clave} className="border-t border-white/5">
                <td className="py-2 text-slate-300">{instrumento.nombre}</td>
                <td className="text-slate-400">cada {instrumento.frecuenciaDias} días</td>
                <td className="text-slate-400">{instrumento.aplicaciones}</td>
                <td className="text-slate-400">{instrumento.aplicaciones7d}</td>
                <td className="text-slate-400">{instrumento.evaluados7d}</td>
                <td className="text-slate-200">
                  {instrumento.promedio30d === null ? '—' : `${instrumento.promedio30d}/100`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="section-title">Accesos rápidos</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/poblacion" className="btn-ghost">
            Personal evaluado
          </Link>
          <Link to="/admin/alertas" className="btn-ghost">
            Alertas
          </Link>
          <Link to="/admin/modelo" className="btn-ghost">
            Modelo de riesgo
          </Link>
          <Link to="/admin/tests" className="btn-ghost">
            Instrumentos
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {resumen.fichasIncompletas} fichas incompletas · {resumen.registrosHoy} registros diarios hoy
        </p>
      </section>
    </div>
  )
}
