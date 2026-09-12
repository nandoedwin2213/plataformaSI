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
}

export type ValorRespuesta = string | number | string[]

export interface RespuestaInstrumento {
  id: string
  instrumentoId: string
  usuarioId: string
  estado: 'borrador' | 'finalizada'
  respuestas: Record<string, ValorRespuesta>
  puntaje: number | null
  creadoEn: string
  actualizadoEn: string
  finalizadoEn: string | null
}

export interface Instrumento {
  id: string
  clave: string
  nombre: string
  descripcion: string
  tipo: 'sistema' | 'personalizado'
  activo: boolean
  orden: number
  creadoEn: string
  preguntas: Pregunta[]
}

export interface InstrumentoDisponible extends Instrumento {
  miRespuesta: RespuestaInstrumento | null
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
