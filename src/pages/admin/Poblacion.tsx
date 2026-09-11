import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type FiltroPersonas } from '../../lib/api'
import { colorNivelRiesgo, etiquetaNivelRiesgo, type PaginaPersonas } from '../../domain/riesgo'

const niveles = ['bajo', 'moderado', 'alto', 'critico']

export function Poblacion() {
  const [parametros, setParametros] = useSearchParams()
  const [datos, setDatos] = useState<PaginaPersonas | null>(null)
  const [catalogo, setCatalogo] = useState<{ unidades: string[]; grados: string[] }>({
    unidades: [],
    grados: [],
  })
  const [error, setError] = useState('')

  const filtro: FiltroPersonas = {
    pagina: Number(parametros.get('pagina') ?? '1'),
    tam: 25,
    nivel: parametros.get('nivel') ?? '',
    unidad: parametros.get('unidad') ?? '',
    grado: parametros.get('grado') ?? '',
    busqueda: parametros.get('busqueda') ?? '',
    conAlerta: parametros.get('conAlerta') === '1',
    sinDatos: parametros.get('sinDatos') === '1',
  }

  useEffect(() => {
    void api
      .panelFiltros()
      .then(setCatalogo)
      .catch(() => setCatalogo({ unidades: [], grados: [] }))
  }, [])

  useEffect(() => {
    // Solo se pide la página visible: la población completa nunca llega al navegador.
    void api
      .panelPersonas(filtro)
      .then(setDatos)
      .catch((fallo: unknown) =>
        setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar el personal'),
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametros])

  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(parametros)
    if (valor) siguiente.set(clave, valor)
    else siguiente.delete(clave)
    if (clave !== 'pagina') siguiente.delete('pagina')
    setParametros(siguiente)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Personal evaluado</h1>
        <p className="mt-1 text-sm text-slate-400">
          Listado paginado con el último índice integrado de cada persona.
        </p>
      </div>

      <section className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label" htmlFor="busqueda">
            Buscar
          </label>
          <input
            id="busqueda"
            className="input"
            defaultValue={filtro.busqueda}
            placeholder="Nombre o correo"
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') cambiar('busqueda', evento.currentTarget.value)
            }}
            onBlur={(evento) => cambiar('busqueda', evento.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="nivel">
            Nivel
          </label>
          <select
            id="nivel"
            className="input"
            value={filtro.nivel}
            onChange={(evento) => cambiar('nivel', evento.target.value)}
          >
            <option value="">Todos</option>
            {niveles.map((nivel) => (
              <option key={nivel} value={nivel}>
                {etiquetaNivelRiesgo[nivel as keyof typeof etiquetaNivelRiesgo]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="unidad">
            Unidad
          </label>
          <select
            id="unidad"
            className="input"
            value={filtro.unidad}
            onChange={(evento) => cambiar('unidad', evento.target.value)}
          >
            <option value="">Todas</option>
            {catalogo.unidades.map((unidad) => (
              <option key={unidad} value={unidad}>
                {unidad}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="grado">
            Grado
          </label>
          <select
            id="grado"
            className="input"
            value={filtro.grado}
            onChange={(evento) => cambiar('grado', evento.target.value)}
          >
            <option value="">Todos</option>
            {catalogo.grados.map((grado) => (
              <option key={grado} value={grado}>
                {grado}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 pt-6 text-sm text-slate-300">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-cyan-500"
              checked={Boolean(filtro.conAlerta)}
              onChange={(evento) => cambiar('conAlerta', evento.target.checked ? '1' : '')}
            />
            Con alerta abierta
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-cyan-500"
              checked={Boolean(filtro.sinDatos)}
              onChange={(evento) => cambiar('sinDatos', evento.target.checked ? '1' : '')}
            />
            Sin evaluaciones
          </label>
        </div>
      </section>

      {error && <p className="card text-sm text-red-400">{error}</p>}

      <section className="card overflow-x-auto">
        {!datos ? (
          <p className="text-sm text-slate-400">Cargando personal…</p>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Persona</th>
                  <th>Unidad</th>
                  <th>Índice</th>
                  <th>Nivel</th>
                  <th>Tendencia</th>
                  <th>Alertas</th>
                  <th>Último cálculo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {datos.personas.map((persona) => (
                  <tr key={persona.id} className="border-t border-white/5">
                    <td className="py-2 text-slate-200">
                      {persona.grado} {persona.nombre}
                    </td>
                    <td className="text-slate-400">{persona.unidad}</td>
                    <td className="text-slate-200">{persona.puntaje ?? '—'}</td>
                    <td>
                      {persona.nivel ? (
                        <span className={`rounded px-2 py-0.5 text-xs ${colorNivelRiesgo[persona.nivel]}`}>
                          {etiquetaNivelRiesgo[persona.nivel]}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Sin datos</span>
                      )}
                    </td>
                    <td className="text-xs text-slate-400">
                      {persona.direccion ?? '—'}
                      {persona.persistente ? ' · persistente' : ''}
                    </td>
                    <td className="text-slate-400">{persona.alertas}</td>
                    <td className="text-xs text-slate-500">{persona.calculadoEn?.slice(0, 10) ?? '—'}</td>
                    <td>
                      <Link to={`/admin/poblacion/${persona.id}`} className="text-cyan-400 hover:underline">
                        Detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
              <span>
                {datos.total} personas · página {datos.pagina} de {datos.paginas || 1}
              </span>
              <div className="flex gap-2">
                <button
                  className="btn-ghost"
                  disabled={datos.pagina <= 1}
                  onClick={() => cambiar('pagina', String(datos.pagina - 1))}
                >
                  Anterior
                </button>
                <button
                  className="btn-ghost"
                  disabled={datos.pagina >= datos.paginas}
                  onClick={() => cambiar('pagina', String(datos.pagina + 1))}
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
