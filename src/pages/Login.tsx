import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/contexto'
import type { ModoAcceso } from '../lib/api'

const opciones: { modo: ModoAcceso; titulo: string; descripcion: string }[] = [
  {
    modo: 'evaluado',
    titulo: 'Ingresar como Personal Evaluado',
    descripcion: 'Ficha personal, check-in diario y evaluaciones de fatiga',
  },
  {
    modo: 'admin',
    titulo: 'Ingresar como Administrador',
    descripcion: 'Panel institucional, personal, ajustes y auditoría',
  },
]

export function Login() {
  const { solicitarCodigo, ingresarConCodigo, ajustes, sinConexion } = useApp()
  const navegar = useNavigate()
  const [modo, setModo] = useState<ModoAcceso | null>(null)
  const [etapa, setEtapa] = useState<'correo' | 'codigo'>('correo')
  const [correo, setCorreo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const reiniciar = () => {
    setModo(null)
    setEtapa('correo')
    setCodigo('')
    setAviso('')
    setError('')
  }

  const pedirCodigo = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!modo) return
    setEnviando(true)
    setError('')
    const { datos, error: fallo } = await solicitarCodigo(correo, modo)
    setEnviando(false)
    if (fallo || !datos) {
      setError(fallo ?? 'No se pudo enviar el código')
      return
    }
    setEtapa('codigo')
    setAviso(
      datos.codigo
        ? `Código de prueba: ${datos.codigo} (válido ${datos.minutos} minutos)`
        : `Enviamos un código de ${datos.minutos} minutos a ${correo}.`,
    )
  }

  const verificar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setEnviando(true)
    setError('')
    const fallo = await ingresarConCodigo(correo, codigo)
    setEnviando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    navegar('/')
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
            Acceso seguro con código de un solo uso enviado a tu correo institucional
          </p>
        </div>

        {sinConexion && (
          <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
            No hay conexión con la API de la plataforma.
          </p>
        )}

        {!modo && (
          <div className="space-y-3">
            {opciones.map((opcion) => (
              <button
                key={opcion.modo}
                type="button"
                className="card w-full text-left transition hover:border-cyan-400/60"
                onClick={() => {
                  setModo(opcion.modo)
                  setError('')
                }}
              >
                <p className="text-base font-semibold text-white">{opcion.titulo}</p>
                <p className="mt-1 text-sm text-slate-400">{opcion.descripcion}</p>
              </button>
            ))}
          </div>
        )}

        {modo && (
          <form
            className="card space-y-4"
            onSubmit={(evento) => void (etapa === 'correo' ? pedirCodigo(evento) : verificar(evento))}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-cyan-300">
                {modo === 'admin' ? 'Administrador' : 'Personal evaluado'}
              </p>
              <button type="button" className="text-xs text-slate-400 hover:underline" onClick={reiniciar}>
                Cambiar
              </button>
            </div>

            <div>
              <label className="label" htmlFor="correo">
                Correo electrónico
              </label>
              <input
                id="correo"
                type="email"
                className="input"
                value={correo}
                autoComplete="email"
                disabled={etapa === 'codigo'}
                onChange={(evento) => setCorreo(evento.target.value)}
              />
            </div>

            {etapa === 'codigo' && (
              <div>
                <label className="label" htmlFor="codigo">
                  Código de verificación
                </label>
                <input
                  id="codigo"
                  inputMode="numeric"
                  className="input tracking-[0.5em]"
                  value={codigo}
                  maxLength={6}
                  autoComplete="one-time-code"
                  onChange={(evento) => setCodigo(evento.target.value.replace(/\D/g, ''))}
                />
              </div>
            )}

            {aviso && <p className="text-sm text-slate-300">{aviso}</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={enviando}>
              {enviando
                ? 'Procesando…'
                : etapa === 'correo'
                  ? 'Enviar código de acceso'
                  : 'Verificar e ingresar'}
            </button>

            {etapa === 'codigo' && (
              <button
                type="button"
                className="w-full text-xs text-slate-400 hover:underline"
                onClick={() => {
                  setEtapa('correo')
                  setCodigo('')
                  setAviso('')
                }}
              >
                Usar otro correo o reenviar
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
