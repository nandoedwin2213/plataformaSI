import { Link } from 'react-router-dom'
import { useApp } from '../store/contexto'

export function Pruebas() {
  const { instrumentos } = useApp()
  const sistema = instrumentos.filter((item) => item.tipo === 'sistema')
  const adicionales = instrumentos.filter((item) => item.tipo === 'personalizado')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Mis evaluaciones</h1>
        <p className="mt-1 text-sm text-slate-400">
          Instrumentos habilitados por la unidad. Puedes guardar tus respuestas y continuar más tarde.
        </p>
      </div>

      <section className="card space-y-3">
        <h2 className="section-title">Instrumentos clínicos del sistema</h2>
        {sistema.length === 0 ? (
          <p className="text-sm text-slate-400">No hay instrumentos clínicos habilitados.</p>
        ) : (
          sistema.map((instrumento) => (
            <div key={instrumento.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-200">{instrumento.nombre}</p>
                <p className="text-xs text-slate-500">{instrumento.descripcion}</p>
              </div>
              <Link to={instrumento.clave === 'checkin' ? '/checkin' : '/evaluacion'} className="btn-ghost">
                Abrir
              </Link>
            </div>
          ))
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="section-title">Evaluaciones de la unidad</h2>
        {adicionales.length === 0 ? (
          <p className="text-sm text-slate-400">
            La administración aún no ha publicado evaluaciones adicionales.
          </p>
        ) : (
          adicionales.map((instrumento) => {
            const estado = instrumento.miRespuesta?.estado
            return (
              <div key={instrumento.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-200">{instrumento.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {instrumento.preguntas.length} preguntas ·{' '}
                    {estado === 'finalizada'
                      ? `finalizada el ${instrumento.miRespuesta?.finalizadoEn?.slice(0, 10)}`
                      : estado === 'borrador'
                        ? 'en curso'
                        : 'pendiente'}
                  </p>
                </div>
                <Link to={`/pruebas/${instrumento.id}`} className="btn-ghost">
                  {estado === 'finalizada' ? 'Ver respuestas' : estado === 'borrador' ? 'Continuar' : 'Iniciar'}
                </Link>
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}
