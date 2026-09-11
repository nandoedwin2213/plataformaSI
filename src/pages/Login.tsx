import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/contexto'

const cuentasDemo = [
  { usuario: 'piloto', clave: 'piloto123', rol: 'Piloto' },
  { usuario: 'operaciones', clave: 'ops123', rol: 'Jefe de operaciones' },
  { usuario: 'medico', clave: 'med123', rol: 'Médico de aviación' },
  { usuario: 'admin', clave: 'admin123', rol: 'Administrador' },
]

export function Login() {
  const { iniciarSesion, ajustes, sinConexion } = useApp()
  const navegar = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setEnviando(true)
    const fallo = await iniciarSesion(usuario, clave)
    setEnviando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    navegar('/inicio')
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">{ajustes.institucion}</p>
          <h1 className="mt-2 text-2xl font-extrabold text-white">
            Plataforma de gestión de riesgos de fatiga
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Diagnóstico, seguimiento y mitigación de la fatiga del personal militar
          </p>
        </div>

        {sinConexion && (
          <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
            No hay conexión con la API de la plataforma. Levanta el servidor con <code>npm start</code> en la
            carpeta <code>server</code>.
          </p>
        )}

        <form className="card space-y-4" onSubmit={(evento) => void enviar(evento)}>
          <div>
            <label className="label" htmlFor="usuario">
              Usuario
            </label>
            <input
              id="usuario"
              className="input"
              value={usuario}
              autoComplete="username"
              onChange={(evento) => setUsuario(evento.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="clave">
              Contraseña
            </label>
            <input
              id="clave"
              type="password"
              className="input"
              value={clave}
              autoComplete="current-password"
              onChange={(evento) => setClave(evento.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={enviando}>
            {enviando ? 'Verificando…' : 'Ingresar'}
          </button>
        </form>

        <div className="card mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-cyan-400">
            Cuentas de demostración
          </p>
          <ul className="space-y-2 text-sm text-slate-300">
            {cuentasDemo.map((cuenta) => (
              <li key={cuenta.usuario} className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-mono text-cyan-300">{cuenta.usuario}</span> / {cuenta.clave}
                </span>
                <button
                  type="button"
                  className="text-xs font-semibold text-cyan-400 hover:underline"
                  onClick={() => {
                    setUsuario(cuenta.usuario)
                    setClave(cuenta.clave)
                  }}
                >
                  {cuenta.rol}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Los datos se guardan en la base PostgreSQL del servidor, con contraseñas hasheadas y sesión JWT. Para
            producción institucional falta respaldo centralizado y contraseñas propias de cada usuario.
          </p>
        </div>
      </div>
    </div>
  )
}
