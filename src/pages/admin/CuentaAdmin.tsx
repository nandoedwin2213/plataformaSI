import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/contexto'

export function CuentaAdmin() {
  const { usuarioActual, cerrarSesion, ajustes } = useApp()
  const navegar = useNavigate()

  if (!usuarioActual) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Mi cuenta</h1>
        <p className="mt-1 text-sm text-slate-400">Cuenta administrativa única de la plataforma.</p>
      </div>

      <section className="card space-y-2 text-sm">
        <p className="text-slate-300">
          <span className="text-slate-500">Nombre: </span>
          {usuarioActual.nombre}
        </p>
        <p className="text-slate-300">
          <span className="text-slate-500">Correo autorizado: </span>
          {usuarioActual.correo}
        </p>
        <p className="text-slate-300">
          <span className="text-slate-500">Institución: </span>
          {ajustes.institucion}
        </p>
        <p className="text-xs text-slate-500">
          El acceso se realiza con un código de un solo uso enviado a este correo. El administrador no
          participa en los instrumentos de evaluación: no tiene ficha de evaluado, check-in ni respuestas.
        </p>
      </section>

      <button
        className="btn-ghost"
        onClick={() => {
          cerrarSesion()
          navegar('/login')
        }}
      >
        Cerrar sesión
      </button>
    </div>
  )
}
