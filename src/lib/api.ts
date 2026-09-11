import type { RegistroHistorial } from '../domain/types'
import type { AjustesInstitucionales, CheckIn, Usuario } from '../domain/usuarios'
import type {
  DatosPregunta,
  Instrumento,
  InstrumentoDisponible,
  Pregunta,
  RespuestaInstrumento,
  ResumenAdmin,
  ValorRespuesta,
} from '../domain/instrumentos'

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
  correo: string
  nombre: string
  grado: string
  unidad: string
  perfil: Usuario['perfil']
}

export type ModoAcceso = 'evaluado' | 'admin'

export interface RespuestaCodigo {
  enviado: boolean
  minutos: number
  codigo?: string
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
  solicitarCodigo: (correo: string, modo: ModoAcceso) =>
    pedir<RespuestaCodigo>('/api/acceso/codigo', {
      method: 'POST',
      body: JSON.stringify({ correo, modo }),
    }),
  verificarCodigo: (correo: string, codigo: string) =>
    pedir<{ token: string; usuario: Usuario }>('/api/acceso/verificar', {
      method: 'POST',
      body: JSON.stringify({ correo, codigo }),
    }),
  sesion: () => pedir<Usuario>('/api/sesion'),
  salir: () => pedir<void>('/api/salir', { method: 'POST' }),
  usuarios: () => pedir<Usuario[]>('/api/usuarios'),
  crearUsuario: (datos: DatosNuevoUsuario) =>
    pedir<Usuario>('/api/usuarios', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarUsuario: (id: string, datos: Partial<Usuario>) =>
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

  // Instrumentos configurables: lectura y respuesta del evaluado
  instrumentos: () => pedir<InstrumentoDisponible[]>('/api/instrumentos'),
  guardarRespuestaInstrumento: (
    instrumentoId: string,
    respuestas: Record<string, ValorRespuesta>,
    finalizar: boolean,
  ) =>
    pedir<RespuestaInstrumento>(`/api/instrumentos/${instrumentoId}/respuesta`, {
      method: 'PUT',
      body: JSON.stringify({ respuestas, finalizar }),
    }),

  // Administración
  resumenAdmin: () => pedir<ResumenAdmin>('/api/admin/resumen'),
  instrumentosAdmin: () => pedir<Instrumento[]>('/api/admin/instrumentos'),
  crearInstrumento: (datos: { nombre: string; descripcion: string }) =>
    pedir<Instrumento>('/api/admin/instrumentos', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarInstrumento: (
    id: string,
    datos: Partial<Pick<Instrumento, 'nombre' | 'descripcion' | 'activo' | 'orden'>>,
  ) => pedir<Instrumento>(`/api/admin/instrumentos/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminarInstrumento: (id: string) => pedir<void>(`/api/admin/instrumentos/${id}`, { method: 'DELETE' }),
  crearPregunta: (instrumentoId: string, datos: DatosPregunta) =>
    pedir<Pregunta>(`/api/admin/instrumentos/${instrumentoId}/preguntas`, {
      method: 'POST',
      body: JSON.stringify(datos),
    }),
  actualizarPregunta: (id: string, datos: Partial<DatosPregunta> & { orden?: number }) =>
    pedir<Pregunta>(`/api/admin/preguntas/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminarPregunta: (id: string) => pedir<void>(`/api/admin/preguntas/${id}`, { method: 'DELETE' }),
  respuestasAdmin: () => pedir<RespuestaInstrumento[]>('/api/admin/respuestas'),
}
