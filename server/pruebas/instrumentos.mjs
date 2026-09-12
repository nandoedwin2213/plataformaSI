// Pruebas de extremo a extremo de los instrumentos independientes, el motor integrado de
// riesgo y el panel poblacional. Se ejecutan contra la API levantada en API_BASE.

const base = process.env.API_BASE ?? 'http://localhost:3001'
const correoEvaluado = process.env.CORREO_EVALUADO ?? 'evaluado.prueba@demo.plataformasi.mil.ec'
const correoOtro = process.env.CORREO_OTRO ?? 'otro.evaluado@demo.plataformasi.mil.ec'
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
  if (!codigo) throw new Error(`No se obtuvo código para ${correo}: ${JSON.stringify(solicitud.cuerpo)}`)
  const verificacion = await pedir('/api/acceso/verificar', {
    method: 'POST',
    body: JSON.stringify({ correo, codigo, modo, nombre: 'Prueba Sintética' }),
  })
  if (!verificacion.cuerpo?.token) {
    throw new Error(`No se obtuvo token para ${correo}: ${JSON.stringify(verificacion.cuerpo)}`)
  }
  return { token: verificacion.cuerpo.token, usuario: verificacion.cuerpo.usuario }
}

function respuestasPara(instrumento, elegir) {
  const salida = {}
  for (const pregunta of instrumento.preguntas) {
    salida[pregunta.id] = elegir(pregunta)
  }
  return salida
}

const ultimaOpcion = (pregunta) => pregunta.opciones[pregunta.opciones.length - 1].texto

async function main() {
  console.log('\n1. Acceso e instrumentos independientes')
  const evaluado = await entrar(correoEvaluado, 'evaluado')
  const instrumentos = (await pedir('/api/instrumentos', {}, evaluado.token)).cuerpo
  const claves = instrumentos.map((item) => item.clave)
  for (const clave of ['kss', 'samn_perelli', 'epworth', 'nasa_tlx']) {
    comprobar(`instrumento ${clave} disponible`, claves.includes(clave))
  }
  comprobar(
    'cada instrumento tiene su propio dominio',
    new Set(
      instrumentos.filter((i) => i.tipo === 'estandarizado').map((i) => i.dominio),
    ).size === 4,
  )
  comprobar(
    'frecuencias propias (KSS diario, Epworth trimestral)',
    instrumentos.find((i) => i.clave === 'kss').frecuenciaDias === 1 &&
      instrumentos.find((i) => i.clave === 'epworth').frecuenciaDias === 90,
  )
  comprobar(
    'las preguntas no se mezclan entre instrumentos',
    instrumentos.find((i) => i.clave === 'kss').preguntas.length === 1 &&
      instrumentos.find((i) => i.clave === 'epworth').preguntas.length === 8 &&
      instrumentos.find((i) => i.clave === 'nasa_tlx').preguntas.length === 6,
  )

  console.log('\n2. Puntaje e interpretación por instrumento')
  const kss = instrumentos.find((i) => i.clave === 'kss')
  const borrador = await pedir(
    `/api/instrumentos/${kss.id}/respuesta`,
    {
      method: 'PUT',
      body: JSON.stringify({ respuestas: respuestasPara(kss, ultimaOpcion), finalizar: false }),
    },
    evaluado.token,
  )
  comprobar('guarda borrador sin puntaje', borrador.cuerpo?.estado === 'borrador' && borrador.cuerpo.puntaje === null)

  const kssFinal = await pedir(
    `/api/instrumentos/${kss.id}/respuesta`,
    {
      method: 'PUT',
      body: JSON.stringify({ respuestas: respuestasPara(kss, ultimaOpcion), finalizar: true }),
    },
    evaluado.token,
  )
  comprobar('KSS puntúa 9 en su escala original', kssFinal.cuerpo?.puntaje === 9, JSON.stringify(kssFinal.cuerpo))
  comprobar('KSS interpreta el resultado', String(kssFinal.cuerpo?.interpretacion).length > 10)
  comprobar('KSS dispara nivel crítico por regla dura', kssFinal.cuerpo?.riesgo?.nivel === 'critico')

  const sp = instrumentos.find((i) => i.clave === 'samn_perelli')
  const spFinal = await pedir(
    `/api/instrumentos/${sp.id}/respuesta`,
    { method: 'PUT', body: JSON.stringify({ respuestas: respuestasPara(sp, ultimaOpcion), finalizar: true }) },
    evaluado.token,
  )
  comprobar('Samn-Perelli puntúa 7 en su escala original', spFinal.cuerpo?.puntaje === 7)

  const epworth = instrumentos.find((i) => i.clave === 'epworth')
  const epFinal = await pedir(
    `/api/instrumentos/${epworth.id}/respuesta`,
    {
      method: 'PUT',
      body: JSON.stringify({ respuestas: respuestasPara(epworth, ultimaOpcion), finalizar: true }),
    },
    evaluado.token,
  )
  comprobar('Epworth suma 24 (8 x 3)', epFinal.cuerpo?.puntaje === 24, JSON.stringify(epFinal.cuerpo?.puntaje))

  const tlx = instrumentos.find((i) => i.clave === 'nasa_tlx')
  const tlxFinal = await pedir(
    `/api/instrumentos/${tlx.id}/respuesta`,
    {
      method: 'PUT',
      body: JSON.stringify({
        respuestas: respuestasPara(tlx, () => 80),
        finalizar: true,
      }),
    },
    evaluado.token,
  )
  comprobar('NASA-TLX (RTLX) promedia 80', tlxFinal.cuerpo?.puntaje === 80, JSON.stringify(tlxFinal.cuerpo?.puntaje))

  console.log('\n3. Aplicaciones repetidas e historial propio')
  const repetida = await pedir(
    `/api/instrumentos/${kss.id}/respuesta`,
    {
      method: 'PUT',
      body: JSON.stringify({ respuestas: respuestasPara(kss, (p) => p.opciones[0].texto), finalizar: true }),
    },
    evaluado.token,
  )
  comprobar('permite una nueva aplicación del mismo instrumento', repetida.estado === 200)
  const historial = await pedir(`/api/instrumentos/${kss.id}/historial`, {}, evaluado.token)
  comprobar('el historial conserva las dos aplicaciones', historial.cuerpo.length >= 2)
  comprobar(
    'cada aplicación conserva su fecha y versión',
    historial.cuerpo.every((item) => item.finalizadoEn && item.instrumentoVersion >= 1),
  )

  console.log('\n4. Resultado integrado explicable')
  const riesgo = (await pedir('/api/mi-riesgo', {}, evaluado.token)).cuerpo
  comprobar('devuelve índice integrado', typeof riesgo.resultado?.puntaje === 'number')
  comprobar('registra la versión del modelo', riesgo.resultado?.versionModelo >= 1)
  comprobar('explica con componentes por dominio', riesgo.explicacion.length >= 3)
  comprobar('reporta cobertura y confianza', typeof riesgo.resultado.cobertura === 'number' && riesgo.resultado.confianza)
  comprobar('propone estrategias de mitigación', riesgo.estrategias.length > 0)
  comprobar(
    'las estrategias quedan marcadas como pendientes de validación',
    riesgo.estrategias.every((item) => item.requiereValidacion),
  )
  console.log('    explicación:', riesgo.explicacion.slice(0, 3).map((item) => item.texto ?? item).join(' | '))

  console.log('\n5. Aislamiento entre evaluados y bloqueo de rutas administrativas')
  const otro = await entrar(correoOtro, 'evaluado')
  const historialAjeno = await pedir(`/api/instrumentos/${kss.id}/historial`, {}, otro.token)
  comprobar(
    'otro evaluado no ve el historial ajeno',
    historialAjeno.cuerpo.every((item) => item.usuarioId === otro.usuario.id),
  )
  const panelDenegado = await pedir('/api/admin/panel/resumen', {}, evaluado.token)
  comprobar('evaluado no accede al panel poblacional (403)', panelDenegado.estado === 403)
  const personasDenegado = await pedir(`/api/admin/panel/personas/${otro.usuario.id}`, {}, evaluado.token)
  comprobar('evaluado no accede a la ficha de otro (403)', personasDenegado.estado === 403)
  const modeloDenegado = await pedir(
    '/api/admin/modelo',
    { method: 'POST', body: JSON.stringify({ definicion: {} }) },
    evaluado.token,
  )
  comprobar('evaluado no puede versionar el modelo (403)', modeloDenegado.estado === 403)

  console.log('\n6. Panel del administrador')
  const admin = await entrar(correoAdmin, 'admin')
  const instrumentosAdmin = await pedir('/api/instrumentos', {}, admin.token)
  comprobar('el administrador no responde instrumentos (403)', instrumentosAdmin.estado === 403)
  const resumen = (await pedir('/api/admin/panel/resumen', {}, admin.token)).cuerpo
  comprobar('resumen con distribución de riesgo', typeof resumen.distribucion?.critico === 'number')
  comprobar('resumen con adherencia', typeof resumen.adherencia7d === 'number')
  comprobar('resumen por instrumento', resumen.instrumentos.length === 4)
  const listado = (await pedir('/api/admin/panel/personas?pagina=1&tam=10', {}, admin.token)).cuerpo
  comprobar('listado paginado en servidor', listado.personas.length <= 10 && listado.total >= 1)
  const filtrado = (await pedir('/api/admin/panel/personas?nivel=critico', {}, admin.token)).cuerpo
  comprobar('filtro por nivel', filtrado.personas.every((p) => p.nivel === 'critico'))
  const detalle = (await pedir(`/api/admin/panel/personas/${evaluado.usuario.id}`, {}, admin.token)).cuerpo
  comprobar('detalle individual con aplicaciones por instrumento', detalle.aplicaciones.length >= 4)
  comprobar('detalle individual con explicación', detalle.explicacion.length >= 3)
  const alertas = (await pedir('/api/admin/alertas', {}, admin.token)).cuerpo
  comprobar('alertas abiertas generadas por reglas', alertas.length >= 1, JSON.stringify(alertas.slice(0, 1)))

  console.log('\n7. Configuración administrable y versionado')
  const preguntaKss = kss.preguntas[0]
  const edicionProtegida = await pedir(
    `/api/admin/preguntas/${preguntaKss.id}`,
    { method: 'PUT', body: JSON.stringify({ texto: 'Pregunta alterada' }) },
    admin.token,
  )
  comprobar('las preguntas estandarizadas no son editables (400)', edicionProtegida.estado === 400)
  const frecuencia = await pedir(
    `/api/admin/instrumentos/${kss.id}`,
    { method: 'PUT', body: JSON.stringify({ frecuenciaDias: 2, activo: true }) },
    admin.token,
  )
  comprobar('la frecuencia sí es administrable', frecuencia.cuerpo?.frecuenciaDias === 2)
  await pedir(
    `/api/admin/instrumentos/${kss.id}`,
    { method: 'PUT', body: JSON.stringify({ frecuenciaDias: 1, activo: true }) },
    admin.token,
  )

  const modelos = (await pedir('/api/admin/modelo', {}, admin.token)).cuerpo
  const definicion = modelos[0].definicion
  const invalido = await pedir(
    '/api/admin/modelo',
    { method: 'POST', body: JSON.stringify({ definicion: { ...definicion, pesos: { a: 0.5 } } }) },
    admin.token,
  )
  comprobar('rechaza pesos que no suman 1 (400)', invalido.estado === 400)
  const nuevaVersion = await pedir(
    '/api/admin/modelo',
    {
      method: 'POST',
      body: JSON.stringify({
        definicion,
        nombre: 'Modelo integrado v2 (prueba)',
        nota: 'Versión de prueba sintética',
      }),
    },
    admin.token,
  )
  comprobar('crea una versión nueva del modelo', nuevaVersion.estado === 201 && nuevaVersion.cuerpo.version >= 2)
  await pedir(`/api/admin/modelo/1/activar`, { method: 'PUT' }, admin.token)

  const reglas = (await pedir('/api/admin/reglas-alerta', {}, admin.token)).cuerpo
  const cambio = await pedir(
    `/api/admin/reglas-alerta/${reglas[0].id}`,
    { method: 'PUT', body: JSON.stringify({ severidad: 'media', activa: true }) },
    admin.token,
  )
  comprobar('las reglas de alerta son configurables', cambio.cuerpo?.severidad === 'media')
  await pedir(
    `/api/admin/reglas-alerta/${reglas[0].id}`,
    { method: 'PUT', body: JSON.stringify({ severidad: reglas[0].severidad, activa: reglas[0].activa }) },
    admin.token,
  )

  const estrategia = await pedir(
    '/api/admin/estrategias',
    {
      method: 'POST',
      body: JSON.stringify({ titulo: 'Estrategia de prueba', nivelObjetivo: 'moderado', acciones: 'Prueba' }),
    },
    admin.token,
  )
  comprobar('crea estrategias de mitigación', estrategia.estado === 201)
  const borrado = await pedir(
    `/api/admin/estrategias/${estrategia.cuerpo.id}`,
    { method: 'DELETE' },
    admin.token,
  )
  comprobar('elimina estrategias', borrado.estado === 204)

  console.log(`\n${fallos === 0 ? 'TODAS LAS PRUEBAS PASARON' : `${fallos} PRUEBAS FALLARON`}`)
  process.exit(fallos === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
