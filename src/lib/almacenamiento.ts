import type { RegistroHistorial } from '../domain/types'

const CLAVE = 'fae-fatiga-historial-v1'

export function leerHistorial(): RegistroHistorial[] {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return []
    const datos = JSON.parse(crudo) as RegistroHistorial[]
    return Array.isArray(datos) ? datos : []
  } catch {
    return []
  }
}

export function guardarHistorial(registros: RegistroHistorial[]): void {
  localStorage.setItem(CLAVE, JSON.stringify(registros))
}

export function descargarArchivo(nombre: string, contenido: string, tipo: string): void {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}

export function historialACsv(registros: RegistroHistorial[]): string {
  const encabezados = [
    'fecha_registro',
    'grado',
    'piloto',
    'unidad',
    'edad',
    'peso_kg',
    'talla_cm',
    'imc',
    'antecedentes',
    'funcion_principal',
    'funcion_secundaria',
    'cargo_principal',
    'cargo_adicional',
    'cargo_mas_desgastante',
    'desgaste_percibido',
    'horas_laborales_diarias',
    'dias_libres_mes',
    'tiene_relevo',
    'recibe_incentivos',
    'intencion_dejar_cargo',
    'tipo_mision',
    'fecha_vuelo',
    'sueno_24h',
    'sueno_72h',
    'horas_despierto',
    'calidad_sueno',
    'duracion_servicio',
    'sectores',
    'vuelo_nocturno',
    'husos_horarios',
    'dias_consecutivos',
    'kss',
    'samn_perelli',
    'epworth_total',
    'puntaje_riesgo',
    'nivel_riesgo',
  ]

  const filas = registros.map((registro) => {
    const { evaluacion: e, resultado: r } = registro
    return [
      registro.creadoEn,
      e.grado,
      e.piloto,
      e.unidad,
      r.edad ?? '',
      e.pesoKg,
      e.tallaCm,
      r.imc ?? '',
      [...e.antecedentes, e.antecedentesOtros].filter(Boolean).join(' | '),
      e.funcionPrincipal,
      e.funcionSecundaria,
      e.cargoPrincipal,
      e.cargoAdicional,
      e.cargoMasDesgastante,
      e.desgastePercibido,
      e.horasLaboralesDiarias,
      e.diasLibresMes,
      e.tieneRelevo ? 'si' : 'no',
      e.recibeIncentivos ? 'si' : 'no',
      e.intencionDejarCargo,
      e.tipoMision,
      e.fecha,
      e.horasSuenoUltimas24,
      e.horasSuenoUltimas72,
      e.horasDespierto,
      e.calidadSueno,
      e.duracionServicio,
      e.sectores,
      e.vueloNocturno ? 'si' : 'no',
      e.husosHorarios,
      e.diasConsecutivos,
      e.kss,
      e.samnPerelli,
      r.epworthTotal,
      r.puntaje,
      r.nivel,
    ]
      .map((valor) => `"${String(valor).replace(/"/g, '""')}"`)
      .join(',')
  })

  return [encabezados.join(','), ...filas].join('\n')
}
