import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/contexto'
import { gradosMilitares } from '../domain/catalogos'
import { perfilVacio } from '../domain/usuarios'

interface Borrador {
  nombre: string
  correo: string
  grado: string
  unidad: string
  funcionPrincipal: string
  cargoAdicional: string
}

export function Personal() {
  const { usuarios, checkins, registros, crearUsuario, actualizarUsuario, eliminarUsuario, ajustes } = useApp()
  const [borrador, setBorrador] = useState<Borrador>({
    nombre: '',
    correo: '',
    grado: 'Teniente',
    unidad: ajustes.unidadPorDefecto,
    funcionPrincipal: '',
    cargoAdicional: '',
  })
  const [error, setError] = useState('')

  const agregar = async () => {
    if (!borrador.nombre.trim() || !borrador.correo.trim()) {
      setError('Nombre y correo son obligatorios.')
      return
    }
    const fallo = await crearUsuario({
      correo: borrador.correo.trim(),
      nombre: borrador.nombre.trim(),
      grado: borrador.grado,
      unidad: borrador.unidad,
      perfil: {
        ...perfilVacio,
        funcionPrincipal: borrador.funcionPrincipal,
        cargoAdicional: borrador.cargoAdicional,
      },
    })
    if (fallo) {
      setError(fallo)
      return
    }
    setBorrador({ ...borrador, nombre: '', correo: '', funcionPrincipal: '', cargoAdicional: '' })
    setError('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Gestión de personal</h1>
        <p className="mt-1 text-sm text-slate-400">
          Altas por correo y estado del personal evaluado registrado en la plataforma. El acceso se realiza
          con código de un solo uso enviado al correo.
        </p>
      </div>

      <section className="card">
        <h2 className="section-title">Registrar personal</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="label" htmlFor="nombre">
              Nombre y apellido
            </label>
            <input
              id="nombre"
              className="input"
              value={borrador.nombre}
              onChange={(evento) => setBorrador({ ...borrador, nombre: evento.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="grado">
              Grado
            </label>
            <select
              id="grado"
              className="input"
              value={borrador.grado}
              onChange={(evento) => setBorrador({ ...borrador, grado: evento.target.value })}
            >
              {gradosMilitares.map((grupo) => (
                <optgroup key={grupo.categoria} label={grupo.categoria}>
                  {grupo.grados.map((grado) => (
                    <option key={grado} value={grado}>
                      {grado}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="unidad">
              Unidad
            </label>
            <input
              id="unidad"
              className="input"
              value={borrador.unidad}
              onChange={(evento) => setBorrador({ ...borrador, unidad: evento.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="correo">
              Correo electrónico
            </label>
            <input
              id="correo"
              type="email"
              className="input"
              value={borrador.correo}
              onChange={(evento) => setBorrador({ ...borrador, correo: evento.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="funcion">
              Función principal
            </label>
            <input
              id="funcion"
              className="input"
              value={borrador.funcionPrincipal}
              onChange={(evento) => setBorrador({ ...borrador, funcionPrincipal: evento.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="cargoAdicional">
              Cargo adicional
            </label>
            <input
              id="cargoAdicional"
              className="input"
              value={borrador.cargoAdicional}
              onChange={(evento) => setBorrador({ ...borrador, cargoAdicional: evento.target.value })}
            />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button className="btn-primary mt-4" onClick={() => void agregar()}>
          Registrar
        </button>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="section-title">Personal registrado ({usuarios.length})</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase text-slate-400">
              <th className="py-2 pr-4">Personal</th>
              <th className="py-2 pr-4">Unidad</th>
              <th className="py-2 pr-4">Perfil</th>
              <th className="py-2 pr-4">Check-ins</th>
              <th className="py-2 pr-4">Evaluaciones</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((persona) => (
              <tr key={persona.id} className="border-b border-white/5 last:border-0">
                <td className="py-2 pr-4 text-slate-200">
                  <Link to={`/admin/personal/${persona.id}`} className="hover:text-cyan-300">
                    {persona.grado} {persona.nombre}
                  </Link>
                  <span className="block text-xs text-slate-500">{persona.correo}</span>
                </td>
                <td className="py-2 pr-4 text-slate-400">{persona.unidad}</td>
                <td className="py-2 pr-4 text-slate-400">
                  {persona.rol === 'admin' ? 'Administrador' : 'Personal evaluado'}
                </td>
                <td className="py-2 pr-4 text-slate-300">
                  {checkins.filter((item) => item.usuarioId === persona.id).length}
                </td>
                <td className="py-2 pr-4 text-slate-300">
                  {registros.filter((item) => item.usuarioId === persona.id).length}
                </td>
                <td className="py-2 pr-4">
                  <button
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      persona.activo
                        ? 'border-emerald-400/40 text-emerald-300'
                        : 'border-slate-500/40 text-slate-400'
                    }`}
                    onClick={() => void actualizarUsuario(persona.id, { activo: !persona.activo })}
                  >
                    {persona.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="py-2 pr-4 text-right">
                  <button
                    className="text-xs text-red-400 hover:underline"
                    onClick={() =>
                      void eliminarUsuario(persona.id).catch(() =>
                        setError('Solo un administrador puede eliminar cuentas.'),
                      )
                    }
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
