// Motor integrado de riesgo por fatiga.
//
// El motor es explícito y versionado: toda la parametrización vive en la definición del modelo
// guardada en la tabla `modelos_riesgo`, y cada resultado almacena la versión con la que fue
// calculado, sus componentes y las reglas que se dispararon. No hay ponderaciones ocultas.

import { DOMINIOS, INSTRUMENTOS_ESTANDARIZADOS } from './instrumentosBase.js'

export const NIVELES = ['bajo', 'moderado', 'alto', 'critico']

export const definicionModeloV1 = {
  nombre: 'Modelo integrado de riesgo por fatiga v1',
  descripcion:
    'Ponderación transparente de dominios normalizados 0-100, con modificadores longitudinales y reglas duras de seguridad. Los pesos son una propuesta operativa inicial y requieren validación institucional.',
  // Los pesos se renormalizan sobre los dominios con dato vigente.
  pesos: {
    somnolencia_aguda: 0.3,
    fatiga_aguda: 0.25,
    sueno_recuperacion: 0.2,
    carga_trabajo: 0.15,
    somnolencia_habitual: 0.1,
  },
  // Horas durante las que el último resultado sigue representando al dominio.
  vigenciaHoras: {
    somnolencia_aguda: 24,
    fatiga_aguda: 24,
    sueno_recuperacion: 24,
    carga_trabajo: 168,
    somnolencia_habitual: 4320,
  },
  umbrales: { moderado: 25, alto: 50, critico: 70 },
  umbralDominioElevado: 60,
  modificadores: {
    desviacionBase: { activo: true, zAlto: 1.5, puntosAlto: 8, zMedio: 1, puntosMedio: 4 },
    tendencia: { activo: true, deltaPuntos: 10, puntos: 6 },
    persistencia: { activo: true, mediciones: 3, puntos: 10 },
  },
  // Reglas duras: solo pueden elevar el nivel, nunca reducirlo.
  banderas: [
    {
      clave: 'kss_critico',
      instrumento: 'kss',
      operador: '>=',
      valor: 9,
      nivelMinimo: 'critico',
      texto: 'KSS = 9: lucha activa contra el sueño.',
    },
    {
      clave: 'kss_severo',
      instrumento: 'kss',
      operador: '>=',
      valor: 8,
      nivelMinimo: 'alto',
      texto: 'KSS ≥ 8: somnolencia severa con esfuerzo para mantenerse despierto.',
    },
    {
      clave: 'samn_perelli_critico',
      instrumento: 'samn_perelli',
      operador: '>=',
      valor: 7,
      nivelMinimo: 'critico',
      texto: 'Samn-Perelli = 7: agotamiento con incapacidad percibida de operar.',
    },
    {
      clave: 'samn_perelli_severo',
      instrumento: 'samn_perelli',
      operador: '>=',
      valor: 6,
      nivelMinimo: 'alto',
      texto: 'Samn-Perelli ≥ 6: fatiga extrema con dificultad de concentración.',
    },
    {
      clave: 'epworth_grave',
      instrumento: 'epworth',
      operador: '>=',
      valor: 16,
      nivelMinimo: 'moderado',
      texto: 'Epworth ≥ 16: somnolencia diurna excesiva grave; requiere valoración profesional.',
    },
    {
      clave: 'sueno_insuficiente',
      instrumento: 'registro_diario',
      campo: 'horasSueno',
      operador: '<',
      valor: 4,
      nivelMinimo: 'alto',
      texto: 'Menos de 4 horas de sueño en las últimas 24 horas.',
    },
    {
      clave: 'vigilia_prolongada',
      instrumento: 'registro_diario',
      campo: 'horasDespierto',
      operador: '>',
      valor: 16,
      nivelMinimo: 'alto',
      texto: 'Más de 16 horas continuas de vigilia.',
    },
  ],
  coberturaMinima: 0.5,
  // Cada cuántos días se espera una medición por dominio para considerar al evaluado al día.
  frecuenciaEsperadaDias: Object.fromEntries(
    INSTRUMENTOS_ESTANDARIZADOS.map((item) => [item.clave, item.frecuenciaDias]),
  ),
}

export const reglasAlertaPorDefecto = [
  {
    clave: 'nivel_alto',
    nombre: 'Riesgo alto o crítico',
    descripcion: 'El índice integrado alcanza el nivel alto o crítico.',
    tipo: 'nivel',
    parametros: { nivelMinimo: 'alto' },
    severidad: 'alta',
    activa: true,
  },
  {
    clave: 'desviacion_base',
    nombre: 'Desviación respecto a la línea base',
    descripcion: 'Un dominio agudo supera en 1,5 desviaciones la línea base individual.',
    tipo: 'desviacion',
    parametros: { z: 1.5 },
    severidad: 'media',
    activa: true,
  },
  {
    clave: 'persistencia',
    nombre: 'Riesgo persistente',
    descripcion: 'Tres o más mediciones consecutivas con nivel alto o crítico.',
    tipo: 'persistencia',
    parametros: { mediciones: 3 },
    severidad: 'alta',
    activa: true,
  },
  {
    clave: 'sin_datos',
    nombre: 'Sin evaluaciones recientes',
    descripcion: 'El evaluado no registra mediciones dentro de la frecuencia esperada.',
    tipo: 'cobertura',
    parametros: { diasSinDatos: 7 },
    severidad: 'baja',
    activa: true,
  },
]

export function nivelPorPuntaje(puntaje, umbrales) {
  if (puntaje >= umbrales.critico) return 'critico'
  if (puntaje >= umbrales.alto) return 'alto'
  if (puntaje >= umbrales.moderado) return 'moderado'
  return 'bajo'
}

function nivelMayor(a, b) {
  return NIVELES.indexOf(a) >= NIVELES.indexOf(b) ? a : b
}

function cumple(operador, valor, referencia) {
  if (operador === '>=') return valor >= referencia
  if (operador === '>') return valor > referencia
  if (operador === '<=') return valor <= referencia
  if (operador === '<') return valor < referencia
  return valor === referencia
}

function horasDesde(fechaIso, ahora) {
  const instante = Date.parse(fechaIso)
  if (!Number.isFinite(instante)) return Number.POSITIVE_INFINITY
  return (ahora.getTime() - instante) / 3_600_000
}

// Índice de sueño y recuperación derivado del registro diario.
// 8 h de sueño y 12 h de vigilia se toman como referencia operativa; ambos extremos se
// documentan como supuestos configurables pendientes de validación institucional.
export function indiceSueno({ horasSueno, horasDespierto }) {
  const deuda = Math.max(0, Math.min(100, ((8 - Number(horasSueno ?? 8)) / 4) * 100))
  const vigilia = Math.max(0, Math.min(100, ((Number(horasDespierto ?? 0) - 12) / 8) * 100))
  return Math.round((deuda * 0.6 + vigilia * 0.4) * 10) / 10
}

export function calcularLineaBase(valores) {
  const muestra = valores.slice(0, 10)
  if (muestra.length < 3) return null
  const media = muestra.reduce((total, valor) => total + valor, 0) / muestra.length
  const varianza =
    muestra.reduce((total, valor) => total + (valor - media) ** 2, 0) / Math.max(1, muestra.length - 1)
  return {
    media: Math.round(media * 10) / 10,
    desviacion: Math.round(Math.sqrt(varianza) * 10) / 10,
    n: muestra.length,
    provisional: muestra.length < 5,
  }
}

export function zRespectoBase(valor, base) {
  if (!base) return null
  // Piso de 5 puntos en la desviación: evita z enormes cuando la persona respondió casi igual.
  const desviacion = Math.max(base.desviacion, 5)
  return Math.round(((valor - base.media) / desviacion) * 100) / 100
}

export function mediaMovil(series, dias, ahora) {
  const limite = ahora.getTime() - dias * 86_400_000
  const valores = series.filter((punto) => Date.parse(punto.fecha) >= limite).map((punto) => punto.valor)
  if (valores.length === 0) return null
  return Math.round((valores.reduce((total, valor) => total + valor, 0) / valores.length) * 10) / 10
}

export function tendencia(series, ahora) {
  const corta = mediaMovil(series, 7, ahora)
  const larga = mediaMovil(series, 28, ahora)
  if (corta === null || larga === null) return { corta, larga, delta: null, direccion: 'sin_datos' }
  const delta = Math.round((corta - larga) * 10) / 10
  let direccion = 'estable'
  if (delta >= 5) direccion = 'deterioro'
  else if (delta <= -5) direccion = 'recuperacion'
  return { corta, larga, delta, direccion }
}

export function persistencia(historial, umbrales, mediciones) {
  let consecutivas = 0
  for (const punto of historial) {
    if (punto.puntaje >= umbrales.alto) consecutivas += 1
    else break
  }
  const episodiosElevados = historial.filter((punto) => punto.puntaje >= umbrales.alto).length
  return {
    consecutivas,
    persistente: consecutivas >= mediciones,
    episodiosElevados,
    // Recuperación: la última medición bajó de umbral tras una racha previa de tres o más.
    recuperado:
      consecutivas === 0 &&
      historial.slice(1, 4).filter((punto) => punto.puntaje >= umbrales.alto).length >= 3,
  }
}

/**
 * Calcula el índice integrado de un evaluado.
 *
 * @param {object} entrada
 * @param {object} entrada.definicion definición versionada del modelo
 * @param {Array}  entrada.mediciones [{ clave, dominio, puntaje, normalizado, fecha }]
 * @param {object} entrada.registroDiario último registro de sueño y jornada (o null)
 * @param {object} entrada.lineasBase { [dominio]: { media, desviacion, n } }
 * @param {Array}  entrada.historialIntegrado [{ fecha, puntaje }] del más reciente al más antiguo
 * @param {Date}   entrada.ahora
 */
export function calcularRiesgo({
  definicion,
  mediciones,
  registroDiario,
  lineasBase = {},
  historialIntegrado = [],
  ahora = new Date(),
}) {
  const componentes = []
  const factores = []
  const banderas = []

  const porDominio = new Map()
  for (const medicion of mediciones) {
    const previo = porDominio.get(medicion.dominio)
    if (!previo || Date.parse(medicion.fecha) > Date.parse(previo.fecha)) {
      porDominio.set(medicion.dominio, medicion)
    }
  }
  if (registroDiario) {
    porDominio.set('sueno_recuperacion', {
      clave: 'registro_diario',
      dominio: 'sueno_recuperacion',
      puntaje: indiceSueno(registroDiario),
      normalizado: indiceSueno(registroDiario),
      fecha: registroDiario.fecha,
      detalle: {
        horasSueno: registroDiario.horasSueno,
        horasDespierto: registroDiario.horasDespierto,
      },
    })
  }

  let pesoDisponible = 0
  for (const [dominio, peso] of Object.entries(definicion.pesos)) {
    const medicion = porDominio.get(dominio)
    const vigencia = definicion.vigenciaHoras[dominio] ?? 24
    const antiguedad = medicion ? horasDesde(medicion.fecha, ahora) : null
    const vigente = Boolean(medicion) && antiguedad !== null && antiguedad <= vigencia
    if (vigente) pesoDisponible += peso
    componentes.push({
      dominio,
      nombre: DOMINIOS[dominio]?.nombre ?? dominio,
      instrumento: medicion?.clave ?? null,
      puntaje: medicion?.puntaje ?? null,
      normalizado: medicion?.normalizado ?? null,
      fecha: medicion?.fecha ?? null,
      antiguedadHoras: antiguedad === null ? null : Math.round(antiguedad * 10) / 10,
      vigenciaHoras: vigencia,
      vigente,
      peso,
      pesoEfectivo: 0,
      aporte: 0,
    })
  }

  let base = 0
  if (pesoDisponible > 0) {
    for (const componente of componentes) {
      if (!componente.vigente) continue
      componente.pesoEfectivo = Math.round((componente.peso / pesoDisponible) * 1000) / 1000
      componente.aporte = Math.round(componente.normalizado * componente.pesoEfectivo * 10) / 10
      base += componente.aporte
      if (componente.normalizado >= definicion.umbralDominioElevado) {
        factores.push({
          tipo: 'dominio',
          clave: componente.dominio,
          texto: `${componente.nombre} elevada (${componente.normalizado}/100).`,
          aporte: componente.aporte,
        })
      }
    }
  }
  base = Math.round(base * 10) / 10

  const cobertura = Math.round(pesoDisponible * 100) / 100
  let puntaje = base
  const modificadores = []

  const configBase = definicion.modificadores?.desviacionBase
  if (configBase?.activo) {
    for (const componente of componentes) {
      if (!componente.vigente) continue
      const z = zRespectoBase(componente.normalizado, lineasBase[componente.dominio])
      componente.z = z
      if (z === null) continue
      if (z >= configBase.zAlto) {
        modificadores.push({
          clave: `desviacion_${componente.dominio}`,
          texto: `${componente.nombre} ${z} desviaciones sobre la línea base individual.`,
          puntos: configBase.puntosAlto,
        })
      } else if (z >= configBase.zMedio) {
        modificadores.push({
          clave: `desviacion_${componente.dominio}`,
          texto: `${componente.nombre} ${z} desviaciones sobre la línea base individual.`,
          puntos: configBase.puntosMedio,
        })
      }
    }
  }

  const serie = historialIntegrado.map((punto) => ({ fecha: punto.fecha, valor: punto.puntaje }))
  const tendenciaIntegrada = tendencia(serie, ahora)
  const configTendencia = definicion.modificadores?.tendencia
  if (
    configTendencia?.activo &&
    tendenciaIntegrada.delta !== null &&
    tendenciaIntegrada.delta >= configTendencia.deltaPuntos
  ) {
    modificadores.push({
      clave: 'tendencia',
      texto: `Tendencia al deterioro: la media de 7 días supera en ${tendenciaIntegrada.delta} puntos a la de 28 días.`,
      puntos: configTendencia.puntos,
    })
  }

  const configPersistencia = definicion.modificadores?.persistencia
  const persistencias = persistencia(
    historialIntegrado,
    definicion.umbrales,
    configPersistencia?.mediciones ?? 3,
  )
  if (configPersistencia?.activo && persistencias.persistente) {
    modificadores.push({
      clave: 'persistencia',
      texto: `Riesgo sostenido: ${persistencias.consecutivas} mediciones consecutivas en nivel alto o superior.`,
      puntos: configPersistencia.puntos,
    })
  }

  for (const modificador of modificadores) puntaje += modificador.puntos
  puntaje = Math.max(0, Math.min(100, Math.round(puntaje * 10) / 10))

  let nivel = pesoDisponible > 0 ? nivelPorPuntaje(puntaje, definicion.umbrales) : 'bajo'

  for (const bandera of definicion.banderas ?? []) {
    let valor = null
    if (bandera.instrumento === 'registro_diario') {
      valor = registroDiario ? Number(registroDiario[bandera.campo]) : null
      if (registroDiario && horasDesde(registroDiario.fecha, ahora) > 24) valor = null
    } else {
      const medicion = mediciones.find((item) => item.clave === bandera.instrumento)
      const vigencia = definicion.vigenciaHoras[medicion?.dominio] ?? 24
      valor = medicion && horasDesde(medicion.fecha, ahora) <= vigencia ? medicion.puntaje : null
    }
    if (valor === null || !Number.isFinite(valor)) continue
    if (cumple(bandera.operador, valor, bandera.valor)) {
      banderas.push({ clave: bandera.clave, texto: bandera.texto, nivelMinimo: bandera.nivelMinimo })
      nivel = nivelMayor(nivel, bandera.nivelMinimo)
    }
  }

  const dominiosVigentes = componentes.filter((componente) => componente.vigente).length
  let confianza = 'alta'
  if (cobertura < (definicion.coberturaMinima ?? 0.5) || dominiosVigentes <= 1) confianza = 'baja'
  else if (cobertura < 0.8) confianza = 'media'

  const senales = {
    agudo: Math.max(
      componentes.find((item) => item.dominio === 'somnolencia_aguda' && item.vigente)?.normalizado ?? 0,
      componentes.find((item) => item.dominio === 'fatiga_aguda' && item.vigente)?.normalizado ?? 0,
    ),
    acumulado: tendenciaIntegrada.corta,
    persistente: persistencias.persistente,
    recuperacion: persistencias.recuperado || tendenciaIntegrada.direccion === 'recuperacion',
    episodiosElevados: persistencias.episodiosElevados,
    medicionesConsecutivasElevadas: persistencias.consecutivas,
  }

  return {
    puntaje,
    puntajeBase: base,
    nivel,
    cobertura,
    confianza,
    componentes,
    modificadores,
    banderas,
    factores,
    tendencia: tendenciaIntegrada,
    senales,
    calculadoEn: ahora.toISOString(),
  }
}

// Texto legible que explica por qué el resultado quedó en ese nivel.
export function explicar(resultado) {
  const partes = []
  for (const componente of resultado.componentes) {
    if (!componente.vigente) continue
    partes.push(
      `${componente.nombre}: ${componente.normalizado}/100 (peso ${Math.round(componente.pesoEfectivo * 100)}%, aporta ${componente.aporte} puntos)`,
    )
  }
  for (const modificador of resultado.modificadores) partes.push(`${modificador.texto} (+${modificador.puntos})`)
  for (const bandera of resultado.banderas) partes.push(`Regla ${bandera.clave}: ${bandera.texto}`)
  if (resultado.confianza !== 'alta') {
    partes.push(`Confianza ${resultado.confianza}: cobertura de dominios ${Math.round(resultado.cobertura * 100)}%.`)
  }
  return partes
}
