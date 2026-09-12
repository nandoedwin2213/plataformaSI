import { Link } from 'react-router-dom'
import { useApp } from '../store/contexto'
import type { InstrumentoDisponible } from '../domain/instrumentos'
import { etiquetaDominio } from '../domain/riesgo'
import { textoDisponibilidad, textoFrecuencia } from '../domain/periodicidad'

function frecuenciaTexto(dias: number): string {
  if (dias <= 1) return 'Aplicación diaria'
  if (dias === 7) return 'Aplicación semanal'
  if (dias === 30) return 'Aplicación mensual'
  if (dias === 90) return 'Aplicación trimestral'
  return `Cada ${dias} días`
}

function Tarjeta({ instrumento }: { instrumento: InstrumentoDisponible }) {
  const ultima = instrumento.ultimaAplicacion
  const borrador = instrumento.miBorrador
  const bloqueado = !instrumento.disponible && !borrador

  return (
    <article className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{instrumento.nombre}</p>
          <p className="text-xs text-slate-500">{instrumento.descripcion}</p>
        </div>
        <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
          {etiquetaDominio[instrumento.dominio] ?? 'Instrumento de la unidad'}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-xs text-slate-400 sm:grid-cols-4">
        <div>
          <dt className="text-slate-500">Frecuencia</dt>
          <dd>
            {frecuenciaTexto(instrumento.frecuenciaDias)} (se llena{' '}
            {textoFrecuencia(instrumento.frecuenciaDias)})
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Aplicaciones</dt>
          <dd>{instrumento.totalAplicaciones}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Último resultado</dt>
          <dd>{ultima?.puntaje ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Última fecha</dt>
          <dd>{ultima?.finalizadoEn?.slice(0, 10) ?? 'Sin aplicar'}</dd>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <dt className="text-slate-500">Próxima aplicación</dt>
          <dd>{textoDisponibilidad(ultima?.finalizadoEn, instrumento.frecuenciaDias)}</dd>
        </div>
      </dl>

      {ultima?.interpretacion && <p className="text-xs text-slate-400">{ultima.interpretacion}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/pruebas/${instrumento.id}`} className={bloqueado ? 'btn-ghost' : 'btn-primary'}>
          {borrador ? 'Continuar aplicación' : bloqueado ? 'Ver historial' : 'Responder ahora'}
        </Link>
        {bloqueado && instrumento.proximaEn && (
          <span className="text-xs text-slate-500">
            Próxima aplicación disponible el {instrumento.proximaEn.slice(0, 10)}
          </span>
        )}
        {borrador && <span className="text-xs text-amber-300">Tienes respuestas guardadas sin finalizar</span>}
      </div>
    </article>
  )
}

export function Pruebas() {
  const { instrumentos } = useApp()
  const estandarizados = instrumentos.filter((item) => item.tipo === 'estandarizado')
  const propios = instrumentos.filter((item) => item.tipo === 'personalizado')
  const sistema = instrumentos.filter((item) => item.tipo === 'sistema')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Mis instrumentos</h1>
        <p className="mt-1 text-sm text-slate-400">
          Cada instrumento se aplica y se puntúa por separado, con su propia frecuencia e historial. Los
          resultados apoyan la evaluación del riesgo por fatiga y no constituyen un diagnóstico médico.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="section-title">Escalas estandarizadas</h2>
        {estandarizados.length === 0 ? (
          <p className="card text-sm text-slate-400">No hay escalas habilitadas por la administración.</p>
        ) : (
          estandarizados.map((instrumento) => <Tarjeta key={instrumento.id} instrumento={instrumento} />)
        )}
      </section>

      {sistema.length > 0 && (
        <section className="card space-y-3">
          <h2 className="section-title">Registro operacional</h2>
          {sistema.map((instrumento) => (
            <div key={instrumento.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-200">{instrumento.nombre}</p>
                <p className="text-xs text-slate-500">{instrumento.descripcion}</p>
              </div>
              <Link to="/checkin" className="btn-ghost">
                Abrir
              </Link>
            </div>
          ))}
        </section>
      )}

      {propios.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">Evaluaciones de la unidad</h2>
          {propios.map((instrumento) => (
            <Tarjeta key={instrumento.id} instrumento={instrumento} />
          ))}
        </section>
      )}
    </div>
  )
}
