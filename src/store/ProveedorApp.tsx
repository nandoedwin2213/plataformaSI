import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { RegistroHistorial } from '../domain/types'
import type { AjustesInstitucionales, CheckIn, Usuario } from '../domain/usuarios'
import { ajustesPorDefecto } from '../domain/usuarios'
import { ErrorApi, api, guardarToken, leerToken, type DatosCheckIn, type DatosNuevoUsuario } from '../lib/api'
import { ContextoApp, type EstadoApp } from './contexto'

function mensajeError(error: unknown): string {
  if (error instanceof ErrorApi) return error.message
  return 'No se pudo contactar con el servidor de la plataforma.'
}

export function ProveedorApp({ children }: { children: ReactNode }) {
  const [listo, setListo] = useState(false)
  const [sinConexion, setSinConexion] = useState(false)
  const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [registros, setRegistros] = useState<RegistroHistorial[]>([])
  const [checkins, setCheckins] = useState<CheckIn[]>([])
  const [ajustes, setAjustes] = useState<AjustesInstitucionales>(ajustesPorDefecto)

  const cargarDatos = useCallback(async () => {
    const [listaUsuarios, listaRegistros, listaCheckins, configuracion] = await Promise.all([
      api.usuarios(),
      api.registros(),
      api.checkins(),
      api.ajustes(),
    ])
    setUsuarios(listaUsuarios)
    setRegistros(listaRegistros)
    setCheckins(listaCheckins)
    setAjustes(configuracion)
  }, [])

  useEffect(() => {
    const iniciar = async () => {
      try {
        await api.salud()
        setSinConexion(false)
      } catch {
        setSinConexion(true)
        setListo(true)
        return
      }
      if (leerToken()) {
        try {
          setUsuarioActual(await api.sesion())
          await cargarDatos()
        } catch {
          guardarToken(null)
          setUsuarioActual(null)
        }
      }
      setListo(true)
    }
    void iniciar()
  }, [cargarDatos])

  const iniciarSesion = useCallback(
    async (nombreUsuario: string, clave: string) => {
      try {
        const { token, usuario } = await api.entrar(nombreUsuario, clave)
        guardarToken(token)
        setUsuarioActual(usuario)
        setSinConexion(false)
        await cargarDatos()
        return null
      } catch (error) {
        return mensajeError(error)
      }
    },
    [cargarDatos],
  )

  const cerrarSesion = useCallback(() => {
    guardarToken(null)
    setUsuarioActual(null)
    setUsuarios([])
    setRegistros([])
    setCheckins([])
  }, [])

  const guardarRegistro = useCallback(
    async (datos: Pick<RegistroHistorial, 'evaluacion' | 'resultado'>) => {
      const creado = await api.guardarRegistro(datos)
      setRegistros((previos) => [creado, ...previos])
    },
    [],
  )

  const eliminarRegistro = useCallback(async (id: string) => {
    await api.eliminarRegistro(id)
    setRegistros((previos) => previos.filter((registro) => registro.id !== id))
  }, [])

  const guardarCheckin = useCallback(async (datos: DatosCheckIn) => {
    const creado = await api.guardarCheckin(datos)
    setCheckins((previos) => [
      creado,
      ...previos.filter((item) => !(item.usuarioId === creado.usuarioId && item.fecha === creado.fecha)),
    ])
  }, [])

  const crearUsuario = useCallback(async (datos: DatosNuevoUsuario) => {
    try {
      const creado = await api.crearUsuario(datos)
      setUsuarios((previos) => [...previos, creado])
      return null
    } catch (error) {
      return mensajeError(error)
    }
  }, [])

  const actualizarUsuario = useCallback(
    async (id: string, datos: Partial<Usuario> & { clave?: string }) => {
      const actualizado = await api.actualizarUsuario(id, datos)
      setUsuarios((previos) => previos.map((item) => (item.id === id ? actualizado : item)))
      setUsuarioActual((previo) => (previo && previo.id === id ? actualizado : previo))
    },
    [],
  )

  const eliminarUsuario = useCallback(async (id: string) => {
    await api.eliminarUsuario(id)
    setUsuarios((previos) => previos.filter((item) => item.id !== id))
  }, [])

  const actualizarAjustes = useCallback(async (nuevos: AjustesInstitucionales) => {
    try {
      setAjustes(await api.actualizarAjustes(nuevos))
      return null
    } catch (error) {
      return mensajeError(error)
    }
  }, [])

  const reiniciarDatos = useCallback(async () => {
    await api.reiniciar()
    guardarToken(null)
    setUsuarioActual(null)
    setUsuarios([])
    setRegistros([])
    setCheckins([])
    setAjustes(ajustesPorDefecto)
  }, [])

  const valor = useMemo<EstadoApp>(
    () => ({
      usuarioActual,
      usuarios,
      registros,
      checkins,
      ajustes,
      sinConexion,
      iniciarSesion,
      cerrarSesion,
      guardarRegistro,
      eliminarRegistro,
      guardarCheckin,
      crearUsuario,
      actualizarUsuario,
      eliminarUsuario,
      actualizarAjustes,
      reiniciarDatos,
    }),
    [
      usuarioActual,
      usuarios,
      registros,
      checkins,
      ajustes,
      sinConexion,
      iniciarSesion,
      cerrarSesion,
      guardarRegistro,
      eliminarRegistro,
      guardarCheckin,
      crearUsuario,
      actualizarUsuario,
      eliminarUsuario,
      actualizarAjustes,
      reiniciarDatos,
    ],
  )

  if (!listo) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Conectando con el servidor de la plataforma…
      </div>
    )
  }

  return <ContextoApp.Provider value={valor}>{children}</ContextoApp.Provider>
}
