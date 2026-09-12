// Catálogo de instrumentos estandarizados.
//
// Cada instrumento vive en su propia tabla de preguntas, conserva su puntuación original y
// se normaliza a 0-100 solo para alimentar el modelo integrado. Los enunciados, opciones y
// puntuaciones provienen de las escalas publicadas y no son editables desde administración:
// modificarlos destruiría la validez del instrumento.

function escalaSimple(opciones) {
  return opciones.map((texto, indice) => ({ texto, valor: indice }))
}

const OPCIONES_KSS = [
  '1 · Extremadamente alerta',
  '2 · Muy alerta',
  '3 · Alerta',
  '4 · Bastante alerta',
  '5 · Ni alerta ni somnoliento',
  '6 · Algunos signos de somnolencia',
  '7 · Somnoliento, sin esfuerzo para mantenerme despierto',
  '8 · Somnoliento, con algo de esfuerzo para mantenerme despierto',
  '9 · Muy somnoliento, gran esfuerzo para mantenerme despierto, luchando contra el sueño',
].map((texto, indice) => ({ texto, valor: indice + 1 }))

const OPCIONES_SAMN_PERELLI = [
  '1 · Plenamente alerta, bien despierto',
  '2 · Muy animado, con capacidad de respuesta, pero no en punto máximo',
  '3 · Bien, algo descansado',
  '4 · Un poco cansado, menos que fresco',
  '5 · Moderadamente cansado, decaído',
  '6 · Extremadamente cansado, con mucha dificultad para concentrarme',
  '7 · Completamente agotado, incapaz de funcionar con eficacia',
].map((texto, indice) => ({ texto, valor: indice + 1 }))

const OPCIONES_EPWORTH = escalaSimple([
  '0 · Nunca me quedaría dormido',
  '1 · Poca probabilidad de quedarme dormido',
  '2 · Probabilidad moderada de quedarme dormido',
  '3 · Alta probabilidad de quedarme dormido',
])

const SITUACIONES_EPWORTH = [
  'Sentado y leyendo',
  'Viendo televisión',
  'Sentado, inactivo, en un lugar público (por ejemplo, una reunión o una conferencia)',
  'Como pasajero en un vehículo durante una hora seguida',
  'Recostado para descansar por la tarde cuando las circunstancias lo permiten',
  'Sentado conversando con alguien',
  'Sentado tranquilamente después de una comida sin alcohol',
  'En un vehículo, detenido unos minutos por el tráfico',
]

const SUBESCALAS_TLX = [
  {
    clave: 'mental',
    texto: 'Demanda mental',
    ayuda: '¿Cuánta actividad mental y perceptiva exigió la tarea? (0 = muy baja, 100 = muy alta)',
  },
  {
    clave: 'fisica',
    texto: 'Demanda física',
    ayuda: '¿Cuánta actividad física exigió la tarea? (0 = muy baja, 100 = muy alta)',
  },
  {
    clave: 'temporal',
    texto: 'Demanda temporal',
    ayuda: '¿Cuánta presión de tiempo sentiste por el ritmo de la tarea? (0 = muy baja, 100 = muy alta)',
  },
  {
    clave: 'rendimiento',
    texto: 'Rendimiento',
    ayuda:
      'Nivel de insatisfacción con tu propio desempeño (0 = totalmente satisfecho, 100 = totalmente insatisfecho)',
  },
  {
    clave: 'esfuerzo',
    texto: 'Esfuerzo',
    ayuda: '¿Cuánto tuviste que esforzarte para alcanzar tu nivel de desempeño? (0 = muy poco, 100 = muchísimo)',
  },
  {
    clave: 'frustracion',
    texto: 'Frustración',
    ayuda: '¿Cuán inseguro, irritado o estresado te sentiste durante la tarea? (0 = nada, 100 = muchísimo)',
  },
]

function preguntaEscalaTlx(subescala, orden) {
  return {
    clave: `tlx_${subescala.clave}`,
    texto: subescala.texto,
    ayuda: subescala.ayuda,
    tipo: 'escala',
    minimo: 0,
    maximo: 100,
    paso: 5,
    opciones: [],
    obligatoria: true,
    orden,
  }
}

export const DOMINIOS = {
  somnolencia_aguda: {
    clave: 'somnolencia_aguda',
    nombre: 'Somnolencia aguda',
    descripcion: 'Nivel de somnolencia en el momento de la medición.',
    escalaTemporal: 'estado inmediato (minutos)',
  },
  fatiga_aguda: {
    clave: 'fatiga_aguda',
    nombre: 'Fatiga aguda',
    descripcion: 'Capacidad funcional percibida durante el servicio.',
    escalaTemporal: 'estado inmediato (turno)',
  },
  sueno_recuperacion: {
    clave: 'sueno_recuperacion',
    nombre: 'Sueño y recuperación',
    descripcion: 'Sueño obtenido, vigilia acumulada y oportunidad de recuperación.',
    escalaTemporal: 'últimas 24-72 horas',
  },
  carga_trabajo: {
    clave: 'carga_trabajo',
    nombre: 'Carga de trabajo percibida',
    descripcion: 'Demanda de la tarea o del turno recién ejecutado.',
    escalaTemporal: 'tarea o turno reciente (días)',
  },
  somnolencia_habitual: {
    clave: 'somnolencia_habitual',
    nombre: 'Somnolencia diurna habitual',
    descripcion: 'Propensión habitual a dormirse en situaciones cotidianas.',
    escalaTemporal: 'semanas o meses (rasgo)',
  },
}

// `vigenciaHoras` define cuánto tiempo un resultado sigue representando al dominio.
// Fuera de esa ventana el dominio deja de aportar al índice y sus pesos se renormalizan.
export const INSTRUMENTOS_ESTANDARIZADOS = [
  {
    clave: 'kss',
    nombre: 'KSS · Karolinska Sleepiness Scale',
    descripcion:
      'Escala de un ítem que mide la somnolencia percibida en los últimos cinco a diez minutos. Rango 1-9.',
    dominio: 'somnolencia_aguda',
    frecuenciaDias: 1,
    vigenciaHoras: 24,
    orden: 1,
    puntajeMinimo: 1,
    puntajeMaximo: 9,
    preguntas: [
      {
        clave: 'kss',
        texto: '¿Cómo te sientes en este momento?',
        ayuda: 'Selecciona el estado que mejor describe tu somnolencia en los últimos 5 a 10 minutos.',
        tipo: 'unica',
        opciones: OPCIONES_KSS,
        obligatoria: true,
        orden: 1,
      },
    ],
  },
  {
    clave: 'samn_perelli',
    nombre: 'Samn-Perelli · Crew Status Check',
    descripcion:
      'Escala de un ítem que mide la fatiga percibida de la tripulación durante el servicio. Rango 1-7.',
    dominio: 'fatiga_aguda',
    frecuenciaDias: 1,
    vigenciaHoras: 24,
    orden: 2,
    puntajeMinimo: 1,
    puntajeMaximo: 7,
    preguntas: [
      {
        clave: 'samn_perelli',
        texto: '¿Cuál es tu estado de fatiga en este momento?',
        ayuda: 'Selecciona la descripción que corresponde a tu capacidad funcional actual.',
        tipo: 'unica',
        opciones: OPCIONES_SAMN_PERELLI,
        obligatoria: true,
        orden: 1,
      },
    ],
  },
  {
    clave: 'epworth',
    nombre: 'Epworth Sleepiness Scale',
    descripcion:
      'Ocho situaciones cotidianas puntuadas de 0 a 3 según la probabilidad de quedarse dormido. Total 0-24, referencia clínica ≥ 11.',
    dominio: 'somnolencia_habitual',
    frecuenciaDias: 90,
    vigenciaHoras: 180 * 24,
    orden: 3,
    puntajeMinimo: 0,
    puntajeMaximo: 24,
    preguntas: SITUACIONES_EPWORTH.map((situacion, indice) => ({
      clave: `epworth_${indice + 1}`,
      texto: situacion,
      ayuda: 'Probabilidad de quedarte dormido en esa situación durante los últimos tiempos.',
      tipo: 'unica',
      opciones: OPCIONES_EPWORTH,
      obligatoria: true,
      orden: indice + 1,
    })),
  },
  {
    clave: 'nasa_tlx',
    nombre: 'NASA-TLX (RTLX) · Carga de trabajo',
    descripcion:
      'Seis subescalas de 0 a 100 sobre la tarea o el turno recién ejecutado. Se calcula el RTLX (promedio simple, sin comparaciones pareadas).',
    dominio: 'carga_trabajo',
    frecuenciaDias: 7,
    vigenciaHoras: 7 * 24,
    orden: 4,
    puntajeMinimo: 0,
    puntajeMaximo: 100,
    preguntas: SUBESCALAS_TLX.map((subescala, indice) => preguntaEscalaTlx(subescala, indice + 1)),
  },
]

export const CLAVES_ESTANDARIZADAS = INSTRUMENTOS_ESTANDARIZADOS.map((item) => item.clave)

export function definicionDe(clave) {
  return INSTRUMENTOS_ESTANDARIZADOS.find((item) => item.clave === clave) ?? null
}

function valorNumerico(pregunta, respuestas) {
  const valor = respuestas[pregunta.id]
  if (valor === undefined || valor === null || valor === '') return null
  if (pregunta.tipo === 'unica') {
    const opcion = pregunta.opciones.find((item) => item.texto === valor)
    return opcion ? opcion.valor : null
  }
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

function interpretarKss(puntaje) {
  if (puntaje >= 8) return 'Somnolencia severa: riesgo elevado de microsueños durante la operación.'
  if (puntaje >= 7) return 'Somnolencia presente sin esfuerzo para mantenerse despierto.'
  if (puntaje >= 6) return 'Primeros signos de somnolencia.'
  return 'Estado de alerta conservado.'
}

function interpretarSamnPerelli(puntaje) {
  if (puntaje >= 7) return 'Agotamiento completo: incapacidad percibida de funcionar con eficacia.'
  if (puntaje >= 6) return 'Fatiga extrema con dificultad importante de concentración.'
  if (puntaje >= 5) return 'Fatiga moderada, rendimiento percibido en descenso.'
  if (puntaje >= 4) return 'Cansancio leve, por debajo del estado óptimo.'
  return 'Estado funcional conservado.'
}

function interpretarEpworth(puntaje) {
  if (puntaje >= 16) return 'Somnolencia diurna excesiva grave (≥ 16). Requiere valoración profesional.'
  if (puntaje >= 11) return 'Somnolencia diurna excesiva (11-15) según el punto de corte habitual.'
  if (puntaje >= 8) return 'Somnolencia diurna en el límite superior de lo normal (8-10).'
  return 'Somnolencia diurna dentro del rango normal (0-7).'
}

function interpretarTlx(puntaje) {
  if (puntaje >= 80) return 'Carga de trabajo percibida muy alta.'
  if (puntaje >= 60) return 'Carga de trabajo percibida alta.'
  if (puntaje >= 40) return 'Carga de trabajo percibida media.'
  return 'Carga de trabajo percibida baja.'
}

// Devuelve { puntaje, normalizado, interpretacion, detalle } o null si faltan datos.
export function calcularEstandarizado(clave, preguntas, respuestas) {
  const definicion = definicionDe(clave)
  if (!definicion) return null

  if (clave === 'kss' || clave === 'samn_perelli') {
    const pregunta = preguntas[0]
    if (!pregunta) return null
    const valor = valorNumerico(pregunta, respuestas)
    if (valor === null) return null
    const normalizado =
      ((valor - definicion.puntajeMinimo) / (definicion.puntajeMaximo - definicion.puntajeMinimo)) * 100
    return {
      puntaje: valor,
      normalizado: Math.round(normalizado * 10) / 10,
      interpretacion: clave === 'kss' ? interpretarKss(valor) : interpretarSamnPerelli(valor),
      detalle: { valor },
    }
  }

  if (clave === 'epworth') {
    let total = 0
    const items = {}
    for (const pregunta of preguntas) {
      const valor = valorNumerico(pregunta, respuestas)
      if (valor === null) return null
      total += valor
      items[pregunta.texto] = valor
    }
    return {
      puntaje: total,
      normalizado: Math.round((total / 24) * 1000) / 10,
      interpretacion: interpretarEpworth(total),
      detalle: { items, corteClinico: 11 },
    }
  }

  if (clave === 'nasa_tlx') {
    const subescalas = {}
    let suma = 0
    for (const pregunta of preguntas) {
      const valor = valorNumerico(pregunta, respuestas)
      if (valor === null) return null
      subescalas[pregunta.texto] = valor
      suma += valor
    }
    const rtlx = Math.round((suma / preguntas.length) * 10) / 10
    return {
      puntaje: rtlx,
      normalizado: rtlx,
      interpretacion: interpretarTlx(rtlx),
      detalle: { subescalas, metodo: 'RTLX (promedio simple de las seis subescalas)' },
    }
  }

  return null
}
