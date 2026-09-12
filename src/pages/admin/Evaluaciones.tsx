import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../store/contexto'
import { api } from '../../lib/api'
import type { Instrumento, RespuestaInstrumento } from '../../domain/instrumentos'
import { colorNivel, etiquetaNivel } from '../../domain/catalogos'

export function EvaluacionesAdmin() {
  const { usuarios, registros, checkins } = useApp()
  const [respuestas, setRespuestas] = useState<RespuestaInstrumento[]>([])
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void Promise.all([api.respuestasAdmin(), api.instrumentosAdmin()])
      .then(([listaRespuestas, listaInstrumentos]) => {
        setRespuestas(listaRespuestas)
        setInstrumentos(listaInstrumentos)
      })
      .catch((fallo: unknown) =>
        setError(fallo instanceof Error ? fallo.message : 'No se pudieron cargar las evaluaciones'),
      )
  }, [])

  const nombrePersona = useMemo(() => {
    const mapa = new Map(usuarios.map((usuario) => [usuario.id, usuario]))
    return (id: string) => {
      const persona = mapa.get(id)
      return persona ? `${persona.grado} ${persona.nombre}` : 'Personal no disponible'
    }
  }, [usuarios])

  const nombreInstrumento = useMemo(() => {
    const mapa = new Map(instrumentos.map((item) => [item.id, item.nombre]))
    return (id: string) => mapa.get(id) ?? 'Instrumento eliminado'
  }, [instrumentos])

  const completas = [...registros].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Evaluaciones y resultados</h1>
        <p className="mt-1 text-sm text-slate-400">
          {completas.length} evaluaciones clínicas · {checkins.length} check-ins · {respuestas.length}{' '}
          respuestas a test de la unidad
        </p>
      </div>

      {error && <p className="card text-sm text-red-400">{error}</p>}

      <section className="card">
        <h2 className="section-title">Evaluaciones completas de fatiga</h2>
        {completas.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no hay evaluaciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Personal</th>
                  <th>Fecha</th>
                  <th>Índice</th>
                  <th>Nivel</th>
                  <th>Ficha</th>
                </tr>
              </thead>
              <tbody>
                {completas.map((registro) => (
                  <tr key={registro.id} className="border-t border-white/5">
                    <td className="py-2 text-slate-300">{nombrePersona(registro.usuarioId)}</td>
                    <td className="text-slate-400">{registro.creadoEn.slice(0, 10)}</td>
                    <td className="text-slate-300">{registro.resultado.puntaje}/100</td>
                    <td>
                      <span className={`rounded px-2 py-0.5 text-xs ${colorNivel[registro.resultado.nivel]}`}>
                        {etiquetaNivel[registro.resultado.nivel]}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/admin/personal/${registro.usuarioId}`}
                        className="text-amber-300 hover:underline"
                      >
                        Ver ficha
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">Test de la unidad respondidos</h2>
        {respuestas.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay respuestas a los test configurados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Personal</th>
                  <th>Test</th>
                  <th>Estado</th>
                  <th>Puntaje</th>
                  <th>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {respuestas.map((respuesta) => (
                  <tr key={respuesta.id} className="border-t border-white/5">
                    <td className="py-2 text-slate-300">{nombrePersona(respuesta.usuarioId)}</td>
                    <td className="text-slate-400">{nombreInstrumento(respuesta.instrumentoId)}</td>
                    <td className="text-slate-400">
                      {respuesta.estado === 'finalizada' ? 'Finalizada' : 'En curso'}
                    </td>
                    <td className="text-slate-300">{respuesta.puntaje ?? '—'}</td>
                    <td className="text-slate-500">{respuesta.actualizadoEn.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
