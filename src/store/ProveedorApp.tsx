import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { RegistroHistorial } from '../domain/types'
import type { AjustesInstitucionales, CheckIn, Usuario } from '../domain/usuarios'
import { ajustesPorDefecto } from '../domain/usuarios'
import {
  ErrorApi,
  api,
  guardarToken,
  leerToken,
  type DatosCheckIn,
  type DatosNuevoUsuario,
  type ModoAcceso,
} from '../lib/api'
import type { InstrumentoDisponible, ValorRespuesta } from '../domain/instrumentos'
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
  const [instrumentos, setInstrumentos] = useState<InstrumentoDisponible[]>([])

  // El administrador nunca carga instrumentos para responder ni la población completa: sus
  // pantallas consultan agregados y páginas del panel, de modo que el tamaño del personal no
  // afecta al arranque de la sesión.
  const cargarDatos = useCallback(async (usuario: Usuario) => {
    const configuracion = await api.ajustes()
    setAjustes({ ...ajustesPorDefecto, ...configuracion })
    if (usuario.rol !== 'evaluado') {
      setUsuarios([])
      setRegistros([])
      setCheckins([])
      setInstrumentos([])
      return
    }
    const [listaUsuarios, listaRegistros, listaCheckins, listaInstrumentos] = await Promise.all([
      api.usuarios(),
      api.registros(),
      api.checkins(),
      api.instrumentos().catch(() => []),
    ])
    setUsuarios(listaUsuarios)
    setRegistros(listaRegistros)
    setCheckins(listaCheckins)
    setInstrumentos(listaInstrumentos)
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
          const usuario = await api.sesion()
          setUsuarioActual(usuario)
          await cargarDatos(usuario)
        } catch {
          guardarToken(null)
          setUsuarioActual(null)
        }
      }
      setListo(true)
    }
    void iniciar()
  }, [cargarDatos])

  const solicitarCodigo = useCallback(async (correo: string, modo: ModoAcceso) => {
    try {
      return { datos: await api.solicitarCodigo(correo, modo), error: null }
    } catch (error) {
      return { datos: null, error: mensajeError(error) }
    }
  }, [])

  const ingresarConCodigo = useCallback(
    async (correo: string, codigo: string) => {
      try {
        const { token, usuario } = await api.verificarCodigo(correo, codigo)
        guardarToken(token)
        setUsuarioActual(usuario)
        setSinConexion(false)
        await cargarDatos(usuario)
        return null
      } catch (error) {
        return mensajeError(error)
      }
    },
    [cargarDatos],
  )

  const cerrarSesion = useCallback(() => {
    void api.salir().catch(() => undefined)
    guardarToken(null)
    setUsuarioActual(null)
    setUsuarios([])
    setRegistros([])
    setCheckins([])
    setInstrumentos([])
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
    async (id: string, datos: Partial<Usuario>) => {
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

  const guardarRespuestaInstrumento = useCallback(
    async (instrumentoId: string, respuestas: Record<string, ValorRespuesta>, finalizar: boolean) => {
      const guardada = await api.guardarRespuestaInstrumento(instrumentoId, respuestas, finalizar)
      // Tras finalizar cambian la disponibilidad, el conteo de aplicaciones y la próxima fecha.
      setInstrumentos(await api.instrumentos().catch(() => []))
      return guardada
    },
    [],
  )

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
    setInstrumentos([])
    setAjustes(ajustesPorDefecto)
  }, [])

  const valor = useMemo<EstadoApp>(
    () => ({
      usuarioActual,
      usuarios,
      registros,
      checkins,
      ajustes,
      instrumentos,
      sinConexion,
      solicitarCodigo,
      ingresarConCodigo,
      cerrarSesion,
      guardarRegistro,
      eliminarRegistro,
      guardarCheckin,
      crearUsuario,
      actualizarUsuario,
      eliminarUsuario,
      guardarRespuestaInstrumento,
      actualizarAjustes,
      reiniciarDatos,
    }),
    [
      usuarioActual,
      usuarios,
      registros,
      checkins,
      ajustes,
      instrumentos,
      sinConexion,
      solicitarCodigo,
      ingresarConCodigo,
      cerrarSesion,
      guardarRegistro,
      eliminarRegistro,
      guardarCheckin,
      crearUsuario,
      actualizarUsuario,
      eliminarUsuario,
      guardarRespuestaInstrumento,
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
