import type { Contribuyente, Estrategia, Evaluacion, NivelRiesgo, Resultado } from './types'
import { antecedentesMedicos, opcionesCargoDesgastante } from './catalogos'
import { ajustesPorDefecto, type Umbrales } from './usuarios'

const clamp = (valor: number, min: number, max: number) => Math.min(max, Math.max(min, valor))

export function calcularEdad(fechaNacimiento: string): number | null {
  if (!fechaNacimiento) return null
  const nacimiento = new Date(fechaNacimiento)
  if (Number.isNaN(nacimiento.getTime())) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mes = hoy.getMonth() - nacimiento.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad -= 1
  return edad >= 0 && edad < 120 ? edad : null
}

export function calcularImc(pesoKg: number, tallaCm: number): number | null {
  if (!pesoKg || !tallaCm) return null
  const metros = tallaCm / 100
  const imc = pesoKg / (metros * metros)
  return Number.isFinite(imc) ? Math.round(imc * 10) / 10 : null
}

function puntosSueno24(horas: number): Contribuyente {
  let puntos = 20
  if (horas >= 8) puntos = 0
  else if (horas >= 7) puntos = 3
  else if (horas >= 6) puntos = 7
  else if (horas >= 5) puntos = 12
  return {
    factor: 'Sueño en las últimas 24 h',
    puntos,
    maximo: 20,
    detalle: `${horas} h dormidas (referencia operacional: 8 h)`,
  }
}

function puntosSueno72(horas: number): Contribuyente {
  let puntos = 12
  if (horas >= 24) puntos = 0
  else if (horas >= 21) puntos = 3
  else if (horas >= 18) puntos = 6
  else if (horas >= 15) puntos = 9
  return {
    factor: 'Deuda de sueño acumulada (72 h)',
    puntos,
    maximo: 12,
    detalle: `${horas} h en 72 h (referencia: 24 h)`,
  }
}

function puntosVigilia(horas: number): Contribuyente {
  let puntos = 15
  if (horas <= 12) puntos = 0
  else if (horas <= 16) puntos = 5
  else if (horas <= 20) puntos = 10
  return {
    factor: 'Horas continuas de vigilia',
    puntos,
    maximo: 15,
    detalle: `${horas} h desde el último despertar`,
  }
}

function puntosCalidad(calidad: number): Contribuyente {
  return {
    factor: 'Calidad subjetiva del sueño',
    puntos: (5 - clamp(calidad, 1, 5)) * 2,
    maximo: 8,
    detalle: `Calidad ${calidad}/5`,
  }
}

function puntosKss(kss: number): Contribuyente {
  return {
    factor: 'Somnolencia actual (Karolinska, KSS)',
    puntos: clamp((kss - 3) * 3, 0, 18),
    maximo: 18,
    detalle: `KSS ${kss}/9`,
  }
}

function puntosSamnPerelli(sp: number): Contribuyente {
  return {
    factor: 'Fatiga percibida (Samn-Perelli)',
    puntos: clamp((sp - 2) * 3, 0, 15),
    maximo: 15,
    detalle: `Samn-Perelli ${sp}/7`,
  }
}

export function totalEpworth(respuestas: number[]): number {
  return respuestas.reduce((suma, valor) => suma + valor, 0)
}

function puntosEpworth(total: number): Contribuyente {
  let puntos = 0
  if (total >= 18) puntos = 8
  else if (total >= 15) puntos = 6
  else if (total >= 11) puntos = 4
  return {
    factor: 'Somnolencia diurna crónica (Epworth)',
    puntos,
    maximo: 8,
    detalle: `Epworth ${total}/24`,
  }
}

function puntosCargaOperacional(evaluacion: Evaluacion): Contribuyente {
  let puntos = 0
  const notas: string[] = []

  if (evaluacion.duracionServicio > 14) {
    puntos += 6
    notas.push(`servicio de ${evaluacion.duracionServicio} h`)
  } else if (evaluacion.duracionServicio > 12) {
    puntos += 4
    notas.push(`servicio de ${evaluacion.duracionServicio} h`)
  } else if (evaluacion.duracionServicio > 10) {
    puntos += 2
    notas.push(`servicio de ${evaluacion.duracionServicio} h`)
  }

  if (evaluacion.sectores >= 6) {
    puntos += 3
    notas.push(`${evaluacion.sectores} sectores`)
  } else if (evaluacion.sectores >= 4) {
    puntos += 2
    notas.push(`${evaluacion.sectores} sectores`)
  }

  if (evaluacion.vueloNocturno) {
    puntos += 3
    notas.push('operación nocturna / ventana de baja circadiana')
  }

  if (evaluacion.husosHorarios >= 3) {
    puntos += 2
    notas.push(`${evaluacion.husosHorarios} husos horarios cruzados`)
  }

  if (evaluacion.diasConsecutivos >= 6) {
    puntos += 3
    notas.push(`${evaluacion.diasConsecutivos} días consecutivos de vuelo`)
  } else if (evaluacion.diasConsecutivos >= 4) {
    puntos += 2
    notas.push(`${evaluacion.diasConsecutivos} días consecutivos de vuelo`)
  }

  return {
    factor: 'Carga operacional y ritmo circadiano',
    puntos: clamp(puntos, 0, 14),
    maximo: 14,
    detalle: notas.length > 0 ? notas.join(', ') : 'sin factores operacionales agravantes',
  }
}

const pesosAntecedentes: Record<string, number> = {
  apnea: 4,
  insomnio: 3,
  medicacion_sedante: 3,
  ansiedad_depresion: 2,
  hipertension: 1,
  diabetes: 1,
  osteomuscular: 1,
  gastrointestinal: 1,
}

function puntosPerfilSalud(evaluacion: Evaluacion, edad: number | null, imc: number | null): Contribuyente {
  let puntos = 0
  const notas: string[] = []

  if (edad !== null) {
    if (edad >= 50) {
      puntos += 2
      notas.push(`${edad} años`)
    } else if (edad >= 40) {
      puntos += 1
      notas.push(`${edad} años`)
    }
  }

  if (imc !== null) {
    if (imc >= 30) {
      puntos += 3
      notas.push(`IMC ${imc} (obesidad)`)
    } else if (imc >= 25) {
      puntos += 1
      notas.push(`IMC ${imc} (sobrepeso)`)
    }
  }

  for (const antecedente of evaluacion.antecedentes) {
    puntos += pesosAntecedentes[antecedente] ?? 1
    const catalogo = antecedentesMedicos.find((item) => item.valor === antecedente)
    notas.push((catalogo?.texto ?? antecedente).toLowerCase())
  }

  if (evaluacion.antecedentesOtros.trim()) {
    puntos += 1
    notas.push(evaluacion.antecedentesOtros.trim().toLowerCase())
  }

  return {
    factor: 'Perfil biomédico y antecedentes',
    puntos: clamp(puntos, 0, 12),
    maximo: 12,
    detalle: notas.length > 0 ? notas.join(', ') : 'sin antecedentes relevantes registrados',
  }
}

function puntosCargaInstitucional(evaluacion: Evaluacion): Contribuyente {
  let puntos = 0
  const notas: string[] = []

  if (evaluacion.horasLaboralesDiarias > 12) {
    puntos += 6
    notas.push(`${evaluacion.horasLaboralesDiarias} h laborales diarias`)
  } else if (evaluacion.horasLaboralesDiarias > 10) {
    puntos += 4
    notas.push(`${evaluacion.horasLaboralesDiarias} h laborales diarias`)
  } else if (evaluacion.horasLaboralesDiarias > 8) {
    puntos += 2
    notas.push(`${evaluacion.horasLaboralesDiarias} h laborales diarias`)
  }

  const tieneFuncionSecundaria = evaluacion.funcionSecundaria.trim().length > 0
  const tieneCargoAdicional = evaluacion.cargoAdicional.trim().length > 0
  if (tieneCargoAdicional) {
    puntos += 3
    notas.push('cargo adicional asignado')
  }
  if (tieneFuncionSecundaria) {
    puntos += 2
    notas.push('función secundaria asignada')
  }

  const desgaste = clamp(evaluacion.desgastePercibido, 1, 5)
  if (desgaste >= 3) {
    puntos += (desgaste - 2) * 2
    const etiqueta = opcionesCargoDesgastante.find(
      (opcion) => opcion.valor === evaluacion.cargoMasDesgastante,
    )?.texto
    notas.push(`desgaste percibido ${desgaste}/5 (${(etiqueta ?? '').toLowerCase()})`)
  }

  if (!evaluacion.tieneRelevo) {
    puntos += 3
    notas.push('sin personal de relevo disponible')
  }

  if (!evaluacion.recibeIncentivos) {
    puntos += 2
    notas.push('sin incentivos ni compensación por la sobrecarga')
  }

  if (evaluacion.diasLibresMes < 4) {
    puntos += 3
    notas.push(`${evaluacion.diasLibresMes} días libres al mes`)
  } else if (evaluacion.diasLibresMes < 8) {
    puntos += 1
    notas.push(`${evaluacion.diasLibresMes} días libres al mes`)
  }

  if (evaluacion.intencionDejarCargo === 'decidido') {
    puntos += 4
    notas.push('decisión tomada de dejar el cargo')
  } else if (evaluacion.intencionDejarCargo === 'frecuente') {
    puntos += 3
    notas.push('piensa con frecuencia en dejar el cargo')
  } else if (evaluacion.intencionDejarCargo === 'ocasional') {
    puntos += 1
    notas.push('ha pensado ocasionalmente en dejar el cargo')
  }

  return {
    factor: 'Carga institucional y desgaste laboral',
    puntos: clamp(puntos, 0, 24),
    maximo: 24,
    detalle: notas.length > 0 ? notas.join(', ') : 'carga laboral dentro de lo previsto',
  }
}

function nivelDesdePuntaje(puntaje: number, umbrales: Umbrales): NivelRiesgo {
  if (puntaje >= umbrales.critico) return 'critico'
  if (puntaje >= umbrales.alto) return 'alto'
  if (puntaje >= umbrales.moderado) return 'moderado'
  return 'bajo'
}

const ordenNivel: NivelRiesgo[] = ['bajo', 'moderado', 'alto', 'critico']

function elevarNivel(actual: NivelRiesgo, minimo: NivelRiesgo): NivelRiesgo {
  return ordenNivel.indexOf(minimo) > ordenNivel.indexOf(actual) ? minimo : actual
}

const aptitudPorNivel: Record<NivelRiesgo, string> = {
  bajo: 'Apto para el vuelo. Mantener las medidas preventivas habituales.',
  moderado: 'Apto con mitigación. Aplicar las contramedidas antes y durante el vuelo.',
  alto: 'Apto condicionado. Requiere revisión con el supervisor de operaciones y mitigaciones obligatorias.',
  critico:
    'No recomendado para el vuelo. Reportar al médico de aviación y al jefe de operaciones antes de asignar misión.',
}

function construirEstrategias(
  evaluacion: Evaluacion,
  nivel: NivelRiesgo,
  epworth: number,
  imc: number | null,
): Estrategia[] {
  const estrategias: Estrategia[] = []

  if (nivel === 'critico') {
    estrategias.push({
      titulo: 'Suspender la asignación de vuelo y declarar fatiga',
      descripcion:
        'Informar al jefe de operaciones mediante el reporte de fatiga y solicitar relevo. Priorizar un período de recuperación de al menos dos noches completas de sueño (8-9 h) antes de reincorporarse.',
      horizonte: 'inmediato',
      prioridad: 'alta',
    })
  }

  if (nivel === 'alto' || nivel === 'critico') {
    estrategias.push({
      titulo: 'Reforzar la tripulación o reasignar tareas críticas',
      descripcion:
        'Solicitar tripulación aumentada, asignar los despegues y aterrizajes al piloto menos fatigado y reforzar la lectura cruzada de listas de verificación.',
      horizonte: 'previo_vuelo',
      prioridad: 'alta',
    })
  }

  if (evaluacion.horasSuenoUltimas24 < 6) {
    estrategias.push({
      titulo: 'Siesta de recuperación antes del servicio',
      descripcion:
        'Dormir 90-120 min (ciclo completo) si hay tiempo disponible; si no, una siesta corta de 20-30 min. Prever 15-20 min de inercia del sueño antes de retomar tareas críticas.',
      horizonte: 'previo_vuelo',
      prioridad: 'alta',
    })
  }

  if (evaluacion.horasSuenoUltimas72 < 18) {
    estrategias.push({
      titulo: 'Plan de recuperación de la deuda de sueño',
      descripcion:
        'Programar dos noches consecutivas de sueño de recuperación sin alarma y evitar servicios de inicio temprano hasta normalizar el promedio de 7-8 h por noche.',
      horizonte: 'post_vuelo',
      prioridad: 'alta',
    })
  }

  if (evaluacion.horasDespierto > 16 || evaluacion.kss >= 7) {
    estrategias.push({
      titulo: 'Cafeína estratégica',
      descripcion:
        '100-200 mg de cafeína (1-2 tazas de café) 30 min antes de la fase de mayor demanda. Evitar su consumo en las 6 h previas al descanso planificado y no usarla para sustituir el sueño.',
      horizonte: 'inmediato',
      prioridad: 'media',
    })
  }

  if (evaluacion.vueloNocturno) {
    estrategias.push({
      titulo: 'Manejo de la ventana de baja circadiana (02:00-06:00)',
      descripcion:
        'Aumentar la iluminación de cabina dentro de los límites operacionales, alternar controles cada 30-45 min, mantener hidratación y programar ingestas ligeras; extremar la vigilancia en aproximaciones nocturnas.',
      horizonte: 'inmediato',
      prioridad: 'alta',
    })
  }

  if (evaluacion.duracionServicio > 12 || evaluacion.sectores >= 4) {
    estrategias.push({
      titulo: 'Pausas activas y rotación de tareas en vuelo',
      descripcion:
        'Realizar pausas de 5 min cada hora (estiramientos, movilidad en cabina cuando sea seguro), rotar la función de piloto al mando de la maniobra y verbalizar las listas de verificación para sostener la atención.',
      horizonte: 'inmediato',
      prioridad: 'media',
    })
  }

  if (evaluacion.husosHorarios >= 3) {
    estrategias.push({
      titulo: 'Reajuste circadiano tras cruce de husos',
      descripcion:
        'Exponerse a luz natural en la mañana del destino, alinear comidas con el horario local y evitar siestas largas después de las 16:00 locales. Considerar melatonina bajo prescripción del médico de aviación.',
      horizonte: 'post_vuelo',
      prioridad: 'media',
    })
  }

  if (evaluacion.calidadSueno <= 3) {
    estrategias.push({
      titulo: 'Higiene del sueño en alojamiento militar',
      descripcion:
        'Cuarto oscuro (antifaz), temperatura 18-21 °C, tapones auditivos, sin pantallas 60 min antes de dormir, sin alcohol y sin ejercicio intenso en las 3 h previas al descanso.',
      horizonte: 'post_vuelo',
      prioridad: 'media',
    })
  }

  if (epworth >= 11) {
    estrategias.push({
      titulo: 'Evaluación médica de somnolencia diurna',
      descripcion:
        'Epworth elevado sugiere trastorno del sueño subyacente (apnea, insomnio crónico). Derivar al servicio de medicina aeroespacial para tamizaje y, si procede, poligrafía respiratoria.',
      horizonte: 'organizacional',
      prioridad: 'alta',
    })
  }

  if (evaluacion.antecedentes.includes('apnea') || (imc !== null && imc >= 30)) {
    estrategias.push({
      titulo: 'Tamizaje de apnea del sueño y control de peso',
      descripcion:
        'La obesidad y el ronquido con pausas respiratorias multiplican el riesgo de somnolencia residual. Solicitar valoración en medicina aeroespacial y un plan de acondicionamiento físico y nutricional supervisado.',
      horizonte: 'organizacional',
      prioridad: 'alta',
    })
  }

  if (evaluacion.antecedentes.includes('ansiedad_depresion') || evaluacion.intencionDejarCargo !== 'no') {
    estrategias.push({
      titulo: 'Apoyo psicológico y entrevista de retención',
      descripcion:
        'Coordinar atención con salud mental de la unidad y una entrevista confidencial con el comando para revisar carga, expectativas y permanencia. El desgaste emocional degrada la atención sostenida tanto como la privación de sueño.',
      horizonte: 'organizacional',
      prioridad: 'alta',
    })
  }

  if (evaluacion.horasLaboralesDiarias > 8) {
    estrategias.push({
      titulo: 'Limitar la jornada administrativa alrededor del vuelo',
      descripcion:
        `Jornada declarada de ${evaluacion.horasLaboralesDiarias} h. Proteger un bloque libre de tareas administrativas antes y después del servicio de vuelo, y trasladar reuniones no críticas fuera de los días de misión.`,
      horizonte: 'organizacional',
      prioridad: 'alta',
    })
  }

  if (evaluacion.cargoAdicional.trim() || evaluacion.funcionSecundaria.trim()) {
    estrategias.push({
      titulo: 'Redistribuir funciones acumuladas',
      descripcion:
        'Documentar ante el comando la acumulación de cargos y proponer una matriz de delegación: identificar las tareas del cargo percibido como más desgastante que puedan transferirse o suspenderse mientras dure el período de vuelo intenso.',
      horizonte: 'organizacional',
      prioridad: 'alta',
    })
  }

  if (!evaluacion.tieneRelevo) {
    estrategias.push({
      titulo: 'Plan de relevo y formación de reemplazos',
      descripcion:
        'La ausencia de relevo convierte la fatiga en un riesgo sistémico. Proponer al comando la designación de un segundo responsable en formación para el cargo crítico y un calendario de traspaso de competencias.',
      horizonte: 'organizacional',
      prioridad: 'alta',
    })
  }

  if (!evaluacion.recibeIncentivos) {
    estrategias.push({
      titulo: 'Revisar incentivos y compensación de la sobrecarga',
      descripcion:
        'Registrar horas y funciones adicionales para sustentar compensaciones: días de descanso compensatorio, reconocimiento formal en la hoja de vida o rotación preferente en la siguiente programación.',
      horizonte: 'organizacional',
      prioridad: 'media',
    })
  }

  if (evaluacion.diasLibresMes < 8) {
    estrategias.push({
      titulo: 'Garantizar días libres y descanso protegido',
      descripcion:
        `Solo ${evaluacion.diasLibresMes} días libres en el mes. Asegurar al menos dos períodos de 48 h continuas sin llamado al mes; el descanso fraccionado no revierte la deuda de sueño acumulada.`,
      horizonte: 'organizacional',
      prioridad: 'alta',
    })
  }

  if (evaluacion.diasConsecutivos >= 4) {
    estrategias.push({
      titulo: 'Revisión de la programación de tripulaciones',
      descripcion:
        'Intercalar un día libre tras la serie de vuelos consecutivos y evitar transiciones rápidas de turno nocturno a diurno en la siguiente programación.',
      horizonte: 'organizacional',
      prioridad: 'media',
    })
  }

  estrategias.push({
    titulo: 'Registro y reporte de fatiga',
    descripcion:
      'Documentar esta evaluación en el sistema de gestión de riesgos de fatiga (FRMS) de la unidad. Los reportes agregados permiten sustentar ante el comando la necesidad de personal, ajustar la programación y detectar tendencias en el escuadrón.',
    horizonte: 'organizacional',
    prioridad: 'baja',
  })

  return estrategias
}

export function evaluarFatiga(
  evaluacion: Evaluacion,
  umbrales: Umbrales = ajustesPorDefecto.umbrales,
): Resultado {
  const epworth = totalEpworth(evaluacion.epworth)
  const edad = calcularEdad(evaluacion.fechaNacimiento)
  const imc = calcularImc(evaluacion.pesoKg, evaluacion.tallaCm)

  const contribuyentes: Contribuyente[] = [
    puntosSueno24(evaluacion.horasSuenoUltimas24),
    puntosSueno72(evaluacion.horasSuenoUltimas72),
    puntosVigilia(evaluacion.horasDespierto),
    puntosCalidad(evaluacion.calidadSueno),
    puntosKss(evaluacion.kss),
    puntosSamnPerelli(evaluacion.samnPerelli),
    puntosEpworth(epworth),
    puntosCargaOperacional(evaluacion),
    puntosPerfilSalud(evaluacion, edad, imc),
    puntosCargaInstitucional(evaluacion),
  ]

  const bruto = contribuyentes.reduce((suma, contribuyente) => suma + contribuyente.puntos, 0)
  const total = contribuyentes.reduce((suma, contribuyente) => suma + contribuyente.maximo, 0)
  const puntaje = Math.round(clamp((bruto / total) * 100, 0, 100))

  let nivel = nivelDesdePuntaje(puntaje, umbrales)
  if (evaluacion.kss >= 8 || evaluacion.samnPerelli >= 6 || evaluacion.horasSuenoUltimas24 < 4) {
    nivel = elevarNivel(nivel, 'alto')
  }
  if (evaluacion.horasLaboralesDiarias > 12 && !evaluacion.tieneRelevo) {
    nivel = elevarNivel(nivel, 'alto')
  }
  if (evaluacion.kss === 9 && evaluacion.samnPerelli === 7) {
    nivel = elevarNivel(nivel, 'critico')
  }

  return {
    puntaje,
    nivel,
    contribuyentes: [...contribuyentes].sort((a, b) => b.puntos - a.puntos),
    epworthTotal: epworth,
    edad,
    imc,
    aptitud: aptitudPorNivel[nivel],
    estrategias: construirEstrategias(evaluacion, nivel, epworth, imc),
  }
}
