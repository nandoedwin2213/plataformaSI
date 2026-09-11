import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../store/contexto'
import type { Pregunta, ValorRespuesta } from '../domain/instrumentos'

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

  if (pregunta.tipo === 'numero' || pregunta.tipo === 'escala') {
    return (
      <input
        type="number"
        className="input"
        disabled={bloqueado}
        value={typeof valor === 'number' ? valor : ''}
        onChange={(evento) => onCambio(Number(evento.target.value))}
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
    () => instrumento?.miRespuesta?.respuestas ?? {},
  )
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  if (!instrumento) {
    return (
      <div className="card text-sm text-slate-400">
        Esta evaluación no está disponible.{' '}
        <Link to="/pruebas" className="text-cyan-400 hover:underline">
          Volver a mis evaluaciones
        </Link>
      </div>
    )
  }

  const finalizada = instrumento.miRespuesta?.estado === 'finalizada'

  const guardar = async (finalizar: boolean) => {
    try {
      await guardarRespuestaInstrumento(instrumento.id, respuestas, finalizar)
      setError('')
      setMensaje(finalizar ? 'Evaluación finalizada.' : 'Respuestas guardadas; puedes continuar más tarde.')
    } catch (fallo) {
      setMensaje('')
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar la evaluación.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">{instrumento.nombre}</h1>
        <p className="mt-1 text-sm text-slate-400">{instrumento.descripcion}</p>
      </div>

      {finalizada && (
        <p className="card text-sm text-emerald-300">
          Finalizaste esta evaluación el {instrumento.miRespuesta?.finalizadoEn?.slice(0, 10)}. Tus respuestas
          quedan en modo consulta.
        </p>
      )}

      <section className="card space-y-5">
        {instrumento.preguntas.length === 0 && (
          <p className="text-sm text-slate-400">Esta evaluación todavía no tiene preguntas publicadas.</p>
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
              bloqueado={finalizada}
              onCambio={(valor) => {
                setRespuestas((previas) => ({ ...previas, [pregunta.id]: valor }))
                setMensaje('')
              }}
            />
          </div>
        ))}
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {mensaje && <p className="text-sm text-emerald-300">{mensaje}</p>}

      {!finalizada && instrumento.preguntas.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button className="btn-ghost" onClick={() => void guardar(false)}>
            Guardar y continuar después
          </button>
          <button className="btn-primary" onClick={() => void guardar(true)}>
            Finalizar evaluación
          </button>
        </div>
      )}
    </div>
  )
}
