// Mide los tiempos de respuesta del panel poblacional con la población cargada en la base.

const base = process.env.API_BASE ?? 'http://localhost:3001'
const correoAdmin = process.env.CORREO_ADMIN ?? 'admin.prueba@demo.plataformasi.mil.ec'

async function entrar() {
  const solicitud = await fetch(`${base}/api/acceso/codigo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: correoAdmin, modo: 'admin' }),
  }).then((respuesta) => respuesta.json())
  const verificacion = await fetch(`${base}/api/acceso/verificar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: correoAdmin, codigo: solicitud.codigo, modo: 'admin' }),
  }).then((respuesta) => respuesta.json())
  return verificacion.token
}

async function medir(nombre, ruta, token) {
  const tiempos = []
  let tamano = 0
  for (let intento = 0; intento < 5; intento += 1) {
    const inicio = performance.now()
    const respuesta = await fetch(`${base}${ruta}`, { headers: { Authorization: `Bearer ${token}` } })
    const texto = await respuesta.text()
    tiempos.push(performance.now() - inicio)
    tamano = texto.length
  }
  const mediana = tiempos.sort((a, b) => a - b)[2]
  console.log(`${nombre.padEnd(42)} ${Math.round(mediana)} ms  (${Math.round(tamano / 1024)} KB)`)
}

const token = await entrar()
await medir('Resumen poblacional', '/api/admin/panel/resumen', token)
await medir('Listado página 1 (25)', '/api/admin/panel/personas?pagina=1&tam=25', token)
await medir('Listado página 20 (25)', '/api/admin/panel/personas?pagina=20&tam=25', token)
await medir('Listado filtrado por nivel alto', '/api/admin/panel/personas?nivel=alto&tam=25', token)
await medir('Búsqueda por nombre', '/api/admin/panel/personas?busqueda=sintetico%20500', token)
await medir('Catálogo de filtros', '/api/admin/panel/filtros', token)
await medir('Alertas abiertas', '/api/admin/alertas', token)
await medir('Aplicaciones página 1 (25)', '/api/admin/respuestas?pagina=1&tam=25', token)
await medir('Aplicaciones finalizadas (25)', '/api/admin/respuestas?pagina=1&tam=25&estado=finalizada', token)
