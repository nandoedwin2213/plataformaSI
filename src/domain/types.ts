export type TipoMision = 'transporte' | 'caza' | 'helicoptero' | 'entrenamiento' | 'busqueda_rescate'

export type CargoMasDesgastante =
  | 'funcion_principal'
  | 'funcion_secundaria'
  | 'cargo_principal'
  | 'cargo_adicional'
  | 'todos_igual'

export type IntencionDejarCargo = 'no' | 'ocasional' | 'frecuente' | 'decidido'

export interface Evaluacion {
  piloto: string
  grado: string
  unidad: string
  tipoMision: TipoMision
  fecha: string

  fechaNacimiento: string
  pesoKg: number
  tallaCm: number
  antecedentes: string[]
  antecedentesOtros: string

  funcionPrincipal: string
  funcionSecundaria: string
  cargoPrincipal: string
  cargoAdicional: string
  cargoMasDesgastante: CargoMasDesgastante
  desgastePercibido: number
  horasLaboralesDiarias: number
  diasLibresMes: number
  tieneRelevo: boolean
  recibeIncentivos: boolean
  intencionDejarCargo: IntencionDejarCargo

  horasSuenoUltimas24: number
  horasSuenoUltimas72: number
  horasDespierto: number
  calidadSueno: number
  duracionServicio: number
  sectores: number
  vueloNocturno: boolean
  husosHorarios: number
  diasConsecutivos: number
  kss: number
  samnPerelli: number
  epworth: number[]
}

export type NivelRiesgo = 'bajo' | 'moderado' | 'alto' | 'critico'

export interface Contribuyente {
  factor: string
  puntos: number
  maximo: number
  detalle: string
}

export interface Estrategia {
  titulo: string
  descripcion: string
  horizonte: 'inmediato' | 'previo_vuelo' | 'post_vuelo' | 'organizacional'
  prioridad: 'alta' | 'media' | 'baja'
}

export interface Resultado {
  puntaje: number
  nivel: NivelRiesgo
  contribuyentes: Contribuyente[]
  epworthTotal: number
  edad: number | null
  imc: number | null
  aptitud: string
  estrategias: Estrategia[]
}

export interface RegistroHistorial {
  id: string
  usuarioId: string
  creadoEn: string
  evaluacion: Evaluacion
  resultado: Resultado
}
