import { useEffect, useState } from 'react'
import { api, type RegistroAuditoria } from '../../lib/api'

export function Auditoria() {
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void api
      .auditoria()
      .then(setAuditoria)
      .catch((fallo: unknown) =>
        setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar la auditoría'),
      )
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Auditoría de accesos y acciones</h1>
        <p className="mt-1 text-sm text-slate-400">Últimos eventos registrados por el servidor.</p>
      </div>

      {error && <p className="card text-sm text-red-400">{error}</p>}

      <section className="card">
        {auditoria.length === 0 ? (
          <p className="text-sm text-slate-400">Sin eventos registrados.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {auditoria.map((evento) => (
              <li key={evento.id} className="flex justify-between gap-4 border-b border-white/5 pb-1">
                <span className="text-slate-300">
                  {evento.accion}
                  {evento.detalle && <span className="text-slate-500"> · {evento.detalle}</span>}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {new Date(evento.creadoEn).toLocaleString('es-EC')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
