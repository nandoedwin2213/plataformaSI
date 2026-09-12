import { Historial } from '../components/Historial'
import { useApp } from '../store/contexto'

export function HistorialPagina() {
  const { usuarioActual, registros, eliminarRegistro, usuarios } = useApp()
  if (!usuarioActual) return null

  const esMando = usuarioActual.rol === 'admin'
  const visibles = esMando
    ? registros
    : registros.filter((registro) => registro.usuarioId === usuarioActual.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Historial de evaluaciones</h1>
        <p className="mt-1 text-sm text-slate-400">
          {esMando
            ? `Registros de todo el personal (${usuarios.length} usuarios registrados).`
            : 'Tus evaluaciones completas guardadas.'}
        </p>
      </div>
      <Historial registros={visibles} onEliminar={eliminarRegistro} />
    </div>
  )
}
