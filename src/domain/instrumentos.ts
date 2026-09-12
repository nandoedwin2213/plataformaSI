import type { NivelRiesgo } from './riesgo'

export type TipoPregunta = 'unica' | 'multiple' | 'escala' | 'numero' | 'texto'

export const tiposPregunta: { valor: TipoPregunta; texto: string }[] = [
  { valor: 'unica', texto: 'Opción única' },
  { valor: 'multiple', texto: 'Opción múltiple' },
  { valor: 'escala', texto: 'Escala numérica' },
  { valor: 'numero', texto: 'Número' },
  { valor: 'texto', texto: 'Texto libre' },
]

export interface OpcionPregunta {
  texto: string
  valor: number
}

export interface Pregunta {
  id: string
  instrumentoId: string
  texto: string
  ayuda: string
  tipo: TipoPregunta
  opciones: OpcionPregunta[]
  obligatoria: boolean
  activa: boolean
  orden: number
  clave?: string | null
  minimo?: number | null
  maximo?: number | null
  paso?: number | null
}

export type ValorRespuesta = string | number | string[]

export interface RespuestaInstrumento {
  id: string
  instrumentoId: string
  usuarioId: string
  estado: 'borrador' | 'finalizada'
  respuestas: Record<string, ValorRespuesta>
  puntaje: number | null
  puntajeNormalizado: number | null
  interpretacion: string
  instrumentoVersion: number
  creadoEn: string
  actualizadoEn: string
  finalizadoEn: string | null
}

export interface RespuestaGuardada extends RespuestaInstrumento {
  riesgo: {
    puntaje: number
    nivel: NivelRiesgo
    confianza: 'alta' | 'media' | 'baja'
    versionModelo: number
    explicacion: string[]
  } | null
}

export interface Instrumento {
  id: string
  clave: string
  nombre: string
  descripcion: string
  tipo: 'sistema' | 'personalizado' | 'estandarizado'
  activo: boolean
  orden: number
  creadoEn: string
  dominio: string
  frecuenciaDias: number
  version: number
  preguntas: Pregunta[]
}

// Cada instrumento se administra por separado: conserva su propio borrador, su última
// aplicación finalizada, su historial y su frecuencia de aplicación.
export interface InstrumentoDisponible extends Instrumento {
  miBorrador: RespuestaInstrumento | null
  ultimaAplicacion: RespuestaInstrumento | null
  totalAplicaciones: number
  disponible: boolean
  proximaEn: string | null
}

export interface AplicacionAdmin extends RespuestaInstrumento {
  persona: string
  instrumentoNombre: string
}

export interface PaginaAplicaciones {
  total: number
  pagina: number
  tam: number
  aplicaciones: AplicacionAdmin[]
}

export interface ResumenAdmin {
  fecha: string
  personal: number
  personalActivo: number
  evaluacionesCompletas: number
  checkins: number
  checkinsHoy: number
  pendientesCheckinHoy: number
  instrumentos: number
  instrumentosActivos: number
  preguntasActivas: number
  pruebasFinalizadas: number
  pruebasEnCurso: number
  fichasIncompletas: number
  nivelesHoy: Record<string, number>
}

export interface DatosPregunta {
  texto: string
  ayuda: string
  tipo: TipoPregunta
  opciones: OpcionPregunta[]
  obligatoria: boolean
  activa: boolean
}
