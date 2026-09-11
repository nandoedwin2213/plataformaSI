import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import {
  tiposPregunta,
  type DatosPregunta,
  type Instrumento,
  type TipoPregunta,
} from '../../domain/instrumentos'

const preguntaVacia: DatosPregunta = {
  texto: '',
  ayuda: '',
  tipo: 'unica',
  opciones: [],
  obligatoria: true,
  activa: true,
}

function requiereOpciones(tipo: TipoPregunta): boolean {
  return tipo === 'unica' || tipo === 'multiple'
}

function FormularioPregunta({
  onGuardar,
}: {
  onGuardar: (datos: DatosPregunta) => Promise<void>
}) {
  const [datos, setDatos] = useState<DatosPregunta>(preguntaVacia)
  const [opcionesTexto, setOpcionesTexto] = useState('')

  return (
    <div className="space-y-3 rounded-lg border border-white/10 p-4">
      <p className="text-sm font-semibold text-slate-200">Nueva pregunta</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Enunciado</label>
          <input
            className="input"
            value={datos.texto}
            onChange={(evento) => setDatos({ ...datos, texto: evento.target.value })}
          />
        </div>
        <div>
          <label className="label">Ayuda (opcional)</label>
          <input
            className="input"
            value={datos.ayuda}
            onChange={(evento) => setDatos({ ...datos, ayuda: evento.target.value })}
          />
        </div>
        <div>
          <label className="label">Tipo de respuesta</label>
          <select
            className="input"
            value={datos.tipo}
            onChange={(evento) => setDatos({ ...datos, tipo: evento.target.value as TipoPregunta })}
          >
            {tiposPregunta.map((tipo) => (
              <option key={tipo.valor} value={tipo.valor}>
                {tipo.texto}
              </option>
            ))}
          </select>
        </div>
        {requiereOpciones(datos.tipo) && (
          <div>
            <label className="label">Opciones (una por línea, formato texto|valor)</label>
            <textarea
              className="input min-h-20"
              value={opcionesTexto}
              onChange={(evento) => setOpcionesTexto(evento.target.value)}
            />
          </div>
        )}
      </div>
      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          className="h-4 w-4 accent-amber-500"
          checked={datos.obligatoria}
          onChange={(evento) => setDatos({ ...datos, obligatoria: evento.target.checked })}
        />
        Obligatoria
      </label>
      <button
        className="btn-primary"
        onClick={() => {
          const opciones = opcionesTexto
            .split('\n')
            .map((linea) => linea.trim())
            .filter(Boolean)
            .map((linea, indice) => {
              const [texto, valor] = linea.split('|')
              return { texto: texto.trim(), valor: Number(valor ?? indice) || indice }
            })
          void onGuardar({ ...datos, opciones }).then(() => {
            setDatos(preguntaVacia)
            setOpcionesTexto('')
          })
        }}
      >
        Agregar pregunta
      </button>
    </div>
  )
}

export function TestsAdmin() {
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([])
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')

  const recargar = async () => {
    try {
      setInstrumentos(await api.instrumentosAdmin())
      setError('')
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudieron cargar los test')
    }
  }

  useEffect(() => {
    void recargar()
  }, [])

  const ejecutar = async (accion: () => Promise<unknown>) => {
    try {
      await accion()
      await recargar()
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo completar la operación')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Test y preguntas</h1>
        <p className="mt-1 text-sm text-slate-400">
          Crea evaluaciones propias de la unidad. Los instrumentos clínicos validados (KSS, Samn-Perelli y
          Epworth) permanecen protegidos como lógica interna del sistema y solo pueden activarse o
          desactivarse.
        </p>
      </div>

      {error && <p className="card text-sm text-red-400">{error}</p>}

      <section className="card space-y-3">
        <h2 className="section-title">Nuevo test</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Nombre</label>
            <input className="input" value={nombre} onChange={(evento) => setNombre(evento.target.value)} />
          </div>
          <div>
            <label className="label">Descripción</label>
            <input
              className="input"
              value={descripcion}
              onChange={(evento) => setDescripcion(evento.target.value)}
            />
          </div>
        </div>
        <button
          className="btn-primary"
          disabled={!nombre.trim()}
          onClick={() =>
            void ejecutar(async () => {
              await api.crearInstrumento({ nombre, descripcion })
              setNombre('')
              setDescripcion('')
            })
          }
        >
          Crear test
        </button>
      </section>

      {instrumentos.map((instrumento) => (
        <section key={instrumento.id} className="card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="section-title">{instrumento.nombre}</h2>
              <p className="text-xs text-slate-500">
                {instrumento.descripcion} ·{' '}
                {instrumento.tipo === 'sistema' ? 'instrumento validado del sistema' : 'test de la unidad'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-ghost"
                onClick={() =>
                  void ejecutar(() =>
                    api.actualizarInstrumento(instrumento.id, { activo: !instrumento.activo }),
                  )
                }
              >
                {instrumento.activo ? 'Desactivar' : 'Activar'}
              </button>
              {instrumento.tipo === 'personalizado' && (
                <button
                  className="btn-ghost text-red-300"
                  onClick={() => {
                    if (window.confirm(`¿Eliminar el test "${instrumento.nombre}" y sus respuestas?`)) {
                      void ejecutar(() => api.eliminarInstrumento(instrumento.id))
                    }
                  }}
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>

          {instrumento.tipo === 'sistema' ? (
            <p className="text-sm text-slate-400">
              Las preguntas de este instrumento están definidas por las escalas validadas y no son editables.
            </p>
          ) : (
            <>
              {instrumento.preguntas.length === 0 ? (
                <p className="text-sm text-slate-400">Este test todavía no tiene preguntas.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {instrumento.preguntas.map((pregunta, indice) => (
                    <li
                      key={pregunta.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-2"
                    >
                      <div>
                        <p className="text-slate-300">
                          {indice + 1}. {pregunta.texto}
                          {pregunta.obligatoria && <span className="text-red-400"> *</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {pregunta.tipo}
                          {pregunta.opciones.length > 0 &&
                            ` · ${pregunta.opciones.map((opcion) => opcion.texto).join(', ')}`}
                          {!pregunta.activa && ' · inactiva'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn-ghost"
                          onClick={() =>
                            void ejecutar(() =>
                              api.actualizarPregunta(pregunta.id, { activa: !pregunta.activa }),
                            )
                          }
                        >
                          {pregunta.activa ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          className="btn-ghost text-red-300"
                          onClick={() => void ejecutar(() => api.eliminarPregunta(pregunta.id))}
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <FormularioPregunta
                onGuardar={async (datos) => {
                  await ejecutar(() => api.crearPregunta(instrumento.id, datos))
                }}
              />
            </>
          )}
        </section>
      ))}
    </div>
  )
}
