// El servidor corre en UTC, pero los check-ins se registran con la fecha calendario
// local del evaluado. Se usa la zona horaria institucional para que ambas coincidan.
export const zonaHoraria = process.env.ZONA_HORARIA || 'America/Guayaquil'

const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: zonaHoraria,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function fechaInstitucional(fecha = new Date()) {
  return formato.format(fecha)
}
