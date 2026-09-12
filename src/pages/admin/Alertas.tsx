import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Alerta } from '../../domain/riesgo'

const estados: Alerta['estado'][] = ['abierta', 'reconocida', 'resuelta']

export function Alertas() {
  const [estado, setEstado] = useState<Alerta['estado']>('abierta')
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [error, setError] = useState('')

  const cargar = useCallback((filtro: Alerta['estado']) => {
    void api
      .alertas(filtro)
      .then(setAlertas)
      .catch((fallo: unknown) =>
        setError(fallo instanceof Error ? fallo.message : 'No se pudieron cargar las alertas'),
      )
  }, [])

  useEffect(() => cargar(estado), [cargar, estado])

  const cambiarEstado = async (alerta: Alerta, nuevo: Alerta['estado']) => {
    await api.actualizarAlerta(alerta.id, { estado: nuevo })
    cargar(estado)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Alertas de fatiga</h1>
        <p className="mt-1 text-sm text-slate-400">
          Generadas por las reglas configuradas. Una alerta señala que corresponde revisar el caso, no
          sustituye una decisión médica u operacional.
        </p>
      </div>

      <div className="flex gap-2">
        {estados.map((item) => (
          <button
            key={item}
            className={item === estado ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setEstado(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {error && <p className="card text-sm text-red-400">{error}</p>}

      <section className="card overflow-x-auto">
        {alertas.length === 0 ? (
          <p className="text-sm text-slate-400">No hay alertas en este estado.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Persona</th>
                <th>Regla</th>
                <th>Severidad</th>
                <th>Motivo</th>
                <th>Actualizada</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {alertas.map((alerta) => (
                <tr key={alerta.id} className="border-t border-white/5">
                  <td className="py-2 text-slate-200">
                    <Link to={`/admin/poblacion/${alerta.usuarioId}`} className="hover:underline">
                      {alerta.persona ? `${alerta.persona.grado} ${alerta.persona.nombre}` : alerta.usuarioId}
                    </Link>
                  </td>
                  <td className="text-slate-400">{alerta.reglaClave}</td>
                  <td className="text-slate-400">{alerta.severidad}</td>
                  <td className="text-slate-300">{alerta.motivo}</td>
                  <td className="text-xs text-slate-500">{alerta.actualizadoEn.slice(0, 16).replace('T', ' ')}</td>
                  <td className="space-x-2">
                    {alerta.estado !== 'reconocida' && (
                      <button className="btn-ghost" onClick={() => void cambiarEstado(alerta, 'reconocida')}>
                        Reconocer
                      </button>
                    )}
                    {alerta.estado !== 'resuelta' && (
                      <button className="btn-ghost" onClick={() => void cambiarEstado(alerta, 'resuelta')}>
                        Resolver
                      </button>
                    )}
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
