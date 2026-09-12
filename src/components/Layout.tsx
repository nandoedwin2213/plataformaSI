import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../store/contexto'

const enlaces = [
  { ruta: '/inicio', texto: 'Inicio' },
  { ruta: '/perfil', texto: 'Mi ficha personal' },
  { ruta: '/checkin', texto: 'Check-in diario' },
  { ruta: '/evaluacion', texto: 'Evaluación completa' },
  { ruta: '/pruebas', texto: 'Mis evaluaciones' },
  { ruta: '/mi-riesgo', texto: 'Mi índice integrado' },
  { ruta: '/ficha', texto: 'Mi ficha longitudinal' },
  { ruta: '/historial', texto: 'Mi historial' },
  { ruta: '/guia', texto: 'Guía clínica' },
]

export function Layout() {
  const { usuarioActual, cerrarSesion, ajustes } = useApp()
  const navegar = useNavigate()

  if (!usuarioActual) return null

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-white/10 bg-slate-950/80 backdrop-blur lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r no-print">
        <div className="px-5 py-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-400">{ajustes.institucion}</p>
          <p className="mt-1 text-sm font-bold text-white">FRMS · Gestión de fatiga</p>
        </div>
        <nav className="flex flex-wrap gap-1 px-3 pb-4 lg:flex-col">
          {enlaces.map((enlace) => (
            <NavLink
              key={enlace.ruta}
              to={enlace.ruta}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40'
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
            <p className="text-sm font-semibold text-white">
              {usuarioActual.grado} {usuarioActual.nombre}
            </p>
            <p className="text-xs text-slate-400">{usuarioActual.correo} · Personal evaluado</p>
          </div>
          <button
            className="btn-ghost"
            onClick={() => {
              cerrarSesion()
              navegar('/login')
            }}
          >
            Cerrar sesión
          </button>
        </header>

        <main className="px-5 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
