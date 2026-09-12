import { useState, type ReactNode } from 'react'
import type { CargoMasDesgastante, Evaluacion, IntencionDejarCargo } from '../domain/types'
import {
  antecedentesMedicos,
  escalaKss,
  escalaSamnPerelli,
  gradosMilitares,
  opcionesCargoDesgastante,
  opcionesEpworth,
  opcionesIntencion,
  situacionesEpworth,
  tiposMision,
} from '../domain/catalogos'
import { calcularEdad, calcularImc } from '../domain/scoring'
import { CampoNumero } from './CampoNumero'

interface Props {
  evaluacion: Evaluacion
  onCambio: (parcial: Partial<Evaluacion>) => void
  onEvaluar: () => void
  onReiniciar: () => void
}

function Leyenda({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-slate-400">{children}</p>
}

export function Formulario({ evaluacion, onCambio, onEvaluar, onReiniciar }: Props) {
  const [paso, setPaso] = useState(0)
  const edad = calcularEdad(evaluacion.fechaNacimiento)
  const imc = calcularImc(evaluacion.pesoKg, evaluacion.tallaCm)

  const pasos: { titulo: string; descripcion: string; contenido: ReactNode }[] = [
    {
      titulo: 'Identificación',
      descripcion:
        'Datos del servicio que se está evaluando (sirven para ubicar el registro en el historial de la unidad).',
      contenido: (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="piloto">
              Apellidos y nombres
            </label>
            <input
              id="piloto"
              className="input"
              value={evaluacion.piloto}
              placeholder="Ej. Vásconez Andrade Luis"
              onChange={(evento) => onCambio({ piloto: evento.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="grado">
              Grado militar
            </label>
            <select
              id="grado"
              className="input"
              value={evaluacion.grado}
              onChange={(evento) => onCambio({ grado: evento.target.value })}
            >
              {gradosMilitares.map((grupo) => (
                <optgroup key={grupo.categoria} label={grupo.categoria}>
                  {grupo.grados.map((grado) => (
                    <option key={grado} value={grado}>
                      {grado}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="unidad">
              Unidad / Escuadrón
            </label>
            <input
              id="unidad"
              className="input"
              value={evaluacion.unidad}
              placeholder="Ej. Ala de Combate N.º 23"
              onChange={(evento) => onCambio({ unidad: evento.target.value })}
            />
            <Leyenda>(permite comparar la fatiga por unidad sin exponer datos individuales)</Leyenda>
          </div>
          <div>
            <label className="label" htmlFor="tipoMision">
              Tipo de misión
            </label>
            <select
              id="tipoMision"
              className="input"
              value={evaluacion.tipoMision}
              onChange={(evento) => onCambio({ tipoMision: evento.target.value as Evaluacion['tipoMision'] })}
            >
              {tiposMision.map((tipo) => (
                <option key={tipo.valor} value={tipo.valor}>
                  {tipo.texto}
                </option>
              ))}
            </select>
            <Leyenda>(unas misiones exigen más atención sostenida que otras y eso pesa en el índice)</Leyenda>
          </div>
          <div>
            <label className="label" htmlFor="fecha">
              Fecha del servicio
            </label>
            <input
              id="fecha"
              type="date"
              className="input"
              value={evaluacion.fecha}
              onChange={(evento) => onCambio({ fecha: evento.target.value })}
            />
            <Leyenda>(día al que corresponde lo que estás respondiendo, no la fecha en que lo llenas)</Leyenda>
          </div>
        </div>
      ),
    },
    {
      titulo: 'Perfil biomédico',
      descripcion:
        'Características personales que modulan la tolerancia a la fatiga (la edad y el IMC se calculan solos).',
      contenido: (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="nacimiento">
                Fecha de nacimiento
              </label>
              <input
                id="nacimiento"
                type="date"
                className="input"
                value={evaluacion.fechaNacimiento}
                onChange={(evento) => onCambio({ fechaNacimiento: evento.target.value })}
              />
              <Leyenda>
                {edad !== null ? `Edad: ${edad} años` : 'Edad: pendiente'} (la edad se calcula automáticamente
                desde esta fecha; con los años la recuperación del sueño suele ser más lenta)
              </Leyenda>
            </div>
            <div>
              <label className="label">Índice de masa corporal (IMC)</label>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                {imc !== null ? `${imc} kg/m²` : 'Ingrese peso y talla'}
                {imc !== null && (
                  <span className="ml-2 text-xs text-slate-400">
                    {imc >= 30 ? 'obesidad' : imc >= 25 ? 'sobrepeso' : 'normal'}
                  </span>
                )}
              </div>
              <Leyenda>
                (relación entre peso y estatura: IMC = peso en kg ÷ talla en metros al cuadrado. Menos de 25 =
                normal, 25 a 29,9 = sobrepeso, 30 o más = obesidad; un IMC alto se asocia a apnea del sueño y
                peor descanso)
              </Leyenda>
            </div>
            <CampoNumero
              id="peso"
              etiqueta="Peso (kg)"
              valor={evaluacion.pesoKg}
              min={35}
              max={200}
              paso={0.5}
              ayuda="(peso corporal actual en kilogramos; se usa solo para calcular el IMC)"
              onCambio={(valor) => onCambio({ pesoKg: valor })}
            />
            <CampoNumero
              id="talla"
              etiqueta="Talla (cm)"
              valor={evaluacion.tallaCm}
              min={130}
              max={220}
              ayuda="(estatura en centímetros, por ejemplo 172; se usa solo para calcular el IMC)"
              onCambio={(valor) => onCambio({ tallaCm: valor })}
            />
          </div>

          <p className="mb-2 mt-5 text-sm font-medium text-slate-300">
            Antecedentes médicos{' '}
            <span className="font-normal text-slate-500">
              (condiciones que alteran el sueño o la recuperación; marca las que tengas diagnosticadas)
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {antecedentesMedicos.map((antecedente) => {
              const activo = evaluacion.antecedentes.includes(antecedente.valor)
              return (
                <button
                  type="button"
                  key={antecedente.valor}
                  onClick={() =>
                    onCambio({
                      antecedentes: activo
                        ? evaluacion.antecedentes.filter((item) => item !== antecedente.valor)
                        : [...evaluacion.antecedentes, antecedente.valor],
                    })
                  }
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    activo
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                      : 'border-white/15 bg-white/5 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {antecedente.texto}
                </button>
              )
            })}
          </div>
          <div className="mt-4">
            <label className="label" htmlFor="otros">
              Otros antecedentes o medicación
            </label>
            <input
              id="otros"
              className="input"
              value={evaluacion.antecedentesOtros}
              placeholder="Ej. migraña en tratamiento"
              onChange={(evento) => onCambio({ antecedentesOtros: evento.target.value })}
            />
            <Leyenda>(algunos medicamentos producen somnolencia o insomnio y explican resultados altos)</Leyenda>
          </div>
        </>
      ),
    },
    {
      titulo: 'Funciones, cargos y jornada',
      descripcion:
        'Cuánta responsabilidad acumulas y en qué condiciones trabajas (la sobrecarga sin relevo es un factor central de fatiga crónica).',
      contenido: (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="funcionPrincipal">
              Función principal
            </label>
            <input
              id="funcionPrincipal"
              className="input"
              value={evaluacion.funcionPrincipal}
              placeholder="Ej. Piloto de transporte táctico"
              onChange={(evento) => onCambio({ funcionPrincipal: evento.target.value })}
            />
            <Leyenda>(la actividad a la que dedicas la mayor parte de tu tiempo de servicio)</Leyenda>
          </div>
          <div>
            <label className="label" htmlFor="funcionSecundaria">
              Función secundaria
            </label>
            <input
              id="funcionSecundaria"
              className="input"
              value={evaluacion.funcionSecundaria}
              placeholder="Ej. Instructor de vuelo"
              onChange={(evento) => onCambio({ funcionSecundaria: evento.target.value })}
            />
            <Leyenda>(otra actividad que cumples además de la principal; déjalo vacío si no aplica)</Leyenda>
          </div>
          <div>
            <label className="label" htmlFor="cargoPrincipal">
              Cargo principal
            </label>
            <input
              id="cargoPrincipal"
              className="input"
              value={evaluacion.cargoPrincipal}
              placeholder="Ej. Jefe de operaciones del escuadrón"
              onChange={(evento) => onCambio({ cargoPrincipal: evento.target.value })}
            />
            <Leyenda>(puesto orgánico que ocupas, con su responsabilidad administrativa)</Leyenda>
          </div>
          <div>
            <label className="label" htmlFor="cargoAdicional">
              Cargo adicional
            </label>
            <input
              id="cargoAdicional"
              className="input"
              value={evaluacion.cargoAdicional}
              placeholder="Ej. Oficial de seguridad operacional"
              onChange={(evento) => onCambio({ cargoAdicional: evento.target.value })}
            />
            <Leyenda>(cargos que asumes «además de lo tuyo», habitualmente por falta de personal)</Leyenda>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="masDesgastante">
              ¿Cuál percibe como el más desgastante?
            </label>
            <select
              id="masDesgastante"
              className="input"
              value={evaluacion.cargoMasDesgastante}
              onChange={(evento) =>
                onCambio({ cargoMasDesgastante: evento.target.value as CargoMasDesgastante })
              }
            >
              {opcionesCargoDesgastante.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.texto}
                </option>
              ))}
            </select>
            <Leyenda>(sirve para orientar las medidas: no es lo mismo aliviar vuelo que carga administrativa)</Leyenda>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Nivel de desgaste percibido: {evaluacion.desgastePercibido}/5</label>
            <input
              type="range"
              min={1}
              max={5}
              value={evaluacion.desgastePercibido}
              className="w-full accent-cyan-400"
              onChange={(evento) => onCambio({ desgastePercibido: Number(evento.target.value) })}
            />
            <Leyenda>(1 = llevadero, 5 = agotador; es tu percepción global del conjunto de tareas)</Leyenda>
          </div>
          <CampoNumero
            etiqueta="Horas laborales diarias (promedio)"
            valor={evaluacion.horasLaboralesDiarias}
            min={0}
            max={24}
            paso={0.5}
            ayuda="(promedio de horas de servicio por día en las últimas semanas, incluyendo trabajo administrativo. Jornada de referencia: 8 h)"
            onCambio={(valor) => onCambio({ horasLaboralesDiarias: valor })}
          />
          <CampoNumero
            etiqueta="Días libres en el último mes"
            valor={evaluacion.diasLibresMes}
            min={0}
            max={31}
            ayuda="(días completos sin servicio ni disponibilidad en los últimos 30 días; sin ellos no hay recuperación del sueño)"
            onCambio={(valor) => onCambio({ diasLibresMes: valor })}
          />
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-cyan-400"
              checked={evaluacion.tieneRelevo}
              onChange={(evento) => onCambio({ tieneRelevo: evento.target.checked })}
            />
            <span className="text-sm text-slate-300">
              Existe personal de relevo para mis funciones{' '}
              <span className="text-slate-500">(alguien puede cubrir tu puesto si necesitas descansar)</span>
            </span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-cyan-400"
              checked={evaluacion.recibeIncentivos}
              onChange={(evento) => onCambio({ recibeIncentivos: evento.target.checked })}
            />
            <span className="text-sm text-slate-300">
              Recibo incentivos o compensación por la carga adicional{' '}
              <span className="text-slate-500">(reconocimiento, tiempo compensatorio o bonificación)</span>
            </span>
          </label>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="intencion">
              ¿Tiene intención de dejar el cargo por el momento?
            </label>
            <select
              id="intencion"
              className="input"
              value={evaluacion.intencionDejarCargo}
              onChange={(evento) =>
                onCambio({ intencionDejarCargo: evento.target.value as IntencionDejarCargo })
              }
            >
              {opcionesIntencion.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.texto}
                </option>
              ))}
            </select>
            <Leyenda>(señal temprana de desgaste sostenido; es un dato agregado, no una solicitud formal)</Leyenda>
          </div>
        </div>
      ),
    },
    {
      titulo: 'Sueño y vigilia',
      descripcion:
        'Cuánto dormiste y cuánto llevas despierto. Es el bloque que más peso tiene en el índice de fatiga aguda.',
      contenido: (
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoNumero
            etiqueta="Horas dormidas en las últimas 24 h"
            valor={evaluacion.horasSuenoUltimas24}
            min={0}
            max={16}
            paso={0.5}
            ayuda="(suma todo el sueño del último día, incluidas siestas. Referencia: 7-8 h; menos de 5 h ya deteriora la atención)"
            onCambio={(valor) => onCambio({ horasSuenoUltimas24: valor })}
          />
          <CampoNumero
            etiqueta="Horas dormidas en las últimas 72 h"
            valor={evaluacion.horasSuenoUltimas72}
            min={0}
            max={40}
            paso={0.5}
            ayuda="(suma del sueño de los últimos tres días; detecta la deuda acumulada. Referencia operacional: 24 h acumuladas)"
            onCambio={(valor) => onCambio({ horasSuenoUltimas72: valor })}
          />
          <CampoNumero
            etiqueta="Horas despierto desde el último despertar"
            valor={evaluacion.horasDespierto}
            min={0}
            max={30}
            paso={0.5}
            ayuda="(se cuenta desde la hora en que te levantaste por última vez hasta ahora, aunque hayas tenido pausas sin dormir. Ej.: te levantaste a las 05:00 y son las 14:00 → 9 h. Pasadas 17 h despierto el rendimiento se parece al de una embriaguez leve)"
            onCambio={(valor) => onCambio({ horasDespierto: valor })}
          />
          <div>
            <label className="label">Calidad subjetiva del último sueño: {evaluacion.calidadSueno}/5</label>
            <input
              type="range"
              min={1}
              max={5}
              value={evaluacion.calidadSueno}
              className="w-full accent-cyan-400"
              onChange={(evento) => onCambio({ calidadSueno: Number(evento.target.value) })}
            />
            <Leyenda>
              (1 = muy mala, 5 = reparadora; cómo te sentiste al despertar, más allá del número de horas)
            </Leyenda>
          </div>
        </div>
      ),
    },
    {
      titulo: 'Carga operacional',
      descripcion: 'Exigencia del servicio que vas a cumplir o acabas de cumplir.',
      contenido: (
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoNumero
            etiqueta="Duración prevista del servicio (h)"
            valor={evaluacion.duracionServicio}
            min={0}
            max={24}
            paso={0.5}
            ayuda="(horas entre la presentación y el término previsto del turno, incluyendo preparación y espera)"
            onCambio={(valor) => onCambio({ duracionServicio: valor })}
          />
          <CampoNumero
            etiqueta="Número de sectores / tramos"
            valor={evaluacion.sectores}
            min={0}
            max={12}
            ayuda="(cada despegue y aterrizaje cuenta como un tramo; más tramos = más fases críticas en el mismo turno)"
            onCambio={(valor) => onCambio({ sectores: valor })}
          />
          <CampoNumero
            etiqueta="Husos horarios cruzados en las últimas 72 h"
            valor={evaluacion.husosHorarios}
            min={0}
            max={12}
            ayuda="(diferencia de horas entre el lugar de origen y el actual; desajusta el reloj biológico)"
            onCambio={(valor) => onCambio({ husosHorarios: valor })}
          />
          <CampoNumero
            etiqueta="Días consecutivos de vuelo"
            valor={evaluacion.diasConsecutivos}
            min={0}
            max={20}
            ayuda="(días seguidos volando sin un día completo de descanso de por medio)"
            onCambio={(valor) => onCambio({ diasConsecutivos: valor })}
          />
          <label className="flex items-start gap-3 sm:col-span-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-cyan-400"
              checked={evaluacion.vueloNocturno}
              onChange={(evento) => onCambio({ vueloNocturno: evento.target.checked })}
            />
            <span className="text-sm text-slate-300">
              La misión ocurre total o parcialmente entre las 02:00 y las 06:00{' '}
              <span className="text-slate-500">
                (ventana de baja circadiana: franja de la madrugada en la que el cuerpo empuja al sueño con más
                fuerza y aumentan los errores, aunque se haya dormido bien)
              </span>
            </span>
          </label>
        </div>
      ),
    },
    {
      titulo: 'Escala de somnolencia de Karolinska (KSS)',
      descripcion:
        'Mide cuánto sueño sientes AHORA MISMO, en este instante (escala internacional de 1 a 9: 1 = totalmente alerta, 9 = luchando por no dormirte). Elige una sola opción.',
      contenido: (
        <div className="grid gap-2">
          {escalaKss.map((opcion) => (
            <label
              key={opcion.valor}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                evaluacion.kss === opcion.valor ? 'border-cyan-400 bg-cyan-500/15' : 'border-white/10'
              }`}
            >
              <input
                type="radio"
                name="kss"
                className="accent-cyan-400"
                checked={evaluacion.kss === opcion.valor}
                onChange={() => onCambio({ kss: opcion.valor })}
              />
              <span className="font-semibold text-cyan-200">{opcion.valor}</span>
              <span>{opcion.texto}</span>
            </label>
          ))}
        </div>
      ),
    },
    {
      titulo: 'Escala de fatiga Samn-Perelli',
      descripcion:
        'Mide el cansancio para desempeñar la tarea, no el sueño (escala aeronáutica de 1 a 7: 1 = pleno rendimiento, 7 = agotado, incapaz de funcionar). Elige una sola opción.',
      contenido: (
        <div className="grid gap-2">
          {escalaSamnPerelli.map((opcion) => (
            <label
              key={opcion.valor}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                evaluacion.samnPerelli === opcion.valor ? 'border-cyan-400 bg-cyan-500/15' : 'border-white/10'
              }`}
            >
              <input
                type="radio"
                name="samn"
                className="accent-cyan-400"
                checked={evaluacion.samnPerelli === opcion.valor}
                onChange={() => onCambio({ samnPerelli: opcion.valor })}
              />
              <span className="font-semibold text-cyan-200">{opcion.valor}</span>
              <span>{opcion.texto}</span>
            </label>
          ))}
        </div>
      ),
    },
    {
      titulo: 'Escala de somnolencia de Epworth',
      descripcion:
        'Mide la somnolencia habitual de las últimas semanas, no la de hoy (se suman 8 situaciones de 0 a 3; total de 0 a 24: más de 10 sugiere somnolencia excesiva que conviene revisar con el servicio de sanidad).',
      contenido: (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Probabilidad de quedarse dormido en cada situación durante las últimas semanas (no «sentirse
            cansado»: dormirse de verdad). Responde aunque no hayas vivido la situación recientemente:
            imagina cómo te afectaría.
          </p>
          {situacionesEpworth.map((situacion, indice) => (
            <div key={situacion}>
              <p className="mb-2 text-sm font-medium text-slate-300">{situacion}</p>
              <div className="flex flex-wrap gap-2">
                {opcionesEpworth.map((opcion) => (
                  <button
                    type="button"
                    key={opcion.valor}
                    onClick={() => {
                      const respuestas = [...evaluacion.epworth]
                      respuestas[indice] = opcion.valor
                      onCambio({ epworth: respuestas })
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      evaluacion.epworth[indice] === opcion.valor
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-white/15 bg-white/5 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    {opcion.texto}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ),
    },
  ]

  const actual = pasos[paso]
  const ultimo = paso === pasos.length - 1
  const progreso = Math.round(((paso + 1) / pasos.length) * 100)

  const irA = (indice: number) => {
    setPaso(Math.min(pasos.length - 1, Math.max(0, indice)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(evento) => {
        evento.preventDefault()
        if (!ultimo) {
          irA(paso + 1)
          return
        }
        onEvaluar()
      }}
    >
      <div className="card space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-white">
            Paso {paso + 1} de {pasos.length}: {actual.titulo}
          </p>
          <p className="text-xs text-slate-400">{progreso}% del cuestionario</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-cyan-400 transition-all duration-500"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pasos.map((item, indice) => (
            <button
              type="button"
              key={item.titulo}
              onClick={() => irA(indice)}
              title={item.titulo}
              className={`h-7 w-7 rounded-full border text-xs font-semibold transition ${
                indice === paso
                  ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                  : indice < paso
                    ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300/80'
                    : 'border-white/15 bg-white/5 text-slate-400'
              }`}
            >
              {indice + 1}
            </button>
          ))}
        </div>
      </div>

      <section className="card">
        <h2 className="section-title">
          {paso + 1}. {actual.titulo}
        </h2>
        <p className="mb-4 text-sm text-slate-400">{actual.descripcion}</p>
        {actual.contenido}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-ghost disabled:opacity-40"
          disabled={paso === 0}
          onClick={() => irA(paso - 1)}
        >
          Anterior
        </button>
        <button type="submit" className="btn-primary">
          {ultimo ? 'Calcular diagnóstico' : 'Siguiente'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            onReiniciar()
            irA(0)
          }}
        >
          Reiniciar formulario
        </button>
        <p className="text-xs text-slate-500">
          (las respuestas se conservan al moverte entre pasos; el cálculo se realiza al final)
        </p>
      </div>
    </form>
  )
}
