// Periodicidad orientativa de los registros del evaluado. La evaluación completa no se bloquea:
// el plazo es una recomendación de seguimiento y puede repetirse antes si cambia la operación.
export const DIAS_EVALUACION_COMPLETA = 7

const MS_DIA = 24 * 60 * 60 * 1000

export function diasDesde(fechaIso: string | null | undefined): number | null {
  if (!fechaIso) return null
  const fecha = new Date(fechaIso)
  if (Number.isNaN(fecha.getTime())) return null
  return Math.floor((Date.now() - fecha.getTime()) / MS_DIA)
}

// Días que faltan para la siguiente aplicación recomendada; 0 cuando ya corresponde.
export function diasRestantes(fechaIso: string | null | undefined, cadaDias: number): number {
  const transcurridos = diasDesde(fechaIso)
  if (transcurridos === null) return 0
  return Math.max(0, cadaDias - transcurridos)
}

export function textoFrecuencia(dias: number): string {
  if (dias <= 1) return 'una vez al día'
  if (dias === 7) return 'una vez por semana'
  if (dias === 30) return 'una vez al mes'
  if (dias === 90) return 'cada 3 meses'
  return `cada ${dias} días`
}

// Texto para el evaluado: cuándo le toca volver a llenar el registro.
export function textoDisponibilidad(fechaIso: string | null | undefined, cadaDias: number): string {
  if (!fechaIso) return 'Aún no la has llenado: puedes hacerlo ahora'
  const faltan = diasRestantes(fechaIso, cadaDias)
  if (faltan === 0) return 'Ya corresponde volver a llenarla'
  if (faltan === 1) return 'Disponible mañana (1 día)'
  return `Disponible en ${faltan} días`
}
