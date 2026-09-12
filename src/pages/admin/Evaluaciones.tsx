import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Instrumento, PaginaAplicaciones } from '../../domain/instrumentos'

const TAM = 25

export function EvaluacionesAdmin() {
  const [pagina, setPagina] = useState(1)
  const [instrumento, setInstrumento] = useState('')
  const [estado, setEstado] = useState<'' | 'borrador' | 'finalizada'>('')
  const [datos, setDatos] = useState<PaginaAplicaciones | null>(null)
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void api
      .instrumentosAdmin()
      .then(setInstrumentos)
      .catch(() => setInstrumentos([]))
  }, [])

  const cargar = useCallback(() => {
    // La consulta se resuelve y pagina en base de datos: el navegador nunca recibe el
    // histórico completo de aplicaciones de toda la población.
    void api
      .respuestasAdmin({ pagina, tam: TAM, instrumento, estado: estado || undefined })
      .then(setDatos)
      .catch((fallo: unknown) =>
        setError(fallo instanceof Error ? fallo.message : 'No se pudieron cargar las aplicaciones'),
      )
  }, [pagina, instrumento, estado])

  useEffect(cargar, [cargar])

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.tam)) : 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Evaluaciones y resultados</h1>
        <p className="mt-1 text-sm text-slate-400">
          Aplicaciones de todos los instrumentos, con su propio puntaje e interpretación.
        </p>
      </div>

      {error && <p className="card text-sm text-red-400">{error}</p>}

      <section className="card grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="instrumento">
            Instrumento
          </label>
          <select
            id="instrumento"
            className="input"
            value={instrumento}
            onChange={(evento) => {
              setInstrumento(evento.target.value)
              setPagina(1)
            }}
          >
            <option value="">Todos</option>
            {instrumentos.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="estado">
            Estado
          </label>
          <select
            id="estado"
            className="input"
            value={estado}
            onChange={(evento) => {
              setEstado(evento.target.value as '' | 'borrador' | 'finalizada')
              setPagina(1)
            }}
          >
            <option value="">Todos</option>
            <option value="finalizada">Finalizadas</option>
            <option value="borrador">En curso</option>
          </select>
        </div>
        <div className="flex items-end text-sm text-slate-400">
          {datos ? `${datos.total} aplicaciones registradas` : 'Cargando…'}
        </div>
      </section>

      <section className="card overflow-x-auto">
        {!datos || datos.aplicaciones.length === 0 ? (
          <p className="text-sm text-slate-400">No hay aplicaciones con estos filtros.</p>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Personal</th>
                  <th>Instrumento</th>
                  <th>Estado</th>
                  <th>Puntaje</th>
                  <th>Interpretación</th>
                  <th>Actualizado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {datos.aplicaciones.map((aplicacion) => (
                  <tr key={aplicacion.id} className="border-t border-white/5">
                    <td className="py-2 text-slate-300">{aplicacion.persona}</td>
                    <td className="text-slate-400">{aplicacion.instrumentoNombre}</td>
                    <td className="text-slate-400">
                      {aplicacion.estado === 'finalizada' ? 'Finalizada' : 'En curso'}
                    </td>
                    <td className="text-slate-200">{aplicacion.puntaje ?? '—'}</td>
                    <td className="text-xs text-slate-400">{aplicacion.interpretacion}</td>
                    <td className="text-xs text-slate-500">{aplicacion.actualizadoEn.slice(0, 10)}</td>
                    <td>
                      <Link
                        to={`/admin/poblacion/${aplicacion.usuarioId}`}
                        className="text-amber-300 hover:underline"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
              <span>
                Página {datos.pagina} de {paginas}
              </span>
              <div className="flex gap-2">
                <button
                  className="btn-ghost"
                  disabled={datos.pagina <= 1}
                  onClick={() => setPagina((previa) => previa - 1)}
                >
                  Anterior
                </button>
                <button
                  className="btn-ghost"
                  disabled={datos.pagina >= paginas}
                  onClick={() => setPagina((previa) => previa + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
