import { createContext, useContext } from 'react'
import type { RegistroHistorial } from '../domain/types'
import type { AjustesInstitucionales, CheckIn, Usuario } from '../domain/usuarios'
import type { DatosCheckIn, DatosNuevoUsuario } from '../lib/api'

export interface EstadoApp {
  usuarioActual: Usuario | null
  usuarios: Usuario[]
  registros: RegistroHistorial[]
  checkins: CheckIn[]
  ajustes: AjustesInstitucionales
  sinConexion: boolean
  iniciarSesion: (usuario: string, clave: string) => Promise<string | null>
  cerrarSesion: () => void
  guardarRegistro: (datos: Pick<RegistroHistorial, 'evaluacion' | 'resultado'>) => Promise<void>
  eliminarRegistro: (id: string) => Promise<void>
  guardarCheckin: (datos: DatosCheckIn) => Promise<void>
  crearUsuario: (datos: DatosNuevoUsuario) => Promise<string | null>
  actualizarUsuario: (id: string, datos: Partial<Usuario> & { clave?: string }) => Promise<void>
  eliminarUsuario: (id: string) => Promise<void>
  actualizarAjustes: (ajustes: AjustesInstitucionales) => Promise<string | null>
  reiniciarDatos: () => Promise<void>
}

export const ContextoApp = createContext<EstadoApp | null>(null)

export function useApp(): EstadoApp {
  const contexto = useContext(ContextoApp)
  if (!contexto) throw new Error('useApp debe usarse dentro de ProveedorApp')
  return contexto
}
