import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../store/contexto'
import { api } from '../lib/api'
import type { Pregunta, RespuestaGuardada, RespuestaInstrumento, ValorRespuesta } from '../domain/instrumentos'
import { colorNivelRiesgo, etiquetaNivelRiesgo } from '../domain/riesgo'

function CampoPregunta({
  pregunta,
  valor,
  bloqueado,
  onCambio,
}: {
  pregunta: Pregunta
  valor: ValorRespuesta | undefined
  bloqueado: boolean
  onCambio: (valor: ValorRespuesta) => void
}) {
  if (pregunta.tipo === 'texto') {
    return (
      <textarea
        className="input min-h-24"
        disabled={bloqueado}
        value={typeof valor === 'string' ? valor : ''}
        onChange={(evento) => onCambio(evento.target.value)}
      />
    )
  }

  if (pregunta.tipo === 'escala' && pregunta.minimo !== null && pregunta.maximo !== null) {
    const minimo = pregunta.minimo ?? 0
    const maximo = pregunta.maximo ?? 100
    const paso = pregunta.paso ?? 1
    const actual = typeof valor === 'number' ? valor : Math.round((minimo + maximo) / 2)
    return (
      <div className="space-y-1">
        <input
          type="range"
          className="w-full accent-cyan-500"
          min={minimo}
          max={maximo}
          step={paso}
          disabled={bloqueado}
          value={actual}
          onChange={(evento) => onCambio(Number(evento.target.value))}
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>{minimo}</span>
          <span className="font-semibold text-cyan-300">{typeof valor === 'number' ? valor : '—'}</span>
          <span>{maximo}</span>
        </div>
      </div>
    )
  }

  if (pregunta.tipo === 'numero' || pregunta.tipo === 'escala') {
    return (
      <input
        type="number"
        className="input"
        disabled={bloqueado}
        min={pregunta.minimo ?? undefined}
        max={pregunta.maximo ?? undefined}
        step={pregunta.paso ?? undefined}
        value={typeof valor === 'number' ? valor : typeof valor === 'string' ? valor : ''}
        // El texto vacío se conserva como respuesta sin contestar en lugar de convertirse en 0.
        onChange={(evento) =>
          onCambio(evento.target.value === '' ? '' : Number(evento.target.value))
        }
      />
    )
  }

  if (pregunta.tipo === 'unica') {
    return (
      <div className="space-y-2">
        {pregunta.opciones.map((opcion) => (
          <label key={opcion.texto} className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="radio"
              className="h-4 w-4 accent-cyan-500"
              disabled={bloqueado}
              name={pregunta.id}
              checked={valor === opcion.texto}
              onChange={() => onCambio(opcion.texto)}
            />
            {opcion.texto}
          </label>
        ))}
      </div>
    )
  }

  const seleccion = Array.isArray(valor) ? valor : []
  return (
    <div className="space-y-2">
      {pregunta.opciones.map((opcion) => (
        <label key={opcion.texto} className="flex items-center gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 accent-cyan-500"
            disabled={bloqueado}
            checked={seleccion.includes(opcion.texto)}
            onChange={(evento) =>
              onCambio(
                evento.target.checked
                  ? [...seleccion, opcion.texto]
                  : seleccion.filter((item) => item !== opcion.texto),
              )
            }
          />
          {opcion.texto}
        </label>
      ))}
    </div>
  )
}

export function ResponderPrueba() {
  const { id } = useParams()
  const { instrumentos, guardarRespuestaInstrumento } = useApp()
  const instrumento = instrumentos.find((item) => item.id === id)
  const [respuestas, setRespuestas] = useState<Record<string, ValorRespuesta>>(
    () => instrumento?.miBorrador?.respuestas ?? {},
  )
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<RespuestaGuardada | null>(null)
  const [historial, setHistorial] = useState<RespuestaInstrumento[]>([])

  useEffect(() => {
    if (!id) return
    void api
      .historialInstrumento(id)
      .then(setHistorial)
      .catch(() => setHistorial([]))
  }, [id, resultado])

  if (!instrumento) {
    return (
      <div className="card text-sm text-slate-400">
        Este instrumento no está disponible.{' '}
        <Link to="/pruebas" className="text-cyan-400 hover:underline">
          Volver a mis instrumentos
        </Link>
      </div>
    )
  }

  const bloqueado = !instrumento.disponible && !instrumento.miBorrador && !resultado

  const guardar = async (finalizar: boolean) => {
    try {
      const guardada = await guardarRespuestaInstrumento(instrumento.id, respuestas, finalizar)
      setError('')
      if (finalizar) {
        setResultado(guardada)
        setMensaje('')
      } else {
        setMensaje('Respuestas guardadas; puedes continuar más tarde.')
      }
    } catch (fallo) {
      setMensaje('')
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar la aplicación.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">{instrumento.nombre}</h1>
        <p className="mt-1 text-sm text-slate-400">{instrumento.descripcion}</p>
        <p className="mt-1 text-xs text-slate-500">
          Versión {instrumento.version} · {instrumento.totalAplicaciones} aplicaciones registradas
        </p>
      </div>

      {resultado && (
        <section className="card space-y-3">
          <h2 className="section-title">Resultado de esta aplicación</h2>
          <p className="text-3xl font-bold text-white">{resultado.puntaje}</p>
          <p className="text-sm text-slate-300">{resultado.interpretacion}</p>
          {resultado.riesgo && (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-slate-400">Índice integrado de riesgo:</span>
                <span className="text-lg font-semibold text-white">{resultado.riesgo.puntaje}/100</span>
                <span className={`rounded px-2 py-0.5 text-xs ${colorNivelRiesgo[resultado.riesgo.nivel]}`}>
                  {etiquetaNivelRiesgo[resultado.riesgo.nivel]}
                </span>
                <span className="text-xs text-slate-500">
                  Modelo v{resultado.riesgo.versionModelo} · confianza {resultado.riesgo.confianza}
                </span>
              </div>
              <ul className="space-y-1 text-xs text-slate-400">
                {resultado.riesgo.explicacion.map((linea) => (
                  <li key={linea}>· {linea}</li>
                ))}
              </ul>
              <p className="text-xs text-slate-500">
                El índice es una ayuda a la decisión; su parametrización es configurable y requiere
                validación profesional antes de sustentar decisiones operacionales.
              </p>
            </div>
          )}
          <Link to="/mi-riesgo" className="btn-ghost inline-block">
            Ver mi situación completa
          </Link>
        </section>
      )}

      {bloqueado && instrumento.proximaEn && (
        <p className="card text-sm text-slate-300">
          Ya completaste este instrumento dentro de su frecuencia de aplicación. La próxima aplicación
          estará disponible el {instrumento.proximaEn.slice(0, 10)}.
        </p>
      )}

      {!resultado && (
        <section className="card space-y-5">
          {instrumento.preguntas.length === 0 && (
            <p className="text-sm text-slate-400">Este instrumento todavía no tiene preguntas publicadas.</p>
          )}
          {instrumento.preguntas.map((pregunta, indice) => (
            <div key={pregunta.id}>
              <p className="label">
                {indice + 1}. {pregunta.texto}
                {pregunta.obligatoria && <span className="text-red-400"> *</span>}
              </p>
              {pregunta.ayuda && <p className="mb-2 text-xs text-slate-500">{pregunta.ayuda}</p>}
              <CampoPregunta
                pregunta={pregunta}
                valor={respuestas[pregunta.id]}
                bloqueado={bloqueado}
                onCambio={(valor) => {
                  setRespuestas((previas) => ({ ...previas, [pregunta.id]: valor }))
                  setMensaje('')
                }}
              />
            </div>
          ))}
        </section>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {mensaje && <p className="text-sm text-emerald-300">{mensaje}</p>}

      {!bloqueado && !resultado && instrumento.preguntas.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button className="btn-ghost" onClick={() => void guardar(false)}>
            Guardar y continuar después
          </button>
          <button className="btn-primary" onClick={() => void guardar(true)}>
            Finalizar aplicación
          </button>
        </div>
      )}

      <section className="card">
        <h2 className="section-title">Historial de este instrumento</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no hay aplicaciones finalizadas.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Fecha</th>
                <th>Puntaje</th>
                <th>Normalizado</th>
                <th>Interpretación</th>
                <th>Versión</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((item) => (
                <tr key={item.id} className="border-t border-white/5">
                  <td className="py-2 text-slate-400">{item.finalizadoEn?.slice(0, 10)}</td>
                  <td className="text-slate-200">{item.puntaje}</td>
                  <td className="text-slate-400">
                    {item.puntajeNormalizado === null ? '—' : `${Math.round(item.puntajeNormalizado)}/100`}
                  </td>
                  <td className="text-slate-400">{item.interpretacion}</td>
                  <td className="text-slate-500">v{item.instrumentoVersion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
