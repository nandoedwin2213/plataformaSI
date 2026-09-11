import type { RegistroHistorial } from '../domain/types'
import type { AjustesInstitucionales, CheckIn, Rol, Usuario } from '../domain/usuarios'

const BASE = import.meta.env.VITE_API_URL ?? ''
const CLAVE_TOKEN = 'fae-fatiga-token'

export class ErrorApi extends Error {
  readonly estado: number

  constructor(mensaje: string, estado: number) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
  }
}

export function leerToken(): string | null {
  return localStorage.getItem(CLAVE_TOKEN)
}

export function guardarToken(token: string | null): void {
  if (token) localStorage.setItem(CLAVE_TOKEN, token)
  else localStorage.removeItem(CLAVE_TOKEN)
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const token = leerToken()
  const respuesta = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.headers ?? {}),
    },
  })

  if (respuesta.status === 204) return undefined as T
  const cuerpo = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    throw new ErrorApi(cuerpo?.error ?? 'No se pudo completar la operación', respuesta.status)
  }
  return cuerpo as T
}

export interface DatosNuevoUsuario {
  usuario: string
  clave: string
  nombre: string
  grado: string
  unidad: string
  rol: Rol
  perfil: Usuario['perfil']
}

export type DatosCheckIn = Omit<CheckIn, 'id' | 'usuarioId' | 'creadoEn'>

export interface RegistroAuditoria {
  id: string
  usuarioId: string | null
  accion: string
  detalle: string
  creadoEn: string
}

export const api = {
  salud: () => pedir<{ estado: string }>('/api/salud'),
  entrar: (usuario: string, clave: string) =>
    pedir<{ token: string; usuario: Usuario }>('/api/sesion', {
      method: 'POST',
      body: JSON.stringify({ usuario, clave }),
    }),
  sesion: () => pedir<Usuario>('/api/sesion'),
  usuarios: () => pedir<Usuario[]>('/api/usuarios'),
  crearUsuario: (datos: DatosNuevoUsuario) =>
    pedir<Usuario>('/api/usuarios', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarUsuario: (id: string, datos: Partial<Usuario> & { clave?: string }) =>
    pedir<Usuario>(`/api/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminarUsuario: (id: string) => pedir<void>(`/api/usuarios/${id}`, { method: 'DELETE' }),
  checkins: () => pedir<CheckIn[]>('/api/checkins'),
  guardarCheckin: (datos: DatosCheckIn) =>
    pedir<CheckIn>('/api/checkins', { method: 'POST', body: JSON.stringify(datos) }),
  registros: () => pedir<RegistroHistorial[]>('/api/registros'),
  guardarRegistro: (datos: Pick<RegistroHistorial, 'evaluacion' | 'resultado'>) =>
    pedir<RegistroHistorial>('/api/registros', { method: 'POST', body: JSON.stringify(datos) }),
  eliminarRegistro: (id: string) => pedir<void>(`/api/registros/${id}`, { method: 'DELETE' }),
  ajustes: () => pedir<AjustesInstitucionales>('/api/ajustes'),
  actualizarAjustes: (datos: AjustesInstitucionales) =>
    pedir<AjustesInstitucionales>('/api/ajustes', { method: 'PUT', body: JSON.stringify(datos) }),
  auditoria: () => pedir<RegistroAuditoria[]>('/api/auditoria'),
  reiniciar: () => pedir<{ estado: string }>('/api/reiniciar', { method: 'POST' }),
}
