import { Link } from 'react-router-dom'
import { useApp } from '../store/contexto'
import { LineaTendencia, MapaCalor } from '../components/Graficos'
import { colorNivel, etiquetaNivel } from '../domain/catalogos'
import { proyectarFatiga } from '../domain/prediccion'

function ultimosDias(cantidad: number): string[] {
  const dias: string[] = []
  for (let indice = cantidad - 1; indice >= 0; indice -= 1) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - indice)
    dias.push(fecha.toISOString().slice(0, 10))
  }
  return dias
}

export function Inicio() {
  const { usuarioActual, checkins, registros, instrumentos, ajustes } = useApp()
  if (!usuarioActual) return null

  const hoy = new Date().toISOString().slice(0, 10)
  const mios = checkins
    .filter((item) => item.usuarioId === usuarioActual.id)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const checkinHoy = mios.find((item) => item.fecha === hoy)
  const serie = mios.slice(-14).map((item) => ({ etiqueta: item.fecha.slice(5), valor: item.puntaje }))
  const calendario = ultimosDias(28).map((fecha) => ({
    fecha,
    valor: mios.find((item) => item.fecha === fecha)?.puntaje ?? null,
  }))
  const promedio = mios.length
    ? Math.round(mios.slice(-14).reduce((suma, item) => suma + item.puntaje, 0) / Math.min(mios.length, 14))
    : 0
  const suenoPromedio = mios.length
    ? Math.round(
        (mios.slice(-7).reduce((suma, item) => suma + item.horasSueno, 0) / Math.min(mios.length, 7)) * 10,
      ) / 10
    : 0
  const misEvaluaciones = registros.filter((registro) => registro.usuarioId === usuarioActual.id)
  const proyeccion = proyectarFatiga(mios, ajustes.umbrales)
  const serieProyectada =
    proyeccion?.dias.map((dia) => ({ etiqueta: dia.fecha.slice(5), valor: dia.puntaje })) ?? []

  const pendientes = instrumentos.filter(
    (instrumento) => instrumento.tipo === 'personalizado' && instrumento.miRespuesta?.estado !== 'finalizada',
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Hola, {usuarioActual.grado} {usuarioActual.nombre}</h1>
          <p className="mt-1 text-sm text-slate-400">Resumen operativo del {hoy}</p>
        </div>
        <Link to="/checkin" className="btn-primary">
          {checkinHoy ? 'Actualizar check-in de hoy' : 'Hacer check-in de hoy'}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`card border ${checkinHoy ? colorNivel[checkinHoy.nivel] : ''}`}>
          <p className="text-xs uppercase text-slate-400">Estado de hoy</p>
          <p className="mt-1 text-2xl font-bold">
            {checkinHoy ? etiquetaNivel[checkinHoy.nivel] : 'Sin check-in'}
          </p>
          {checkinHoy && <p className="text-xs">Índice {checkinHoy.puntaje}/100</p>}
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Índice promedio (14 d)</p>
          <p className="mt-1 text-3xl font-bold text-cyan-300">{promedio}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Sueño promedio (7 d)</p>
          <p className="mt-1 text-3xl font-bold text-cyan-300">{suenoPromedio} h</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Evaluaciones completas</p>
          <p className="mt-1 text-3xl font-bold text-cyan-300">{misEvaluaciones.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="section-title">Tendencia del índice y proyección a 7 días</h2>
          <LineaTendencia datos={serie} proyeccion={serieProyectada} />
          <p className="mt-3 text-xs text-slate-500">
            {proyeccion
              ? `Deuda de sueño acumulada: ${proyeccion.deudaSueno} h · confianza ${proyeccion.confianza}. `
              : 'Registra al menos 3 check-ins para ver la proyección. '}
            <Link to="/ficha" className="text-cyan-400 hover:underline">
              Ver ficha longitudinal
            </Link>
          </p>
        </section>
        <section className="card">
          <h2 className="section-title">Últimas 4 semanas</h2>
          <MapaCalor datos={calendario} />
          <p className="mt-3 text-xs text-slate-500">
            Verde: riesgo bajo · Ámbar: moderado · Naranja: alto · Rojo: crítico · Gris: sin registro
          </p>
        </section>
      </div>

      <section className="card">
        <h2 className="section-title">Evaluaciones asignadas</h2>
        {pendientes.length === 0 ? (
          <p className="text-sm text-slate-400">
            No tienes evaluaciones pendientes de la unidad.{' '}
            <Link to="/pruebas" className="text-cyan-400 hover:underline">
              Ver mis evaluaciones
            </Link>
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {pendientes.map((instrumento) => (
              <li key={instrumento.id} className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-slate-300">{instrumento.nombre}</span>
                <Link to={`/pruebas/${instrumento.id}`} className="btn-ghost">
                  {instrumento.miRespuesta ? 'Continuar' : 'Iniciar'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
