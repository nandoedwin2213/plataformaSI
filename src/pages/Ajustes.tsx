import { useState } from 'react'
import { useApp } from '../store/contexto'
import type { AjustesInstitucionales } from '../domain/usuarios'

export function Ajustes() {
  const { ajustes, actualizarAjustes, reiniciarDatos } = useApp()
  const [borrador, setBorrador] = useState<AjustesInstitucionales>(ajustes)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  const guardar = async () => {
    const fallo = await actualizarAjustes(borrador)
    setError(fallo ?? '')
    setGuardado(!fallo)
  }

  const cambiar = (parcial: Partial<AjustesInstitucionales>) => {
    setBorrador((previo) => ({ ...previo, ...parcial }))
    setGuardado(false)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Variables y parámetros del sistema</h1>
        <p className="mt-1 text-sm text-slate-400">
          Parámetros del algoritmo y de la unidad. Aplican a check-ins y evaluaciones nuevas.
        </p>
      </div>

      <section className="card space-y-4">
        <h2 className="section-title">Identidad de la unidad</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="institucion">
              Institución
            </label>
            <input
              id="institucion"
              className="input"
              value={borrador.institucion}
              onChange={(evento) => cambiar({ institucion: evento.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="unidadPorDefecto">
              Unidad por defecto
            </label>
            <input
              id="unidadPorDefecto"
              className="input"
              value={borrador.unidadPorDefecto}
              onChange={(evento) => cambiar({ unidadPorDefecto: evento.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="section-title">Umbrales del índice de fatiga (0-100)</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(['moderado', 'alto', 'critico'] as const).map((clave) => (
            <div key={clave}>
              <label className="label" htmlFor={clave}>
                Mínimo para riesgo {clave}
              </label>
              <input
                id={clave}
                type="number"
                min={1}
                max={99}
                className="input"
                value={borrador.umbrales[clave]}
                onChange={(evento) =>
                  cambiar({ umbrales: { ...borrador.umbrales, [clave]: Number(evento.target.value) } })
                }
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Los umbrales deben ser crecientes. Independiente de ellos, la plataforma eleva el nivel a alto ante
          KSS ≥ 8, Samn-Perelli ≥ 6, menos de 4 h de sueño o jornadas mayores a 12 h sin relevo.
        </p>
      </section>

      <section className="card space-y-4">
        <h2 className="section-title">Política operativa</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="jornada">
              Jornada laboral de referencia (h)
            </label>
            <input
              id="jornada"
              type="number"
              min={4}
              max={16}
              className="input"
              value={borrador.jornadaReferencia}
              onChange={(evento) => cambiar({ jornadaReferencia: Number(evento.target.value) })}
            />
          </div>
          <div>
            <label className="label" htmlFor="retencion">
              Retención de datos (días)
            </label>
            <input
              id="retencion"
              type="number"
              min={30}
              max={3650}
              className="input"
              value={borrador.retencionDias}
              onChange={(evento) => cambiar({ retencionDias: Number(evento.target.value) })}
            />
          </div>
        </div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 accent-cyan-500"
            checked={borrador.alertasActivas}
            onChange={(evento) => cambiar({ alertasActivas: evento.target.checked })}
          />
          <span className="text-sm text-slate-300">Mostrar alertas automáticas en el tablero</span>
        </label>
        <button className="btn-primary" onClick={() => void guardar()}>
          {guardado ? 'Ajustes guardados' : 'Guardar ajustes'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>

      <section className="card space-y-4">
        <h2 className="section-title">Datos y respaldo</h2>
        <p className="text-sm text-slate-400">
          Los datos residen en la base PostgreSQL del servidor con auditoría de accesos; para producción
          falta respaldo centralizado programado. La exportación masiva no se realiza desde el navegador
          porque la población puede superar el millar de fichas.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-ghost text-red-300"
            onClick={() => {
              if (window.confirm('Se borrarán todos los datos del servidor y se recargarán los datos demo.')) {
                void reiniciarDatos()
              }
            }}
          >
            Reiniciar datos demo
          </button>
        </div>
      </section>
    </div>
  )
}
