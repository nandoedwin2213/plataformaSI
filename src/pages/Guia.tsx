import { useApp } from '../store/contexto'

export function Guia() {
  const { ajustes } = useApp()
  const { moderado, alto, critico } = ajustes.umbrales

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Guía clínica y de mitigación</h1>
        <p className="mt-1 text-sm text-slate-400">
          Referencia rápida para interpretar el índice y aplicar contramedidas.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="section-title">Interpretación del índice</h2>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>
              <strong className="text-emerald-300">0-{moderado - 1} · Riesgo bajo:</strong> operación normal con
              medidas preventivas habituales.
            </li>
            <li>
              <strong className="text-amber-300">
                {moderado}-{alto - 1} · Riesgo moderado:
              </strong>{' '}
              aplicar contramedidas antes y durante el vuelo.
            </li>
            <li>
              <strong className="text-orange-300">
                {alto}-{critico - 1} · Riesgo alto:
              </strong>{' '}
              revisión con el supervisor de operaciones; mitigaciones obligatorias y posible refuerzo de
              tripulación.
            </li>
            <li>
              <strong className="text-red-300">{critico}-100 · Riesgo crítico:</strong> no se recomienda volar;
              declarar fatiga y notificar al médico de aviación.
            </li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Un KSS ≥ 8, un Samn-Perelli ≥ 6, menos de 4 h de sueño en 24 h, o una jornada mayor a 12 h sin
            personal de relevo elevan automáticamente el nivel a riesgo alto como mínimo.
          </p>
        </section>

        <section className="card">
          <h2 className="section-title">Contramedidas individuales</h2>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>
              <strong>Siesta preventiva:</strong> 20-30 min (sin inercia marcada) o 90-120 min (ciclo completo).
            </li>
            <li>
              <strong>Cafeína:</strong> 100-200 mg, efecto en 20-30 min; evitar 6 h antes del descanso.
            </li>
            <li>
              <strong>Luz:</strong> luz brillante para retrasar el sueño, oscuridad y antifaz para adelantarlo.
            </li>
            <li>
              <strong>Rotación de tareas:</strong> alternar controles cada 30-45 min en la ventana 02:00-06:00.
            </li>
            <li>
              <strong>Recuperación:</strong> dos noches consecutivas de sueño sin restricción restablecen la mayor
              parte del déficit agudo.
            </li>
          </ul>
        </section>

        <section className="card">
          <h2 className="section-title">Medidas organizacionales</h2>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>
              <strong>Redistribución de cargos:</strong> ningún tripulante debería acumular más de un cargo
              adicional crítico de forma permanente.
            </li>
            <li>
              <strong>Plan de relevos:</strong> formar reemplazos para funciones sin respaldo y documentar quién
              cubre cada puesto.
            </li>
            <li>
              <strong>Descanso protegido:</strong> garantizar días libres reales, sin llamadas ni guardias
              administrativas.
            </li>
            <li>
              <strong>Jornada:</strong> limitar la carga administrativa alrededor del vuelo cuando la jornada
              supera las {ajustes.jornadaReferencia} h de referencia.
            </li>
            <li>
              <strong>Retención:</strong> entrevista y apoyo psicológico cuando aparece intención de dejar el
              cargo o desgaste percibido alto.
            </li>
          </ul>
        </section>

        <section className="card">
          <h2 className="section-title">Escalas utilizadas</h2>
          <p className="text-sm text-slate-300">
            <strong>KSS (Karolinska Sleepiness Scale):</strong> somnolencia en los últimos 10 minutos, 1 a 9.{' '}
            <strong>Samn-Perelli:</strong> escala de fatiga de siete puntos usada en aviación militar y comercial.{' '}
            <strong>Epworth:</strong> propensión a dormirse en situaciones cotidianas; un total ≥ 11 sugiere
            somnolencia diurna excesiva y motiva evaluación médica.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Esta plataforma es una ayuda a la decisión y no sustituye el criterio del médico de aviación ni la
            normativa vigente de la unidad.
          </p>
        </section>
      </div>
    </div>
  )
}
