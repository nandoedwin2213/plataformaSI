// Fecha calendario del dispositivo (zona horaria local). No usar toISOString(),
// que devuelve la fecha en UTC y adelanta el día a quienes están al oeste de Greenwich.
export function fechaLocal(fecha: Date = new Date()): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}
