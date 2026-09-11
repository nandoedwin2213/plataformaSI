import type { CargoMasDesgastante, Evaluacion, IntencionDejarCargo, NivelRiesgo, TipoMision } from './types'

export const gradosMilitares: { categoria: string; grados: string[] }[] = [
  {
    categoria: 'Tropa',
    grados: [
      'Soldado / Aerotécnico',
      'Cabo Segundo',
      'Cabo Primero',
      'Sargento Segundo',
      'Sargento Primero',
      'Suboficial Segundo',
      'Suboficial Primero',
      'Suboficial Mayor',
    ],
  },
  {
    categoria: 'Oficiales subalternos',
    grados: ['Subteniente', 'Teniente', 'Capitán'],
  },
  {
    categoria: 'Oficiales superiores',
    grados: ['Mayor', 'Teniente Coronel', 'Coronel'],
  },
  {
    categoria: 'Oficiales generales',
    grados: ['Brigadier General', 'General del Aire'],
  },
  {
    categoria: 'Otros',
    grados: ['Cadete / Aspirante', 'Personal civil de la institución', 'Otro'],
  },
]

export const antecedentesMedicos: { valor: string; texto: string }[] = [
  { valor: 'apnea', texto: 'Apnea del sueño o ronquido con pausas' },
  { valor: 'insomnio', texto: 'Insomnio crónico' },
  { valor: 'hipertension', texto: 'Hipertensión arterial' },
  { valor: 'diabetes', texto: 'Diabetes o alteración metabólica' },
  { valor: 'ansiedad_depresion', texto: 'Ansiedad, depresión o estrés postraumático' },
  { valor: 'osteomuscular', texto: 'Dolor o lesión osteomuscular activa' },
  { valor: 'medicacion_sedante', texto: 'Medicación con efecto sedante' },
  { valor: 'gastrointestinal', texto: 'Trastorno gastrointestinal recurrente' },
]

export const opcionesCargoDesgastante: { valor: CargoMasDesgastante; texto: string }[] = [
  { valor: 'funcion_principal', texto: 'La función principal' },
  { valor: 'funcion_secundaria', texto: 'La función secundaria' },
  { valor: 'cargo_principal', texto: 'El cargo principal' },
  { valor: 'cargo_adicional', texto: 'El cargo adicional' },
  { valor: 'todos_igual', texto: 'Todos por igual' },
]

export const opcionesIntencion: { valor: IntencionDejarCargo; texto: string }[] = [
  { valor: 'no', texto: 'No, deseo continuar en el cargo' },
  { valor: 'ocasional', texto: 'A veces lo he pensado' },
  { valor: 'frecuente', texto: 'Lo pienso con frecuencia' },
  { valor: 'decidido', texto: 'He decidido solicitar el cambio o la baja' },
]

export const escalaKss: { valor: number; texto: string }[] = [
  { valor: 1, texto: 'Extremadamente alerta' },
  { valor: 2, texto: 'Muy alerta' },
  { valor: 3, texto: 'Alerta' },
  { valor: 4, texto: 'Bastante alerta' },
  { valor: 5, texto: 'Ni alerta ni somnoliento' },
  { valor: 6, texto: 'Algunos signos de somnolencia' },
  { valor: 7, texto: 'Somnoliento, sin esfuerzo para mantenerse despierto' },
  { valor: 8, texto: 'Somnoliento, con algo de esfuerzo para mantenerse despierto' },
  { valor: 9, texto: 'Muy somnoliento, gran esfuerzo por no dormirse' },
]

export const escalaSamnPerelli: { valor: number; texto: string }[] = [
  { valor: 1, texto: 'Totalmente alerta, bien despierto' },
  { valor: 2, texto: 'Muy animado, con buena capacidad de respuesta' },
  { valor: 3, texto: 'Bien, algo descansado' },
  { valor: 4, texto: 'Un poco cansado, menos que descansado' },
  { valor: 5, texto: 'Moderadamente cansado, decaído' },
  { valor: 6, texto: 'Extremadamente cansado, muy difícil concentrarse' },
  { valor: 7, texto: 'Completamente exhausto, incapaz de funcionar eficazmente' },
]

export const situacionesEpworth: string[] = [
  'Sentado leyendo',
  'Viendo televisión',
  'Sentado inactivo en un lugar público (reunión, briefing)',
  'Como pasajero en un vehículo durante una hora seguida',
  'Recostado para descansar por la tarde cuando las circunstancias lo permiten',
  'Sentado conversando con alguien',
  'Sentado tranquilamente después de almorzar sin haber bebido alcohol',
  'En un vehículo detenido pocos minutos en el tráfico',
]

export const opcionesEpworth: { valor: number; texto: string }[] = [
  { valor: 0, texto: 'Nunca' },
  { valor: 1, texto: 'Poca probabilidad' },
  { valor: 2, texto: 'Probabilidad moderada' },
  { valor: 3, texto: 'Alta probabilidad' },
]

export const tiposMision: { valor: TipoMision; texto: string }[] = [
  { valor: 'transporte', texto: 'Transporte / logística' },
  { valor: 'caza', texto: 'Caza / interceptación' },
  { valor: 'helicoptero', texto: 'Ala rotatoria' },
  { valor: 'entrenamiento', texto: 'Instrucción / entrenamiento' },
  { valor: 'busqueda_rescate', texto: 'Búsqueda y rescate' },
]

export const etiquetaNivel: Record<NivelRiesgo, string> = {
  bajo: 'Riesgo bajo',
  moderado: 'Riesgo moderado',
  alto: 'Riesgo alto',
  critico: 'Riesgo crítico',
}

export const colorNivel: Record<NivelRiesgo, string> = {
  bajo: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/40',
  moderado: 'bg-amber-500/10 text-amber-300 border-amber-400/40',
  alto: 'bg-orange-500/10 text-orange-300 border-orange-400/40',
  critico: 'bg-red-500/10 text-red-300 border-red-400/40',
}

export const barraNivel: Record<NivelRiesgo, string> = {
  bajo: 'bg-emerald-500',
  moderado: 'bg-amber-500',
  alto: 'bg-orange-500',
  critico: 'bg-red-600',
}

export const etiquetaHorizonte: Record<string, string> = {
  inmediato: 'Durante el vuelo',
  previo_vuelo: 'Antes del vuelo',
  post_vuelo: 'Recuperación',
  organizacional: 'Organizacional / FRMS',
}

export const evaluacionInicial: Evaluacion = {
  piloto: '',
  grado: 'Teniente',
  unidad: '',
  tipoMision: 'transporte',
  fecha: new Date().toISOString().slice(0, 10),
  fechaNacimiento: '',
  pesoKg: 75,
  tallaCm: 172,
  antecedentes: [],
  antecedentesOtros: '',
  funcionPrincipal: '',
  funcionSecundaria: '',
  cargoPrincipal: '',
  cargoAdicional: '',
  cargoMasDesgastante: 'funcion_principal',
  desgastePercibido: 3,
  horasLaboralesDiarias: 8,
  diasLibresMes: 8,
  tieneRelevo: true,
  recibeIncentivos: false,
  intencionDejarCargo: 'no',
  horasSuenoUltimas24: 7,
  horasSuenoUltimas72: 21,
  horasDespierto: 8,
  calidadSueno: 4,
  duracionServicio: 8,
  sectores: 2,
  vueloNocturno: false,
  husosHorarios: 0,
  diasConsecutivos: 2,
  kss: 3,
  samnPerelli: 2,
  epworth: Array(8).fill(0),
}
