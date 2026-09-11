import type { NivelRiesgo } from './types'
import type { CheckIn, Umbrales } from './usuarios'

export interface DiaProyectado {
  fecha: string
  puntaje: number
  nivel: NivelRiesgo
}

export interface Proyeccion {
  dias: DiaProyectado[]
  deudaSueno: number
  pendiente: number
  confianza: 'baja' | 'media' | 'alta'
}

const SUENO_OBJETIVO = 8

export function nivelPorPuntaje(puntaje: number, umbrales: Umbrales): NivelRiesgo {
  if (puntaje >= umbrales.critico) return 'critico'
  if (puntaje >= umbrales.alto) return 'alto'
  if (puntaje >= umbrales.moderado) return 'moderado'
  return 'bajo'
}

function pendienteLineal(valores: number[]): number {
  if (valores.length < 3) return 0
  const n = valores.length
  const mediaX = (n - 1) / 2
  const mediaY = valores.reduce((suma, valor) => suma + valor, 0) / n
  let numerador = 0
  let denominador = 0
  valores.forEach((valor, indice) => {
    numerador += (indice - mediaX) * (valor - mediaY)
    denominador += (indice - mediaX) ** 2
  })
  return denominador === 0 ? 0 : numerador / denominador
}

/**
 * Proyecta el índice de fatiga de los próximos días combinando la tendencia reciente
 * de los check-ins con la deuda de sueño acumulada respecto a 8 h diarias.
 */
export function proyectarFatiga(
  checkins: CheckIn[],
  umbrales: Umbrales,
  dias = 7,
): Proyeccion | null {
  const historial = [...checkins]
    .sort((uno, otro) => uno.fecha.localeCompare(otro.fecha))
    .slice(-14)
  if (historial.length < 3) return null

  const ultimos7 = historial.slice(-7)
  const deudaSueno = Math.max(
    0,
    ultimos7.reduce((suma, checkin) => suma + (SUENO_OBJETIVO - checkin.horasSueno), 0),
  )

  const pendiente = pendienteLineal(historial.map((checkin) => checkin.puntaje))
  const base =
    historial.slice(-3).reduce((suma, checkin) => suma + checkin.puntaje, 0) /
    Math.min(3, historial.length)
  const efectoDeuda = Math.min(18, deudaSueno * 1.4)

  const proyectados: DiaProyectado[] = []
  for (let dia = 1; dia <= dias; dia += 1) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + dia)
    const puntaje = Math.max(
      0,
      Math.min(100, Math.round(base + pendiente * dia + (efectoDeuda * dia) / dias)),
    )
    proyectados.push({
      fecha: fecha.toISOString().slice(0, 10),
      puntaje,
      nivel: nivelPorPuntaje(puntaje, umbrales),
    })
  }

  const confianza = historial.length >= 10 ? 'alta' : historial.length >= 6 ? 'media' : 'baja'
  return { dias: proyectados, deudaSueno: Math.round(deudaSueno * 10) / 10, pendiente, confianza }
}
