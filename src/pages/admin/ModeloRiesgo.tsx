import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import {
  etiquetaDominio,
  type EstrategiaMitigacion,
  type ModeloRiesgo as Modelo,
  type ReglaAlerta,
} from '../../domain/riesgo'

function numero(valor: unknown): number {
  const convertido = Number(valor)
  return Number.isFinite(convertido) ? convertido : 0
}

export function ModeloRiesgo() {
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [reglas, setReglas] = useState<ReglaAlerta[]>([])
  const [estrategias, setEstrategias] = useState<EstrategiaMitigacion[]>([])
  const [pesos, setPesos] = useState<Record<string, number>>({})
  const [umbrales, setUmbrales] = useState({ moderado: 25, alto: 50, critico: 70 })
  const [nota, setNota] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    void Promise.all([api.modelos(), api.reglasAlerta(), api.estrategias()])
      .then(([listaModelos, listaReglas, listaEstrategias]) => {
        setModelos(listaModelos)
        setReglas(listaReglas)
        setEstrategias(listaEstrategias)
        const activo = listaModelos.find((modelo) => modelo.activo) ?? listaModelos[0]
        if (activo) {
          setPesos(activo.definicion.pesos)
          setUmbrales(activo.definicion.umbrales)
        }
      })
      .catch((fallo: unknown) =>
        setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar la configuración'),
      )
  }, [])

  useEffect(cargar, [cargar])

  const activo = modelos.find((modelo) => modelo.activo) ?? null
  const suma = Object.values(pesos).reduce((total, peso) => total + peso, 0)

  const guardarVersion = async () => {
    if (!activo) return
    try {
      const { version } = await api.crearVersionModelo({
        definicion: { ...activo.definicion, pesos, umbrales },
        nota,
      })
      setMensaje(`Se creó y activó la versión v${version}. Los resultados anteriores conservan su versión.`)
      setError('')
      setNota('')
      cargar()
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar la versión')
    }
  }

  const recalcular = async () => {
    const resultado = await api.recalcularModelo()
    setMensaje(
      `Recalculados ${resultado.evaluados} evaluados con el modelo v${resultado.versionModelo} en ${resultado.milisegundos} ms.`,
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Modelo integrado de riesgo</h1>
        <p className="mt-1 text-sm text-slate-400">
          Los pesos, umbrales y reglas son una propuesta inicial: deben validarse con criterio médico y
          operacional antes de sustentar decisiones. Cada cambio genera una versión nueva.
        </p>
      </div>

      {error && <p className="card text-sm text-red-400">{error}</p>}
      {mensaje && <p className="card text-sm text-emerald-300">{mensaje}</p>}

      <section className="card space-y-4">
        <h2 className="section-title">
          Parametrización {activo ? `(activa: v${activo.version})` : ''}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(pesos).map(([dominio, peso]) => (
            <div key={dominio}>
              <label className="label" htmlFor={`peso-${dominio}`}>
                {etiquetaDominio[dominio] ?? dominio}
              </label>
              <input
                id={`peso-${dominio}`}
                type="number"
                step="0.05"
                min="0"
                max="1"
                className="input"
                value={peso}
                onChange={(evento) =>
                  setPesos((previos) => ({ ...previos, [dominio]: numero(evento.target.value) }))
                }
              />
            </div>
          ))}
        </div>
        <p className={`text-xs ${Math.abs(suma - 1) > 0.001 ? 'text-red-400' : 'text-slate-500'}`}>
          Suma de pesos: {suma.toFixed(2)} (debe ser 1,00)
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {(['moderado', 'alto', 'critico'] as const).map((clave) => (
            <div key={clave}>
              <label className="label" htmlFor={`umbral-${clave}`}>
                Umbral {clave}
              </label>
              <input
                id={`umbral-${clave}`}
                type="number"
                className="input"
                value={umbrales[clave]}
                onChange={(evento) =>
                  setUmbrales((previos) => ({ ...previos, [clave]: numero(evento.target.value) }))
                }
              />
            </div>
          ))}
        </div>

        <div>
          <label className="label" htmlFor="nota">
            Justificación del cambio
          </label>
          <input
            id="nota"
            className="input"
            value={nota}
            onChange={(evento) => setNota(evento.target.value)}
            placeholder="Motivo clínico u operacional del ajuste"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={() => void guardarVersion()}>
            Crear nueva versión
          </button>
          <button className="btn-ghost" onClick={() => void recalcular()}>
            Recalcular población
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Versiones</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Versión</th>
              <th>Nombre</th>
              <th>Creada</th>
              <th>Nota</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {modelos.map((modelo) => (
              <tr key={modelo.id} className="border-t border-white/5">
                <td className="py-2 text-slate-200">v{modelo.version}</td>
                <td className="text-slate-400">{modelo.nombre}</td>
                <td className="text-xs text-slate-500">{modelo.creadoEn.slice(0, 10)}</td>
                <td className="text-xs text-slate-500">{modelo.nota}</td>
                <td>
                  {modelo.activo ? (
                    <span className="text-xs text-emerald-300">Activa</span>
                  ) : (
                    <button
                      className="btn-ghost"
                      onClick={() => void api.activarModelo(modelo.version).then(cargar)}
                    >
                      Activar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card space-y-3">
        <h2 className="section-title">Reglas de alerta</h2>
        {reglas.map((regla) => (
          <div key={regla.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3 first:border-0 first:pt-0">
            <div>
              <p className="text-sm font-semibold text-slate-200">{regla.nombre}</p>
              <p className="text-xs text-slate-500">{regla.descripcion}</p>
              <p className="text-[11px] text-slate-500">
                {regla.tipo} · {JSON.stringify(regla.parametros)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                className="input w-32"
                value={regla.severidad}
                onChange={(evento) =>
                  void api
                    .actualizarReglaAlerta(regla.id, {
                      severidad: evento.target.value as ReglaAlerta['severidad'],
                    })
                    .then(cargar)
                }
              >
                <option value="baja">baja</option>
                <option value="media">media</option>
                <option value="alta">alta</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-cyan-500"
                  checked={regla.activa}
                  onChange={(evento) =>
                    void api
                      .actualizarReglaAlerta(regla.id, { activa: evento.target.checked })
                      .then(cargar)
                  }
                />
                Activa
              </label>
            </div>
          </div>
        ))}
      </section>

      <section className="card space-y-3">
        <h2 className="section-title">Estrategias de mitigación</h2>
        {estrategias.map((estrategia) => (
          <div key={estrategia.id} className="border-t border-white/5 pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-200">{estrategia.titulo}</p>
                <p className="text-xs text-slate-500">
                  Nivel {estrategia.nivelObjetivo}
                  {estrategia.dominio ? ` · ${etiquetaDominio[estrategia.dominio] ?? estrategia.dominio}` : ''}
                  {estrategia.reevaluarDias ? ` · reevaluar en ${estrategia.reevaluarDias} días` : ''}
                </p>
                <p className="text-xs text-slate-400">{estrategia.descripcion}</p>
                {estrategia.requiereValidacion && (
                  <p className="text-[11px] text-amber-300">Pendiente de validación institucional.</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-cyan-500"
                    checked={estrategia.activa}
                    onChange={(evento) =>
                      void api
                        .actualizarEstrategia(estrategia.id, { activa: evento.target.checked })
                        .then(cargar)
                    }
                  />
                  Activa
                </label>
                <button
                  className="btn-ghost"
                  onClick={() => void api.eliminarEstrategia(estrategia.id).then(cargar)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
        <NuevaEstrategia onCreada={cargar} />
      </section>
    </div>
  )
}

function NuevaEstrategia({ onCreada }: { onCreada: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [nivelObjetivo, setNivelObjetivo] = useState<EstrategiaMitigacion['nivelObjetivo']>('alto')
  const [error, setError] = useState('')

  const crear = async () => {
    try {
      await api.crearEstrategia({ titulo, descripcion, nivelObjetivo, requiereValidacion: true })
      setTitulo('')
      setDescripcion('')
      setError('')
      onCreada()
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo crear la estrategia')
    }
  }

  return (
    <div className="space-y-2 border-t border-white/10 pt-4">
      <h3 className="text-sm font-semibold text-slate-200">Nueva estrategia</h3>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          className="input"
          placeholder="Título"
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
        />
        <input
          className="input"
          placeholder="Descripción"
          value={descripcion}
          onChange={(evento) => setDescripcion(evento.target.value)}
        />
        <select
          className="input"
          value={nivelObjetivo}
          onChange={(evento) =>
            setNivelObjetivo(evento.target.value as EstrategiaMitigacion['nivelObjetivo'])
          }
        >
          <option value="bajo">bajo</option>
          <option value="moderado">moderado</option>
          <option value="alto">alto</option>
          <option value="critico">crítico</option>
        </select>
      </div>
      <button className="btn-ghost" onClick={() => void crear()}>
        Agregar estrategia
      </button>
    </div>
  )
}
