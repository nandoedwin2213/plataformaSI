// Tipos del motor integrado de riesgo por fatiga. El índice integrado es una ayuda a la
// decisión: la parametrización es configurable y requiere validación profesional.

export type NivelRiesgo = 'bajo' | 'moderado' | 'alto' | 'critico'

export interface ComponenteRiesgo {
  dominio: string
  nombre: string
  clave: string | null
  normalizado: number
  peso: number
  pesoEfectivo: number
  aporte: number
  vigente: boolean
  fecha: string | null
  z: number | null
}

export interface ModificadorRiesgo {
  clave: string
  texto: string
  puntos: number
}

export interface BanderaRiesgo {
  clave: string
  texto: string
  nivel: NivelRiesgo
}

export interface TendenciaRiesgo {
  direccion: 'deterioro' | 'recuperacion' | 'estable' | 'sin_datos'
  pendiente: number
  media7: number | null
  media30: number | null
}

export interface SenalesRiesgo {
  persistente: boolean
  episodiosElevados: number
  mediciones: number
  ultimaMedicion: string | null
}

export interface ResultadoRiesgo {
  puntaje: number
  puntajeBase: number
  nivel: NivelRiesgo
  confianza: 'alta' | 'media' | 'baja'
  cobertura: number
  versionModelo: number
  calculadoEn: string
  componentes: ComponenteRiesgo[]
  modificadores: ModificadorRiesgo[]
  banderas: BanderaRiesgo[]
  factores: string[]
  tendencia: TendenciaRiesgo
  senales: SenalesRiesgo
}

export interface PuntoHistorial {
  fecha: string
  puntaje: number
  nivel: NivelRiesgo
}

export interface LineaBase {
  media: number
  desviacion: number
  n: number
  provisional: boolean
}

export interface EstrategiaMitigacion {
  id: string
  titulo: string
  descripcion: string
  nivelObjetivo: NivelRiesgo
  dominio: string
  acciones: string
  reevaluarDias: number | null
  escalamiento: string
  requiereValidacion: boolean
  activa: boolean
  orden?: number
}

export interface MiRiesgo {
  resultado: ResultadoRiesgo | null
  explicacion: string[]
  historial: PuntoHistorial[]
  estrategias: EstrategiaMitigacion[]
  lineasBase?: Record<string, LineaBase>
}

export interface Alerta {
  id: string
  usuarioId: string
  reglaClave: string
  severidad: 'baja' | 'media' | 'alta'
  motivo: string
  estado: 'abierta' | 'reconocida' | 'resuelta'
  nota: string
  creadoEn: string
  actualizadoEn: string
  persona?: { nombre: string; grado: string; unidad: string }
}

export interface ReglaAlerta {
  id: string
  clave: string
  nombre: string
  descripcion: string
  tipo: string
  parametros: Record<string, number | string | boolean>
  severidad: 'baja' | 'media' | 'alta'
  activa: boolean
}

export interface DefinicionModelo {
  nombre: string
  descripcion?: string
  pesos: Record<string, number>
  umbrales: { moderado: number; alto: number; critico: number }
  vigenciaDias?: Record<string, number>
  modificadores?: Record<string, unknown>
  banderas?: unknown
  [clave: string]: unknown
}

export interface ModeloRiesgo {
  id: string
  version: number
  nombre: string
  activo: boolean
  nota: string
  creadoEn: string
  definicion: DefinicionModelo
}

export interface ResumenPoblacional {
  fecha: string
  personal: number
  personalActivo: number
  aplicaciones: number
  aplicaciones7d: number
  enCurso: number
  evaluados7d: number
  sinEvaluar7d: number
  adherencia7d: number
  registrosHoy: number
  fichasIncompletas: number
  distribucion: Record<NivelRiesgo, number>
  alertasAbiertas: Partial<Record<'baja' | 'media' | 'alta', number>>
  instrumentos: {
    clave: string
    nombre: string
    frecuenciaDias: number
    aplicaciones: number
    aplicaciones7d: number
    promedio30d: number | null
    evaluados7d: number
  }[]
  tendencia: { dia: string; promedio: number; mediciones: number; elevados: number }[]
  senales: { persistentes: number; deterioro: number; recuperacion: number; confianzaBaja: number }
}

export interface PersonaPanel {
  id: string
  nombre: string
  grado: string
  unidad: string
  correo: string
  activo: boolean
  puntaje: number | null
  nivel: NivelRiesgo | null
  confianza: 'alta' | 'media' | 'baja' | null
  calculadoEn: string | null
  direccion: TendenciaRiesgo['direccion'] | null
  persistente: boolean
  alertas: number
}

export interface PaginaPersonas {
  pagina: number
  tam: number
  total: number
  paginas: number
  personas: PersonaPanel[]
}

export interface AplicacionPersona {
  clave: string
  nombre: string
  dominio: string
  puntaje: number
  normalizado: number | null
  interpretacion: string
  fecha: string
  instrumentoVersion: number
}

export interface DetallePersona {
  persona: Pick<PersonaPanel, 'id' | 'nombre' | 'grado' | 'unidad' | 'correo' | 'activo'>
  resultado: ResultadoRiesgo | null
  explicacion: string[]
  estrategias: EstrategiaMitigacion[]
  historial: PuntoHistorial[]
  lineasBase: Record<string, LineaBase>
  aplicaciones: AplicacionPersona[]
  alertas: Alerta[]
}

export const etiquetaNivelRiesgo: Record<NivelRiesgo, string> = {
  bajo: 'Bajo',
  moderado: 'Moderado',
  alto: 'Alto',
  critico: 'Crítico',
}

export const colorNivelRiesgo: Record<NivelRiesgo, string> = {
  bajo: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  moderado: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  alto: 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30',
  critico: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30',
}

export const etiquetaDominio: Record<string, string> = {
  somnolencia_aguda: 'Somnolencia aguda',
  fatiga_aguda: 'Fatiga aguda',
  sueno_recuperacion: 'Sueño y recuperación',
  carga_trabajo: 'Carga de trabajo',
  somnolencia_habitual: 'Somnolencia habitual',
}
