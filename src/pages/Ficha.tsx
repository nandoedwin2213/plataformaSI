import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../store/contexto'
import { LineaTendencia, MapaCalor } from '../components/Graficos'
import { colorNivel, etiquetaNivel } from '../domain/catalogos'
import { proyectarFatiga } from '../domain/prediccion'
import { fechaLocal } from '../domain/fechas'

function ultimosDias(cantidad: number): string[] {
  const dias: string[] = []
  for (let indice = cantidad - 1; indice >= 0; indice -= 1) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - indice)
    dias.push(fechaLocal(fecha))
  }
  return dias
}

function edadDesde(fechaNacimiento: string): number | null {
  if (!fechaNacimiento) return null
  const nacimiento = new Date(fechaNacimiento)
  if (Number.isNaN(nacimiento.getTime())) return null
  const diferencia = Date.now() - nacimiento.getTime()
  return Math.floor(diferencia / (365.25 * 24 * 60 * 60 * 1000))
}

export function Ficha() {
  const { id } = useParams<{ id: string }>()
  const { usuarioActual, usuarios, checkins, registros, ajustes } = useApp()

  const persona = usuarios.find((usuario) => usuario.id === (id ?? usuarioActual?.id))

  const historial = useMemo(
    () =>
      checkins
        .filter((checkin) => checkin.usuarioId === persona?.id)
        .sort((uno, otro) => uno.fecha.localeCompare(otro.fecha)),
    [checkins, persona?.id],
  )

  const proyeccion = useMemo(
    () => proyectarFatiga(historial, ajustes.umbrales),
    [historial, ajustes.umbrales],
  )

  if (!usuarioActual) return null
  if (!persona) {
    return <p className="card text-sm text-slate-400">Personal no encontrado.</p>
  }

  const esPropia = persona.id === usuarioActual.id
  if (!esPropia && usuarioActual.rol !== 'admin') {
    return <p className="card text-sm text-slate-400">Solo puedes consultar tu propia ficha.</p>
  }

  const evaluaciones = registros
    .filter((registro) => registro.usuarioId === persona.id)
    .sort((uno, otro) => otro.creadoEn.localeCompare(uno.creadoEn))
  const serie = historial.slice(-14).map((checkin) => ({
    etiqueta: checkin.fecha.slice(5),
    valor: checkin.puntaje,
  }))
  const serieProyectada =
    proyeccion?.dias.map((dia) => ({ etiqueta: dia.fecha.slice(5), valor: dia.puntaje })) ?? []
  const calendario = ultimosDias(28).map((fecha) => ({
    fecha,
    valor: historial.find((checkin) => checkin.fecha === fecha)?.puntaje ?? null,
  }))
  const edad = edadDesde(persona.perfil.fechaNacimiento)
  const imc =
    persona.perfil.pesoKg && persona.perfil.tallaCm
      ? Math.round((persona.perfil.pesoKg / (persona.perfil.tallaCm / 100) ** 2) * 10) / 10
      : null
  const picoProyectado = proyeccion?.dias.reduce(
    (maximo, dia) => (dia.puntaje > maximo.puntaje ? dia : maximo),
    proyeccion.dias[0],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            Ficha longitudinal · {persona.grado} {persona.nombre}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {persona.unidad} · {persona.correo}
            {edad !== null && ` · ${edad} años`}
            {imc !== null && ` · IMC ${imc}`}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn-ghost" onClick={() => window.print()}>
            Imprimir informe
          </button>
          {usuarioActual.rol === 'admin' && (
            <Link to="/admin/estadisticas" className="btn-ghost">
              Volver a estadísticas
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Check-ins registrados</p>
          <p className="mt-1 text-3xl font-bold text-cyan-300">{historial.length}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Deuda de sueño (7 d)</p>
          <p className="mt-1 text-3xl font-bold text-cyan-300">{proyeccion?.deudaSueno ?? 0} h</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Tendencia</p>
          <p className="mt-1 text-3xl font-bold text-cyan-300">
            {proyeccion ? `${proyeccion.pendiente > 0 ? '+' : ''}${proyeccion.pendiente.toFixed(1)}` : '—'}
          </p>
          <p className="text-xs text-slate-500">puntos por día</p>
        </div>
        <div className={`card border ${picoProyectado ? colorNivel[picoProyectado.nivel] : ''}`}>
          <p className="text-xs uppercase text-slate-400">Pico proyectado (7 d)</p>
          <p className="mt-1 text-2xl font-bold">
            {picoProyectado ? `${picoProyectado.puntaje}/100` : 'Sin datos'}
          </p>
          {picoProyectado && <p className="text-xs">{etiquetaNivel[picoProyectado.nivel]}</p>}
        </div>
      </div>

      <section className="card">
        <h2 className="section-title">Índice observado y proyección a 7 días</h2>
        <LineaTendencia datos={serie} proyeccion={serieProyectada} />
        <p className="mt-3 text-xs text-slate-500">
          Línea continua: check-ins registrados. Línea punteada: proyección a partir de la tendencia reciente
          y la deuda de sueño acumulada frente a 8 h diarias
          {proyeccion && ` · confianza ${proyeccion.confianza}`}. Es una estimación de apoyo, no un
          diagnóstico médico.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="section-title">Cargos y funciones</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['Función principal', persona.perfil.funcionPrincipal],
              ['Función secundaria', persona.perfil.funcionSecundaria],
              ['Cargo principal', persona.perfil.cargoPrincipal],
              ['Cargo adicional', persona.perfil.cargoAdicional],
              ['Antecedentes', persona.perfil.antecedentes.join(', ')],
              ['Otros antecedentes', persona.perfil.antecedentesOtros],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex justify-between gap-4 border-b border-white/5 pb-1">
                <dt className="text-slate-400">{etiqueta}</dt>
                <dd className="text-right text-slate-200">{valor || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card">
          <h2 className="section-title">Últimas 4 semanas</h2>
          <MapaCalor datos={calendario} />
          <h3 className="section-title mt-6">Proyección diaria</h3>
          {proyeccion ? (
            <ul className="space-y-1 text-sm">
              {proyeccion.dias.map((dia) => (
                <li key={dia.fecha} className="flex justify-between">
                  <span className="text-slate-400">{dia.fecha}</span>
                  <span className={`rounded-full border px-2 text-xs ${colorNivel[dia.nivel]}`}>
                    {dia.puntaje}/100 · {etiquetaNivel[dia.nivel]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">
              Se requieren al menos 3 check-ins para proyectar la evolución.
            </p>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="section-title">Evaluaciones completas ({evaluaciones.length})</h2>
        {evaluaciones.length === 0 ? (
          <p className="text-sm text-slate-400">Sin evaluaciones completas registradas.</p>
        ) : (
          <ul className="space-y-3">
            {evaluaciones.slice(0, 10).map((registro) => (
              <li key={registro.id} className="border-b border-white/5 pb-3 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-slate-300">
                    {new Date(registro.creadoEn).toLocaleString('es-EC')}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${colorNivel[registro.resultado.nivel]}`}>
                    {registro.resultado.puntaje}/100 · {etiquetaNivel[registro.resultado.nivel]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{registro.resultado.aptitud}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
