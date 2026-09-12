// Pruebas del borrado institucional de datos del personal evaluado
// (POST /api/admin/datos/reiniciar). Se ejecutan contra la API levantada en API_BASE.

const base = process.env.API_BASE ?? 'http://localhost:3001'
const correoEvaluado = process.env.CORREO_EVALUADO ?? 'evaluado.prueba@demo.plataformasi.mil.ec'
const correoAdmin = process.env.CORREO_ADMIN ?? 'admin.prueba@demo.plataformasi.mil.ec'

let fallos = 0
function comprobar(nombre, condicion, detalle = '') {
  if (condicion) {
    console.log(`  ok   ${nombre}`)
  } else {
    fallos += 1
    console.log(`  FALLA ${nombre} ${detalle}`)
  }
}

async function pedir(ruta, opciones = {}, token = null) {
  const respuesta = await fetch(`${base}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.headers ?? {}),
    },
  })
  const texto = await respuesta.text()
  let cuerpo = null
  try {
    cuerpo = texto ? JSON.parse(texto) : null
  } catch {
    cuerpo = texto
  }
  return { estado: respuesta.status, cuerpo }
}

async function entrar(correo, modo) {
  const solicitud = await pedir('/api/acceso/codigo', {
    method: 'POST',
    body: JSON.stringify({ correo, modo }),
  })
  const codigo = solicitud.cuerpo?.codigo
  if (!codigo) throw new Error(`No se obtuvo código para ${correo}`)
  const verificacion = await pedir('/api/acceso/verificar', {
    method: 'POST',
    body: JSON.stringify({ correo, codigo, modo, nombre: 'Prueba Borrado' }),
  })
  if (!verificacion.cuerpo?.token) throw new Error(`No se obtuvo token para ${correo}`)
  return { token: verificacion.cuerpo.token, usuario: verificacion.cuerpo.usuario }
}

async function main() {
  console.log('\n1. Datos previos')
  const evaluado = await entrar(correoEvaluado, 'evaluado')
  const admin = await entrar(correoAdmin, 'admin')

  await pedir(
    '/api/checkins',
    {
      method: 'POST',
      body: JSON.stringify({
        fecha: new Date().toISOString().slice(0, 10),
        horasSueno: 6,
        horasDespierto: 8,
        kss: 4,
        samnPerelli: 3,
        vueloProgramado: true,
        vueloNocturno: false,
        notas: '',
        puntaje: 30,
        nivel: 'moderado',
      }),
    },
    evaluado.token,
  )
  const instrumentosPrevios = (await pedir('/api/admin/instrumentos', {}, admin.token)).cuerpo
  comprobar('hay instrumentos configurados antes de borrar', (instrumentosPrevios?.length ?? 0) > 0)

  console.log('\n2. Autorización del endpoint')
  const sinToken = await pedir('/api/admin/datos/reiniciar', {
    method: 'POST',
    body: JSON.stringify({ confirmacion: 'BORRAR DATOS' }),
  })
  comprobar('sin token responde 401', sinToken.estado === 401, String(sinToken.estado))

  const comoEvaluado = await pedir(
    '/api/admin/datos/reiniciar',
    { method: 'POST', body: JSON.stringify({ confirmacion: 'BORRAR DATOS' }) },
    evaluado.token,
  )
  comprobar('un evaluado recibe 403', comoEvaluado.estado === 403, String(comoEvaluado.estado))

  const sinConfirmar = await pedir(
    '/api/admin/datos/reiniciar',
    { method: 'POST', body: JSON.stringify({ confirmacion: 'borrar' }) },
    admin.token,
  )
  comprobar('confirmación inválida responde 400', sinConfirmar.estado === 400, String(sinConfirmar.estado))

  console.log('\n3. Borrado focalizado')
  const borrado = await pedir(
    '/api/admin/datos/reiniciar',
    { method: 'POST', body: JSON.stringify({ confirmacion: 'BORRAR DATOS' }) },
    admin.token,
  )
  comprobar('el administrador puede borrar', borrado.estado === 200, JSON.stringify(borrado.cuerpo))
  comprobar('informa cuántos evaluados se eliminaron', (borrado.cuerpo?.evaluados ?? 0) >= 1)

  console.log('\n4. Estado posterior')
  const resumen = await pedir('/api/admin/resumen', {}, admin.token)
  comprobar(
    'no quedan evaluados registrados',
    (resumen.cuerpo?.totales?.evaluados ?? resumen.cuerpo?.totales?.personas ?? 0) === 0,
    JSON.stringify(resumen.cuerpo?.totales),
  )

  const sesionAdmin = await pedir('/api/sesion', {}, admin.token)
  comprobar(
    'la sesión del administrador sigue activa',
    sesionAdmin.estado === 200 && sesionAdmin.cuerpo?.rol === 'admin',
    String(sesionAdmin.estado),
  )

  const instrumentosPosteriores = (await pedir('/api/admin/instrumentos', {}, admin.token)).cuerpo
  comprobar(
    'los instrumentos se conservan',
    (instrumentosPosteriores?.length ?? 0) === (instrumentosPrevios?.length ?? -1),
  )

  const auditoria = (await pedir('/api/auditoria', {}, admin.token)).cuerpo
  comprobar(
    'la operación queda registrada en auditoría',
    Array.isArray(auditoria) && auditoria.some((item) => item.accion === 'reinicio_datos_evaluados'),
  )

  console.log(fallos === 0 ? '\nTODAS LAS PRUEBAS PASARON' : `\n${fallos} PRUEBAS FALLARON`)
  process.exit(fallos === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
