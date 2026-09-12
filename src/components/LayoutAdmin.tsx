import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../store/contexto'
import { Ambiente, BotonTema } from './Tema'
import { useTema } from '../lib/tema'

const enlaces = [
  { ruta: '/admin', texto: 'Dashboard', exacto: true },
  { ruta: '/admin/poblacion', texto: 'Personal evaluado' },
  { ruta: '/admin/evaluaciones', texto: 'Evaluaciones y resultados' },
  { ruta: '/admin/alertas', texto: 'Alertas' },
  { ruta: '/admin/tests', texto: 'Instrumentos y preguntas' },
  { ruta: '/admin/modelo', texto: 'Modelo de riesgo' },
  { ruta: '/admin/parametros', texto: 'Variables y parámetros' },
  { ruta: '/admin/auditoria', texto: 'Auditoría' },
  { ruta: '/admin/cuenta', texto: 'Mi cuenta' },
]

export function LayoutAdmin() {
  const { usuarioActual, cerrarSesion, ajustes } = useApp()
  const navegar = useNavigate()
  const { tema, alternar } = useTema()

  if (!usuarioActual) return null

  return (
    <div className="min-h-screen lg:flex">
      <Ambiente />
      <aside className="border-b border-white/10 bg-slate-950/80 backdrop-blur lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r no-print">
        <div className="px-5 py-5">
          <p className="text-sm font-bold uppercase leading-tight tracking-[0.18em] text-amber-400">
            {ajustes.institucion}
          </p>
          <p className="mt-1 text-base font-extrabold uppercase leading-tight tracking-[0.08em] text-white">
            {ajustes.subtitulo}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-400">Panel de administración</p>
          <p className="text-xs text-slate-500">PlataformaSI · FRMS</p>
        </div>
        <nav className="flex flex-wrap gap-1 px-3 pb-4 lg:flex-col">
          {enlaces.map((enlace) => (
            <NavLink
              key={enlace.ruta}
              to={enlace.ruta}
              end={enlace.exacto}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              {enlace.texto}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 no-print">
          <div>
            <p className="text-sm font-semibold text-white">{usuarioActual.nombre}</p>
            <p className="text-xs text-slate-400">
              {usuarioActual.correo} · Administrador único del sistema
            </p>
          </div>
          <div className="flex items-center gap-3">
            <BotonTema tema={tema} onAlternar={alternar} />
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
        </header>

        <main className="px-5 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
