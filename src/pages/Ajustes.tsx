import { useState } from 'react'
import { useApp } from '../store/contexto'
import { api } from '../lib/api'
import { CampoNumero } from '../components/CampoNumero'
import type { AjustesInstitucionales } from '../domain/usuarios'

const descripcionUmbral: Record<'moderado' | 'alto' | 'critico', string> = {
  moderado: 'desde este puntaje el índice deja de ser bajo y conviene vigilar la tendencia',
  alto: 'desde este puntaje se recomienda aplicar contramedidas y revisar la asignación de tareas',
  critico: 'desde este puntaje la persona no debería asumir tareas de seguridad crítica sin decisión del mando',
}

export function Ajustes() {
  const { ajustes, actualizarAjustes, reiniciarDatos } = useApp()
  const [borrador, setBorrador] = useState<AjustesInstitucionales>(ajustes)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [borrando, setBorrando] = useState(false)
  const [resultadoBorrado, setResultadoBorrado] = useState('')

  const borrarDatosEvaluados = async () => {
    setBorrando(true)
    try {
      const resumen = await api.reiniciarDatosEvaluados()
      setResultadoBorrado(
        `Se eliminaron ${resumen.evaluados} evaluados, ${resumen.aplicaciones} aplicaciones y ${resumen.checkins} check-ins.`,
      )
      setConfirmacion('')
    } catch {
      setResultadoBorrado('No se pudo borrar la información; intenta nuevamente.')
    } finally {
      setBorrando(false)
    }
  }

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
          Parámetros del algoritmo y de la unidad. Aplican a check-ins y evaluaciones nuevas (los
          resultados ya calculados no cambian retroactivamente).
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
            <label className="label" htmlFor="subtitulo">
              Subtítulo (línea que aparece bajo la institución en el menú lateral)
            </label>
            <input
              id="subtitulo"
              className="input"
              value={borrador.subtitulo}
              onChange={(evento) => cambiar({ subtitulo: evento.target.value })}
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
              <CampoNumero
                id={clave}
                etiqueta={`Mínimo para riesgo ${clave}`}
                ayuda={`(${descripcionUmbral[clave]})`}
                min={1}
                max={99}
                valor={borrador.umbrales[clave]}
                onCambio={(valor) => cambiar({ umbrales: { ...borrador.umbrales, [clave]: valor } })}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Cómo se usa: el índice integrado se expresa de 0 a 100 (0 = sin señales de fatiga, 100 = máxima
          fatiga estimada) y se compara con estos tres cortes para asignar el nivel. Los umbrales deben ser
          crecientes. Independiente de ellos, la plataforma eleva el nivel a alto ante
          KSS ≥ 8, Samn-Perelli ≥ 6, menos de 4 h de sueño o jornadas mayores a 12 h sin relevo.
        </p>
      </section>

      <section className="card space-y-4">
        <h2 className="section-title">Política operativa</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <CampoNumero
            id="jornada"
            etiqueta="Jornada laboral de referencia (h)"
            ayuda="(turno considerado normal; las horas que lo superan suman carga al índice)"
            min={4}
            max={16}
            valor={borrador.jornadaReferencia}
            onCambio={(valor) => cambiar({ jornadaReferencia: valor })}
          />
          <CampoNumero
            id="retencion"
            etiqueta="Retención de datos (días)"
            ayuda="(tiempo que la institución conserva las respuestas antes de depurarlas)"
            min={30}
            max={3650}
            valor={borrador.retencionDias}
            onCambio={(valor) => cambiar({ retencionDias: valor })}
          />
        </div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 accent-cyan-500"
            checked={borrador.alertasActivas}
            onChange={(evento) => cambiar({ alertasActivas: evento.target.checked })}
          />
          <span className="text-sm text-slate-300">
            Mostrar alertas automáticas en el tablero{' '}
            <span className="text-slate-500">
              (avisos que generan las reglas cuando alguien supera un umbral o empeora)
            </span>
          </span>
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
        <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm font-semibold text-red-200">Borrar la información del personal evaluado</p>
          <p className="text-xs text-slate-400">
            Elimina de forma permanente las fichas, check-ins, aplicaciones de instrumentos, índices de
            riesgo, líneas base y alertas de todo el personal evaluado. Se conservan la cuenta
            administrativa, los instrumentos, el modelo de riesgo, las estrategias y estos parámetros.
            Escribe <strong className="text-red-200">BORRAR DATOS</strong> para habilitar el botón.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="input max-w-xs"
              value={confirmacion}
              placeholder="BORRAR DATOS"
              onChange={(evento) => setConfirmacion(evento.target.value)}
            />
            <button
              className="btn-ghost text-red-300 disabled:opacity-40"
              disabled={confirmacion !== 'BORRAR DATOS' || borrando}
              onClick={() => void borrarDatosEvaluados()}
            >
              {borrando ? 'Borrando…' : 'Borrar datos de evaluados'}
            </button>
          </div>
          {resultadoBorrado && <p className="text-xs text-emerald-300">{resultadoBorrado}</p>}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="btn-ghost text-red-300"
            onClick={() => {
              if (window.confirm('Se borrarán todos los datos del servidor y se recargarán los datos demo.')) {
                void reiniciarDatos()
              }
            }}
          >
            Reiniciar base completa con datos demo
          </button>
        </div>
      </section>
    </div>
  )
}
