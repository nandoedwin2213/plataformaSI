import type { RegistroHistorial } from '../domain/types'
import type { AjustesInstitucionales, CheckIn, Usuario } from '../domain/usuarios'
import type {
  DatosPregunta,
  Instrumento,
  InstrumentoDisponible,
  PaginaAplicaciones,
  Pregunta,
  RespuestaGuardada,
  RespuestaInstrumento,
  ResumenAdmin,
  ValorRespuesta,
} from '../domain/instrumentos'
import type {
  Alerta,
  DefinicionModelo,
  DetallePersona,
  EstrategiaMitigacion,
  MiRiesgo,
  ModeloRiesgo,
  PaginaPersonas,
  ReglaAlerta,
  ResumenPoblacional,
} from '../domain/riesgo'

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

export interface FiltroPersonas {
  pagina?: number
  tam?: number
  nivel?: string
  unidad?: string
  grado?: string
  busqueda?: string
  conAlerta?: boolean
  sinDatos?: boolean
  orden?: 'puntaje' | 'nombre'
}

export interface FiltroAplicaciones {
  pagina?: number
  tam?: number
  instrumento?: string
  estado?: 'borrador' | 'finalizada'
}

function consulta(parametros: FiltroPersonas | FiltroAplicaciones): string {
  const partes = Object.entries(parametros)
    .filter(([, valor]) => valor !== undefined && valor !== '' && valor !== false)
    .map(([clave, valor]) => `${clave}=${encodeURIComponent(String(valor))}`)
  return partes.length ? `?${partes.join('&')}` : ''
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
  reiniciarDatosEvaluados: () =>
    pedir<{ evaluados: number; aplicaciones: number; checkins: number }>('/api/admin/datos/reiniciar', {
      method: 'POST',
      body: JSON.stringify({ confirmacion: 'BORRAR DATOS' }),
    }),

  // Instrumentos configurables: lectura y respuesta del evaluado
  instrumentos: () => pedir<InstrumentoDisponible[]>('/api/instrumentos'),
  guardarRespuestaInstrumento: (
    instrumentoId: string,
    respuestas: Record<string, ValorRespuesta>,
    finalizar: boolean,
  ) =>
    pedir<RespuestaGuardada>(`/api/instrumentos/${instrumentoId}/respuesta`, {
      method: 'PUT',
      body: JSON.stringify({ respuestas, finalizar }),
    }),
  historialInstrumento: (instrumentoId: string) =>
    pedir<RespuestaInstrumento[]>(`/api/instrumentos/${instrumentoId}/historial`),
  miRiesgo: () => pedir<MiRiesgo>('/api/mi-riesgo'),

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
  respuestasAdmin: (parametros: FiltroAplicaciones = {}) =>
    pedir<PaginaAplicaciones>(`/api/admin/respuestas${consulta(parametros)}`),

  // Panel poblacional y motor de riesgo
  panelResumen: () => pedir<ResumenPoblacional>('/api/admin/panel/resumen'),
  panelPersonas: (parametros: FiltroPersonas = {}) =>
    pedir<PaginaPersonas>(`/api/admin/panel/personas${consulta(parametros)}`),
  panelFiltros: () => pedir<{ unidades: string[]; grados: string[] }>('/api/admin/panel/filtros'),
  panelPersona: (id: string) => pedir<DetallePersona>(`/api/admin/panel/personas/${id}`),
  alertas: (estado = 'abierta') => pedir<Alerta[]>(`/api/admin/alertas?estado=${estado}`),
  actualizarAlerta: (id: string, datos: { estado: Alerta['estado']; nota?: string }) =>
    pedir<Alerta>(`/api/admin/alertas/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  modelos: () => pedir<ModeloRiesgo[]>('/api/admin/modelo'),
  crearVersionModelo: (datos: { definicion: DefinicionModelo; nombre?: string; nota?: string }) =>
    pedir<{ version: number }>('/api/admin/modelo', { method: 'POST', body: JSON.stringify(datos) }),
  activarModelo: (version: number) =>
    pedir<{ version: number }>(`/api/admin/modelo/${version}/activar`, { method: 'PUT' }),
  recalcularModelo: () =>
    pedir<{ evaluados: number; versionModelo: number; milisegundos: number }>(
      '/api/admin/modelo/recalcular',
      { method: 'POST' },
    ),
  reglasAlerta: () => pedir<ReglaAlerta[]>('/api/admin/reglas-alerta'),
  actualizarReglaAlerta: (id: string, datos: Partial<ReglaAlerta>) =>
    pedir<ReglaAlerta>(`/api/admin/reglas-alerta/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  estrategias: () => pedir<EstrategiaMitigacion[]>('/api/admin/estrategias'),
  crearEstrategia: (datos: Partial<EstrategiaMitigacion>) =>
    pedir<EstrategiaMitigacion>('/api/admin/estrategias', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarEstrategia: (id: string, datos: Partial<EstrategiaMitigacion>) =>
    pedir<EstrategiaMitigacion>(`/api/admin/estrategias/${id}`, {
      method: 'PUT',
      body: JSON.stringify(datos),
    }),
  eliminarEstrategia: (id: string) => pedir<void>(`/api/admin/estrategias/${id}`, { method: 'DELETE' }),
}
