import express from 'express'
import { autenticar, exigirAdministrador, exigirEvaluado } from './auth.js'
import { consultar, nuevoId, pool, registrarAuditoria, unaFila } from './db.js'

export const TIPOS_PREGUNTA = ['unica', 'multiple', 'escala', 'numero', 'texto']

function asincrono(manejador) {
  return (peticion, respuesta, siguiente) =>
    Promise.resolve(manejador(peticion, respuesta, siguiente)).catch(siguiente)
}

function texto(valor, maximo) {
  return typeof valor === 'string' ? valor.trim().slice(0, maximo) : ''
}

function opcionesPublicas(crudo) {
  try {
    const lista = JSON.parse(crudo ?? '[]')
    if (!Array.isArray(lista)) return []
    return lista.map((opcion) => ({
      texto: String(opcion?.texto ?? ''),
      valor: Number.isFinite(Number(opcion?.valor)) ? Number(opcion.valor) : 0,
    }))
  } catch {
    return []
  }
}

function preguntaPublica(fila) {
  return {
    id: fila.id,
    instrumentoId: fila.instrumento_id,
    texto: fila.texto,
    ayuda: fila.ayuda,
    tipo: fila.tipo,
    opciones: opcionesPublicas(fila.opciones),
    obligatoria: Boolean(fila.obligatoria),
    activa: Boolean(fila.activa),
    orden: fila.orden,
  }
}

function instrumentoPublico(fila, preguntas) {
  return {
    id: fila.id,
    clave: fila.clave,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    tipo: fila.tipo,
    activo: Boolean(fila.activo),
    orden: fila.orden,
    creadoEn: fila.creado_en,
    preguntas,
  }
}

function respuestaPublica(fila) {
  if (!fila) return null
  let respuestas = {}
  try {
    respuestas = JSON.parse(fila.respuestas ?? '{}') ?? {}
  } catch {
    respuestas = {}
  }
  return {
    id: fila.id,
    instrumentoId: fila.instrumento_id,
    usuarioId: fila.usuario_id,
    estado: fila.estado,
    respuestas,
    puntaje: fila.puntaje,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
    finalizadoEn: fila.finalizado_en,
  }
}

async function preguntasDe(instrumentoId, soloActivas) {
  const filas = await consultar(
    soloActivas
      ? 'SELECT * FROM preguntas WHERE instrumento_id = $1 AND activa ORDER BY orden, creado_en'
      : 'SELECT * FROM preguntas WHERE instrumento_id = $1 ORDER BY orden, creado_en',
    [instrumentoId],
  )
  return filas.map(preguntaPublica)
}

function normalizarRespuesta(pregunta, valor) {
  if (valor === undefined || valor === null || valor === '') return { vacia: true, valor: null }
  if (pregunta.tipo === 'texto') {
    const limpio = texto(valor, 1000)
    return { vacia: limpio === '', valor: limpio }
  }
  if (pregunta.tipo === 'multiple') {
    const lista = Array.isArray(valor) ? valor : []
    const validos = pregunta.opciones.map((opcion) => opcion.texto)
    const filtrados = lista.map((item) => String(item)).filter((item) => validos.includes(item))
    return { vacia: filtrados.length === 0, valor: filtrados }
  }
  if (pregunta.tipo === 'unica') {
    const elegido = String(valor)
    const valido = pregunta.opciones.some((opcion) => opcion.texto === elegido)
    return { vacia: !valido, valor: valido ? elegido : null }
  }
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return { vacia: true, valor: null }
  return { vacia: false, valor: numero }
}

function puntajeDe(preguntas, respuestas) {
  let total = 0
  let hayPuntaje = false
  for (const pregunta of preguntas) {
    const valor = respuestas[pregunta.id]
    if (valor === undefined || valor === null) continue
    if (pregunta.tipo === 'escala' || pregunta.tipo === 'numero') {
      total += Number(valor)
      hayPuntaje = true
    } else if (pregunta.tipo === 'unica') {
      const opcion = pregunta.opciones.find((item) => item.texto === valor)
      if (opcion) {
        total += opcion.valor
        hayPuntaje = true
      }
    } else if (pregunta.tipo === 'multiple' && Array.isArray(valor)) {
      for (const elegido of valor) {
        const opcion = pregunta.opciones.find((item) => item.texto === elegido)
        if (opcion) {
          total += opcion.valor
          hayPuntaje = true
        }
      }
    }
  }
  return hayPuntaje ? Math.round(total * 100) / 100 : null
}

export const rutasInstrumentos = express.Router()

// ---------------------------------------------------------------- evaluado

rutasInstrumentos.get(
  '/api/instrumentos',
  asincrono(autenticar),
  exigirEvaluado,
  asincrono(async (peticion, respuesta) => {
    const filas = await consultar('SELECT * FROM instrumentos WHERE activo ORDER BY orden, creado_en')
    const mias = await consultar('SELECT * FROM respuestas_instrumento WHERE usuario_id = $1', [
      peticion.usuario.id,
    ])
    const salida = []
    for (const fila of filas) {
      const preguntas = fila.tipo === 'sistema' ? [] : await preguntasDe(fila.id, true)
      salida.push({
        ...instrumentoPublico(fila, preguntas),
        miRespuesta: respuestaPublica(mias.find((item) => item.instrumento_id === fila.id)),
      })
    }
    respuesta.json(salida)
  }),
)

rutasInstrumentos.put(
  '/api/instrumentos/:id/respuesta',
  asincrono(autenticar),
  exigirEvaluado,
  asincrono(async (peticion, respuesta) => {
    const instrumento = await unaFila('SELECT * FROM instrumentos WHERE id = $1', [peticion.params.id])
    if (!instrumento || !instrumento.activo) {
      return respuesta.status(404).json({ error: 'Instrumento no disponible' })
    }
    if (instrumento.tipo === 'sistema') {
      return respuesta
        .status(400)
        .json({ error: 'Este instrumento se responde desde su propio formulario' })
    }

    const previa = await unaFila(
      'SELECT * FROM respuestas_instrumento WHERE instrumento_id = $1 AND usuario_id = $2',
      [instrumento.id, peticion.usuario.id],
    )
    if (previa?.estado === 'finalizada') {
      return respuesta.status(409).json({ error: 'Esta evaluación ya fue finalizada' })
    }

    const preguntas = await preguntasDe(instrumento.id, true)
    const enviadas = peticion.body?.respuestas ?? {}
    const finalizar = peticion.body?.finalizar === true
    const limpias = {}
    const faltantes = []

    for (const pregunta of preguntas) {
      const { vacia, valor } = normalizarRespuesta(pregunta, enviadas[pregunta.id])
      if (!vacia) limpias[pregunta.id] = valor
      else if (pregunta.obligatoria) faltantes.push(pregunta.id)
    }

    if (finalizar && faltantes.length > 0) {
      return respuesta
        .status(400)
        .json({ error: 'Faltan preguntas obligatorias por responder', faltantes })
    }

    const ahora = new Date().toISOString()
    const estado = finalizar ? 'finalizada' : 'borrador'
    const puntaje = finalizar ? puntajeDe(preguntas, limpias) : null

    await pool.query(
      `INSERT INTO respuestas_instrumento
         (id, instrumento_id, usuario_id, estado, respuestas, puntaje, creado_en, actualizado_en, finalizado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8)
       ON CONFLICT (instrumento_id, usuario_id) DO UPDATE SET
         estado = excluded.estado,
         respuestas = excluded.respuestas,
         puntaje = excluded.puntaje,
         actualizado_en = excluded.actualizado_en,
         finalizado_en = excluded.finalizado_en`,
      [
        nuevoId(),
        instrumento.id,
        peticion.usuario.id,
        estado,
        JSON.stringify(limpias),
        puntaje,
        ahora,
        finalizar ? ahora : null,
      ],
    )
    await registrarAuditoria(
      peticion.usuario.id,
      finalizar ? 'instrumento_finalizado' : 'instrumento_guardado',
      instrumento.clave,
    )
    const guardada = await unaFila(
      'SELECT * FROM respuestas_instrumento WHERE instrumento_id = $1 AND usuario_id = $2',
      [instrumento.id, peticion.usuario.id],
    )
    return respuesta.json(respuestaPublica(guardada))
  }),
)

// --------------------------------------------------------------- administración

rutasInstrumentos.get(
  '/api/admin/instrumentos',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (_peticion, respuesta) => {
    const filas = await consultar('SELECT * FROM instrumentos ORDER BY orden, creado_en')
    const salida = []
    for (const fila of filas) {
      salida.push(instrumentoPublico(fila, await preguntasDe(fila.id, false)))
    }
    respuesta.json(salida)
  }),
)

rutasInstrumentos.post(
  '/api/admin/instrumentos',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const nombre = texto(peticion.body?.nombre, 160)
    if (!nombre) return respuesta.status(400).json({ error: 'El nombre del test es obligatorio' })

    const base = nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40)
    let clave = base || 'test'
    let sufijo = 1
    while (await unaFila('SELECT 1 FROM instrumentos WHERE clave = $1', [clave])) {
      sufijo += 1
      clave = `${base}-${sufijo}`
    }

    const { maximo } = (await unaFila('SELECT COALESCE(MAX(orden), 0) AS maximo FROM instrumentos')) ?? {}
    const id = nuevoId()
    await pool.query(
      `INSERT INTO instrumentos (id, clave, nombre, descripcion, tipo, activo, orden, creado_en)
       VALUES ($1,$2,$3,$4,'personalizado',$5,$6,$7)`,
      [
        id,
        clave,
        nombre,
        texto(peticion.body?.descripcion, 600),
        peticion.body?.activo !== false,
        Number(maximo ?? 0) + 1,
        new Date().toISOString(),
      ],
    )
    await registrarAuditoria(peticion.usuario.id, 'instrumento_creado', clave)
    const fila = await unaFila('SELECT * FROM instrumentos WHERE id = $1', [id])
    return respuesta.status(201).json(instrumentoPublico(fila, []))
  }),
)

rutasInstrumentos.put(
  '/api/admin/instrumentos/:id',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const fila = await unaFila('SELECT * FROM instrumentos WHERE id = $1', [peticion.params.id])
    if (!fila) return respuesta.status(404).json({ error: 'Instrumento no encontrado' })

    const cuerpo = peticion.body ?? {}
    const cambios = {
      nombre: texto(cuerpo.nombre, 160) || fila.nombre,
      descripcion:
        typeof cuerpo.descripcion === 'string' ? texto(cuerpo.descripcion, 600) : fila.descripcion,
      activo: typeof cuerpo.activo === 'boolean' ? cuerpo.activo : fila.activo,
      orden: Number.isFinite(Number(cuerpo.orden)) ? Number(cuerpo.orden) : fila.orden,
    }
    await pool.query(
      'UPDATE instrumentos SET nombre = $1, descripcion = $2, activo = $3, orden = $4 WHERE id = $5',
      [cambios.nombre, cambios.descripcion, cambios.activo, cambios.orden, fila.id],
    )
    await registrarAuditoria(peticion.usuario.id, 'instrumento_editado', fila.clave)
    const actualizado = await unaFila('SELECT * FROM instrumentos WHERE id = $1', [fila.id])
    return respuesta.json(instrumentoPublico(actualizado, await preguntasDe(fila.id, false)))
  }),
)

rutasInstrumentos.delete(
  '/api/admin/instrumentos/:id',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const fila = await unaFila('SELECT * FROM instrumentos WHERE id = $1', [peticion.params.id])
    if (!fila) return respuesta.status(404).json({ error: 'Instrumento no encontrado' })
    if (fila.tipo === 'sistema') {
      return respuesta
        .status(400)
        .json({ error: 'Los instrumentos del sistema solo pueden desactivarse, no eliminarse' })
    }
    await pool.query('DELETE FROM instrumentos WHERE id = $1', [fila.id])
    await registrarAuditoria(peticion.usuario.id, 'instrumento_eliminado', fila.clave)
    return respuesta.status(204).end()
  }),
)

async function instrumentoEditable(id) {
  const fila = await unaFila('SELECT * FROM instrumentos WHERE id = $1', [id])
  if (!fila) return { error: { estado: 404, mensaje: 'Instrumento no encontrado' } }
  if (fila.tipo === 'sistema') {
    return {
      error: {
        estado: 400,
        mensaje:
          'Las preguntas de los instrumentos validados (KSS, Samn-Perelli, Epworth) son lógica protegida del sistema',
      },
    }
  }
  return { instrumento: fila }
}

function datosPregunta(cuerpo, previa) {
  const tipo = TIPOS_PREGUNTA.includes(cuerpo?.tipo) ? cuerpo.tipo : (previa?.tipo ?? 'unica')
  const opciones = Array.isArray(cuerpo?.opciones)
    ? cuerpo.opciones
        .map((opcion) => ({
          texto: texto(opcion?.texto, 160),
          valor: Number.isFinite(Number(opcion?.valor)) ? Number(opcion.valor) : 0,
        }))
        .filter((opcion) => opcion.texto !== '')
    : opcionesPublicas(previa?.opciones)
  return {
    texto: texto(cuerpo?.texto, 400) || previa?.texto || '',
    ayuda: typeof cuerpo?.ayuda === 'string' ? texto(cuerpo.ayuda, 300) : (previa?.ayuda ?? ''),
    tipo,
    opciones: tipo === 'unica' || tipo === 'multiple' ? opciones : [],
    obligatoria:
      typeof cuerpo?.obligatoria === 'boolean' ? cuerpo.obligatoria : Boolean(previa?.obligatoria ?? true),
    activa: typeof cuerpo?.activa === 'boolean' ? cuerpo.activa : Boolean(previa?.activa ?? true),
  }
}

rutasInstrumentos.post(
  '/api/admin/instrumentos/:id/preguntas',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const { instrumento, error } = await instrumentoEditable(peticion.params.id)
    if (error) return respuesta.status(error.estado).json({ error: error.mensaje })

    const datos = datosPregunta(peticion.body, null)
    if (!datos.texto) return respuesta.status(400).json({ error: 'El texto de la pregunta es obligatorio' })
    if ((datos.tipo === 'unica' || datos.tipo === 'multiple') && datos.opciones.length < 2) {
      return respuesta.status(400).json({ error: 'Las preguntas de opciones requieren al menos dos opciones' })
    }

    const { maximo } =
      (await unaFila('SELECT COALESCE(MAX(orden), 0) AS maximo FROM preguntas WHERE instrumento_id = $1', [
        instrumento.id,
      ])) ?? {}
    const id = nuevoId()
    await pool.query(
      `INSERT INTO preguntas (id, instrumento_id, texto, ayuda, tipo, opciones, obligatoria, activa, orden, creado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        instrumento.id,
        datos.texto,
        datos.ayuda,
        datos.tipo,
        JSON.stringify(datos.opciones),
        datos.obligatoria,
        datos.activa,
        Number(maximo ?? 0) + 1,
        new Date().toISOString(),
      ],
    )
    await registrarAuditoria(peticion.usuario.id, 'pregunta_creada', instrumento.clave)
    const fila = await unaFila('SELECT * FROM preguntas WHERE id = $1', [id])
    return respuesta.status(201).json(preguntaPublica(fila))
  }),
)

rutasInstrumentos.put(
  '/api/admin/preguntas/:id',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const previa = await unaFila('SELECT * FROM preguntas WHERE id = $1', [peticion.params.id])
    if (!previa) return respuesta.status(404).json({ error: 'Pregunta no encontrada' })
    const { error } = await instrumentoEditable(previa.instrumento_id)
    if (error) return respuesta.status(error.estado).json({ error: error.mensaje })

    const datos = datosPregunta(peticion.body, previa)
    if ((datos.tipo === 'unica' || datos.tipo === 'multiple') && datos.opciones.length < 2) {
      return respuesta.status(400).json({ error: 'Las preguntas de opciones requieren al menos dos opciones' })
    }
    const orden = Number.isFinite(Number(peticion.body?.orden)) ? Number(peticion.body.orden) : previa.orden

    await pool.query(
      `UPDATE preguntas
          SET texto = $1, ayuda = $2, tipo = $3, opciones = $4, obligatoria = $5, activa = $6, orden = $7
        WHERE id = $8`,
      [
        datos.texto,
        datos.ayuda,
        datos.tipo,
        JSON.stringify(datos.opciones),
        datos.obligatoria,
        datos.activa,
        orden,
        previa.id,
      ],
    )
    await registrarAuditoria(peticion.usuario.id, 'pregunta_editada', previa.id)
    const fila = await unaFila('SELECT * FROM preguntas WHERE id = $1', [previa.id])
    return respuesta.json(preguntaPublica(fila))
  }),
)

rutasInstrumentos.delete(
  '/api/admin/preguntas/:id',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const previa = await unaFila('SELECT * FROM preguntas WHERE id = $1', [peticion.params.id])
    if (!previa) return respuesta.status(404).json({ error: 'Pregunta no encontrada' })
    const { error } = await instrumentoEditable(previa.instrumento_id)
    if (error) return respuesta.status(error.estado).json({ error: error.mensaje })

    await pool.query('DELETE FROM preguntas WHERE id = $1', [previa.id])
    await registrarAuditoria(peticion.usuario.id, 'pregunta_eliminada', previa.id)
    return respuesta.status(204).end()
  }),
)

rutasInstrumentos.get(
  '/api/admin/respuestas',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (_peticion, respuesta) => {
    const filas = await consultar('SELECT * FROM respuestas_instrumento ORDER BY actualizado_en DESC')
    respuesta.json(filas.map(respuestaPublica))
  }),
)

rutasInstrumentos.get(
  '/api/admin/resumen',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (_peticion, respuesta) => {
    const hoy = new Date().toISOString().slice(0, 10)
    const fila = await unaFila(
      `SELECT
         (SELECT COUNT(*)::int FROM usuarios WHERE rol = 'evaluado') AS personal,
         (SELECT COUNT(*)::int FROM usuarios WHERE rol = 'evaluado' AND activo) AS personal_activo,
         (SELECT COUNT(*)::int FROM registros) AS evaluaciones,
         (SELECT COUNT(*)::int FROM checkins) AS checkins,
         (SELECT COUNT(*)::int FROM checkins WHERE fecha = $1) AS checkins_hoy,
         (SELECT COUNT(*)::int FROM instrumentos) AS instrumentos,
         (SELECT COUNT(*)::int FROM instrumentos WHERE activo) AS instrumentos_activos,
         (SELECT COUNT(*)::int FROM preguntas WHERE activa) AS preguntas_activas,
         (SELECT COUNT(*)::int FROM respuestas_instrumento WHERE estado = 'finalizada') AS pruebas_finalizadas,
         (SELECT COUNT(*)::int FROM respuestas_instrumento WHERE estado = 'borrador') AS pruebas_en_curso`,
      [hoy],
    )
    const niveles = await consultar(
      'SELECT nivel, COUNT(*)::int AS total FROM checkins WHERE fecha = $1 GROUP BY nivel',
      [hoy],
    )
    const sinFicha = await unaFila(
      `SELECT COUNT(*)::int AS total FROM usuarios
        WHERE rol = 'evaluado'
          AND COALESCE(perfil::json->>'fechaNacimiento', '') = ''`,
    )

    respuesta.json({
      fecha: hoy,
      personal: fila.personal,
      personalActivo: fila.personal_activo,
      evaluacionesCompletas: fila.evaluaciones,
      checkins: fila.checkins,
      checkinsHoy: fila.checkins_hoy,
      pendientesCheckinHoy: Math.max(0, fila.personal_activo - fila.checkins_hoy),
      instrumentos: fila.instrumentos,
      instrumentosActivos: fila.instrumentos_activos,
      preguntasActivas: fila.preguntas_activas,
      pruebasFinalizadas: fila.pruebas_finalizadas,
      pruebasEnCurso: fila.pruebas_en_curso,
      fichasIncompletas: sinFicha?.total ?? 0,
      nivelesHoy: Object.fromEntries(niveles.map((item) => [item.nivel, item.total])),
    })
  }),
)
