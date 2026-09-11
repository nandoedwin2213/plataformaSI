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

interface Props {
  evaluacion: Evaluacion
  onCambio: (parcial: Partial<Evaluacion>) => void
  onEvaluar: () => void
  onReiniciar: () => void
}

function CampoNumero({
  etiqueta,
  valor,
  min,
  max,
  paso = 1,
  ayuda,
  onCambio,
}: {
  etiqueta: string
  valor: number
  min: number
  max: number
  paso?: number
  ayuda?: string
  onCambio: (valor: number) => void
}) {
  return (
    <div>
      <label className="label">{etiqueta}</label>
      <input
        type="number"
        className="input"
        value={valor}
        min={min}
        max={max}
        step={paso}
        onChange={(evento) => onCambio(Number(evento.target.value))}
      />
      {ayuda && <p className="mt-1 text-xs text-slate-400">{ayuda}</p>}
    </div>
  )
}

export function Formulario({ evaluacion, onCambio, onEvaluar, onReiniciar }: Props) {
  const edad = calcularEdad(evaluacion.fechaNacimiento)
  const imc = calcularImc(evaluacion.pesoKg, evaluacion.tallaCm)

  return (
    <form
      className="space-y-6"
      onSubmit={(evento) => {
        evento.preventDefault()
        onEvaluar()
      }}
    >
      <section className="card">
        <h2 className="section-title">1. Identificación</h2>
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
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">2. Perfil biomédico</h2>
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
            <p className="mt-1 text-xs text-slate-400">
              {edad !== null ? `Edad: ${edad} años` : 'Edad: pendiente'}
            </p>
          </div>
          <div>
            <label className="label">Índice de masa corporal</label>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
              {imc !== null ? `${imc} kg/m²` : 'Ingrese peso y talla'}
              {imc !== null && (
                <span className="ml-2 text-xs text-slate-400">
                  {imc >= 30 ? 'obesidad' : imc >= 25 ? 'sobrepeso' : 'normal'}
                </span>
              )}
            </div>
          </div>
          <CampoNumero
            etiqueta="Peso (kg)"
            valor={evaluacion.pesoKg}
            min={35}
            max={200}
            paso={0.5}
            onCambio={(valor) => onCambio({ pesoKg: valor })}
          />
          <CampoNumero
            etiqueta="Talla (cm)"
            valor={evaluacion.tallaCm}
            min={130}
            max={220}
            onCambio={(valor) => onCambio({ tallaCm: valor })}
          />
        </div>

        <p className="mb-2 mt-5 text-sm font-medium text-slate-300">Antecedentes médicos</p>
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
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">3. Funciones, cargos y jornada</h2>
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
            <p className="mt-1 text-xs text-slate-400">1 = llevadero, 5 = agotador</p>
          </div>
          <CampoNumero
            etiqueta="Horas laborales diarias (promedio)"
            valor={evaluacion.horasLaboralesDiarias}
            min={0}
            max={24}
            paso={0.5}
            ayuda="Jornada de referencia: 8 h"
            onCambio={(valor) => onCambio({ horasLaboralesDiarias: valor })}
          />
          <CampoNumero
            etiqueta="Días libres en el último mes"
            valor={evaluacion.diasLibresMes}
            min={0}
            max={31}
            onCambio={(valor) => onCambio({ diasLibresMes: valor })}
          />
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-cyan-400"
              checked={evaluacion.tieneRelevo}
              onChange={(evento) => onCambio({ tieneRelevo: evento.target.checked })}
            />
            <span className="text-sm text-slate-300">Existe personal de relevo para mis funciones</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-cyan-400"
              checked={evaluacion.recibeIncentivos}
              onChange={(evento) => onCambio({ recibeIncentivos: evento.target.checked })}
            />
            <span className="text-sm text-slate-300">
              Recibo incentivos o compensación por la carga adicional
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
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">4. Sueño y vigilia</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoNumero
            etiqueta="Horas dormidas en las últimas 24 h"
            valor={evaluacion.horasSuenoUltimas24}
            min={0}
            max={16}
            paso={0.5}
            onCambio={(valor) => onCambio({ horasSuenoUltimas24: valor })}
          />
          <CampoNumero
            etiqueta="Horas dormidas en las últimas 72 h"
            valor={evaluacion.horasSuenoUltimas72}
            min={0}
            max={40}
            paso={0.5}
            ayuda="Referencia operacional: 24 h acumuladas"
            onCambio={(valor) => onCambio({ horasSuenoUltimas72: valor })}
          />
          <CampoNumero
            etiqueta="Horas despierto desde el último despertar"
            valor={evaluacion.horasDespierto}
            min={0}
            max={30}
            paso={0.5}
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
            <p className="mt-1 text-xs text-slate-400">1 = muy mala, 5 = reparadora</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">5. Carga operacional</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoNumero
            etiqueta="Duración prevista del servicio (h)"
            valor={evaluacion.duracionServicio}
            min={0}
            max={24}
            paso={0.5}
            onCambio={(valor) => onCambio({ duracionServicio: valor })}
          />
          <CampoNumero
            etiqueta="Número de sectores / tramos"
            valor={evaluacion.sectores}
            min={0}
            max={12}
            onCambio={(valor) => onCambio({ sectores: valor })}
          />
          <CampoNumero
            etiqueta="Husos horarios cruzados en las últimas 72 h"
            valor={evaluacion.husosHorarios}
            min={0}
            max={12}
            onCambio={(valor) => onCambio({ husosHorarios: valor })}
          />
          <CampoNumero
            etiqueta="Días consecutivos de vuelo"
            valor={evaluacion.diasConsecutivos}
            min={0}
            max={20}
            onCambio={(valor) => onCambio({ diasConsecutivos: valor })}
          />
          <label className="flex items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-cyan-400"
              checked={evaluacion.vueloNocturno}
              onChange={(evento) => onCambio({ vueloNocturno: evento.target.checked })}
            />
            <span className="text-sm text-slate-300">
              La misión ocurre total o parcialmente entre las 02:00 y las 06:00 (ventana de baja circadiana)
            </span>
          </label>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">6. Escala de somnolencia de Karolinska (KSS)</h2>
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
      </section>

      <section className="card">
        <h2 className="section-title">7. Escala de fatiga Samn-Perelli</h2>
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
      </section>

      <section className="card">
        <h2 className="section-title">8. Escala de somnolencia de Epworth</h2>
        <p className="mb-4 text-sm text-slate-400">
          Probabilidad de quedarse dormido en cada situación durante las últimas semanas.
        </p>
        <div className="space-y-4">
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
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary">
          Calcular diagnóstico
        </button>
        <button type="button" className="btn-ghost" onClick={onReiniciar}>
          Reiniciar formulario
        </button>
      </div>
    </form>
  )
}
