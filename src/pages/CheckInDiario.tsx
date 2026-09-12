import { useMemo, useState } from 'react'
import { useApp } from '../store/contexto'
import { evaluacionInicial, escalaKss, escalaSamnPerelli, etiquetaNivel, colorNivel } from '../domain/catalogos'
import { evaluarFatiga } from '../domain/scoring'
import { aplicarPerfil } from '../domain/usuarios'

export function CheckInDiario() {
  const { usuarioActual, ajustes, checkins, guardarCheckin } = useApp()
  const hoy = new Date().toISOString().slice(0, 10)

  const yaRegistrado = checkins.find(
    (item) => item.usuarioId === usuarioActual?.id && item.fecha === hoy,
  )

  const [horasSueno, setHorasSueno] = useState(yaRegistrado?.horasSueno ?? 7)
  const [horasDespierto, setHorasDespierto] = useState(yaRegistrado?.horasDespierto ?? 3)
  const [kss, setKss] = useState(yaRegistrado?.kss ?? 3)
  const [samnPerelli, setSamnPerelli] = useState(yaRegistrado?.samnPerelli ?? 2)
  const [vueloProgramado, setVueloProgramado] = useState(yaRegistrado?.vueloProgramado ?? true)
  const [vueloNocturno, setVueloNocturno] = useState(yaRegistrado?.vueloNocturno ?? false)
  const [notas, setNotas] = useState(yaRegistrado?.notas ?? '')
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  const resultado = useMemo(() => {
    if (!usuarioActual) return null
    const evaluacion = aplicarPerfil(
      {
        ...evaluacionInicial,
        fecha: hoy,
        horasSuenoUltimas24: horasSueno,
        horasSuenoUltimas72: horasSueno * 3,
        horasDespierto,
        kss,
        samnPerelli,
        vueloNocturno,
      },
      usuarioActual,
    )
    return evaluarFatiga(evaluacion, ajustes.umbrales)
  }, [usuarioActual, ajustes.umbrales, hoy, horasSueno, horasDespierto, kss, samnPerelli, vueloNocturno])

  if (!usuarioActual || !resultado) return null

  const registrar = async () => {
    try {
      await guardarCheckin({
        fecha: hoy,
        horasSueno,
        horasDespierto,
        kss,
        samnPerelli,
        vueloProgramado,
        vueloNocturno,
        notas,
        puntaje: resultado.puntaje,
        nivel: resultado.nivel,
      })
      setError('')
      setGuardado(true)
    } catch {
      setError('No se pudo guardar el check-in en el servidor.')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Check-in diario</h1>
        <p className="mt-1 text-sm text-slate-400">
          Registro rápido previo al servicio ({hoy}). Toma menos de un minuto y alimenta el tablero de la unidad.
        </p>
      </div>

      {yaRegistrado && !guardado && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
          Ya existe un check-in registrado hoy; al guardar se actualizará.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="card space-y-4">
            <div>
              <label className="label">Horas dormidas anoche: {horasSueno} h</label>
              <input
                type="range"
                min={0}
                max={12}
                step={0.5}
                value={horasSueno}
                className="w-full accent-cyan-400"
                onChange={(evento) => setHorasSueno(Number(evento.target.value))}
              />
              <p className="mt-1 text-xs text-slate-400">
                (suma el sueño del último periodo de descanso, incluidas siestas; referencia 7-8 h)
              </p>
            </div>
            <div>
              <label className="label">Horas despierto: {horasDespierto} h</label>
              <input
                type="range"
                min={0}
                max={24}
                step={0.5}
                value={horasDespierto}
                className="w-full accent-cyan-400"
                onChange={(evento) => setHorasDespierto(Number(evento.target.value))}
              />
              <p className="mt-1 text-xs text-slate-400">
                (se cuenta desde la hora en que te levantaste por última vez hasta este momento. Ej.: te
                levantaste a las 05:00 y son las 14:00 → 9 h. A partir de 17 h despierto el rendimiento cae de
                forma comparable a una embriaguez leve)
              </p>
            </div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 accent-cyan-500"
                checked={vueloProgramado}
                onChange={(evento) => setVueloProgramado(evento.target.checked)}
              />
              <span className="text-sm text-slate-300">
                Tengo vuelo programado hoy{' '}
                <span className="text-slate-500">(sirve para priorizar los avisos de aptitud)</span>
              </span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 accent-cyan-500"
                checked={vueloNocturno}
                onChange={(evento) => setVueloNocturno(evento.target.checked)}
              />
              <span className="text-sm text-slate-300">
                Operación nocturna (02:00-06:00){' '}
                <span className="text-slate-500">
                  (ventana de baja circadiana: franja de la madrugada en la que el cuerpo empuja al sueño con
                  más fuerza y aumentan los errores, aunque hayas dormido bien)
                </span>
              </span>
            </label>
            <div>
              <label className="label" htmlFor="notas">
                Novedades
              </label>
              <textarea
                id="notas"
                className="input"
                rows={2}
                value={notas}
                placeholder="Ej. guardia adicional, malestar, viaje terrestre largo"
                onChange={(evento) => setNotas(evento.target.value)}
              />
            </div>
          </section>

          <section className="card">
            <p className="label">
              Somnolencia actual (KSS){' '}
              <span className="font-normal text-slate-500">
                (cuánto sueño sientes ahora mismo: 1 = totalmente alerta, 9 = luchando por no dormirte)
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {escalaKss.map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  title={opcion.texto}
                  onClick={() => setKss(opcion.valor)}
                  className={`h-10 w-10 rounded-lg border text-sm font-bold transition ${
                    kss === opcion.valor
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                      : 'border-white/15 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {opcion.valor}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">{escalaKss[kss - 1].texto}</p>

            <p className="label mt-5">
              Fatiga percibida (Samn-Perelli){' '}
              <span className="font-normal text-slate-500">
                (cansancio para desempeñar la tarea, no sueño: 1 = pleno rendimiento, 7 = agotado)
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {escalaSamnPerelli.map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  title={opcion.texto}
                  onClick={() => setSamnPerelli(opcion.valor)}
                  className={`h-10 w-10 rounded-lg border text-sm font-bold transition ${
                    samnPerelli === opcion.valor
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                      : 'border-white/15 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {opcion.valor}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">{escalaSamnPerelli[samnPerelli - 1].texto}</p>
          </section>
        </div>

        <div className="space-y-6">
          <section className={`card border ${colorNivel[resultado.nivel]}`}>
            <p className="text-xs font-semibold uppercase tracking-wider">
              Semáforo de aptitud <span className="font-normal normal-case">(índice 0-100)</span>
            </p>
            <div className="mt-2 flex items-end justify-between">
              <h2 className="text-2xl font-extrabold">{etiquetaNivel[resultado.nivel]}</h2>
              <p className="text-4xl font-black">{resultado.puntaje}</p>
            </div>
            <p className="mt-3 text-sm">{resultado.aptitud}</p>
            <p className="mt-2 text-xs opacity-80">
              (se calcula combinando sueño, horas despierto, KSS y Samn-Perelli: 0 = sin señales de fatiga,
              100 = fatiga máxima estimada. Es una orientación preventiva, no un diagnóstico médico)
            </p>
          </section>

          <section className="card">
            <h3 className="section-title">Acciones sugeridas para hoy</h3>
            {resultado.estrategias.filter((estrategia) => estrategia.horizonte !== 'organizacional').length ===
              0 && (
              <p className="text-sm text-slate-400">
                Sin contramedidas obligatorias: mantén la higiene de sueño y reporta cualquier novedad.
              </p>
            )}
            <ul className="space-y-3">
              {resultado.estrategias
                .filter((estrategia) => estrategia.horizonte !== 'organizacional')
                .slice(0, 4)
                .map((estrategia) => (
                  <li key={estrategia.titulo} className="rounded-lg border border-white/10 p-3">
                    <p className="text-sm font-semibold text-slate-100">{estrategia.titulo}</p>
                    <p className="mt-1 text-xs text-slate-400">{estrategia.descripcion}</p>
                  </li>
                ))}
            </ul>
            <button className="btn-primary mt-5 w-full" onClick={() => void registrar()}>
              {guardado ? 'Check-in registrado' : 'Registrar check-in'}
            </button>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          </section>
        </div>
      </div>
    </div>
  )
}
