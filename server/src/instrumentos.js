import express from 'express'
import { autenticar, exigirAdministrador, exigirEvaluado } from './auth.js'
import { consultar, nuevoId, pool, registrarAuditoria, unaFila } from './db.js'
import { calcularEstandarizado } from './instrumentosBase.js'
import { explicar } from './modeloRiesgo.js'
import {
  actualizarLineaBase,
  estrategiasSugeridas,
  historialIntegrado,
  lineasBaseDe,
  recalcularRiesgo,
} from './servicioRiesgo.js'

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
    clave: fila.clave ?? null,
    minimo: fila.minimo === null || fila.minimo === undefined ? null : Number(fila.minimo),
    maximo: fila.maximo === null || fila.maximo === undefined ? null : Number(fila.maximo),
    paso: fila.paso === null || fila.paso === undefined ? null : Number(fila.paso),
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
    dominio: fila.dominio ?? '',
    frecuenciaDias: fila.frecuencia_dias ?? 1,
    version: fila.version ?? 1,
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
    puntaje: fila.puntaje === null ? null : Number(fila.puntaje),
    puntajeNormalizado:
      fila.puntaje_normalizado === null || fila.puntaje_normalizado === undefined
        ? null
        : Number(fila.puntaje_normalizado),
    interpretacion: fila.interpretacion ?? '',
    instrumentoVersion: fila.instrumento_version ?? 1,
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

function proximaAplicacion(ultimaFecha, frecuenciaDias) {
  if (!ultimaFecha) return { disponible: true, proximaEn: null }
  const proxima = new Date(Date.parse(ultimaFecha) + frecuenciaDias * 86_400_000)
  return { disponible: proxima.getTime() <= Date.now(), proximaEn: proxima.toISOString() }
}

rutasInstrumentos.get(
  '/api/instrumentos',
  asincrono(autenticar),
  exigirEvaluado,
  asincrono(async (peticion, respuesta) => {
    const filas = await consultar('SELECT * FROM instrumentos WHERE activo ORDER BY orden, creado_en')
    const mias = await consultar(
      'SELECT * FROM respuestas_instrumento WHERE usuario_id = $1 ORDER BY actualizado_en DESC',
      [peticion.usuario.id],
    )
    const salida = []
    for (const fila of filas) {
      const preguntas = fila.tipo === 'sistema' ? [] : await preguntasDe(fila.id, true)
      const propias = mias.filter((item) => item.instrumento_id === fila.id)
      const borrador = propias.find((item) => item.estado === 'borrador') ?? null
      const finalizadas = propias
        .filter((item) => item.estado === 'finalizada')
        .sort((a, b) => Date.parse(b.finalizado_en) - Date.parse(a.finalizado_en))
      const frecuencia = fila.frecuencia_dias ?? 1
      salida.push({
        ...instrumentoPublico(fila, preguntas),
        miBorrador: respuestaPublica(borrador),
        ultimaAplicacion: respuestaPublica(finalizadas[0]),
        totalAplicaciones: finalizadas.length,
        ...proximaAplicacion(finalizadas[0]?.finalizado_en ?? null, frecuencia),
      })
    }
    respuesta.json(salida)
  }),
)

rutasInstrumentos.get(
  '/api/instrumentos/:id/historial',
  asincrono(autenticar),
  exigirEvaluado,
  asincrono(async (peticion, respuesta) => {
    const filas = await consultar(
      `SELECT * FROM respuestas_instrumento
        WHERE instrumento_id = $1 AND usuario_id = $2 AND estado = 'finalizada'
        ORDER BY finalizado_en DESC LIMIT 60`,
      [peticion.params.id, peticion.usuario.id],
    )
    respuesta.json(filas.map(respuestaPublica))
  }),
)

rutasInstrumentos.get(
  '/api/mi-riesgo',
  asincrono(autenticar),
  exigirEvaluado,
  asincrono(async (peticion, respuesta) => {
    const fila = await unaFila(
      'SELECT * FROM evaluaciones_riesgo WHERE usuario_id = $1 ORDER BY calculado_en DESC LIMIT 1',
      [peticion.usuario.id],
    )
    if (!fila) return respuesta.json({ resultado: null, historial: [], estrategias: [], explicacion: [] })
    const detalle = JSON.parse(fila.detalle)
    const resultado = {
      puntaje: Number(fila.puntaje),
      puntajeBase: Number(fila.puntaje_base),
      nivel: fila.nivel,
      confianza: fila.confianza,
      cobertura: Number(fila.cobertura),
      versionModelo: fila.version_modelo,
      calculadoEn: fila.calculado_en,
      ...detalle,
    }
    return respuesta.json({
      resultado,
      explicacion: explicar(resultado),
      historial: await historialIntegrado(peticion.usuario.id, 30),
      estrategias: await estrategiasSugeridas(resultado),
      lineasBase: await lineasBaseDe(peticion.usuario.id),
    })
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
      "SELECT * FROM respuestas_instrumento WHERE instrumento_id = $1 AND usuario_id = $2 AND estado = 'borrador'",
      [instrumento.id, peticion.usuario.id],
    )

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

    let puntaje = null
    let normalizado = null
    let interpretacion = ''
    let detalle = {}
    if (finalizar) {
      const estandarizado =
        instrumento.tipo === 'estandarizado'
          ? calcularEstandarizado(instrumento.clave, preguntas, limpias)
          : null
      if (instrumento.tipo === 'estandarizado' && !estandarizado) {
        return respuesta.status(400).json({ error: 'El instrumento requiere todas sus respuestas' })
      }
      if (estandarizado) {
        puntaje = estandarizado.puntaje
        normalizado = estandarizado.normalizado
        interpretacion = estandarizado.interpretacion
        detalle = estandarizado.detalle
      } else {
        puntaje = puntajeDe(preguntas, limpias)
      }
    }

    const id = previa?.id ?? nuevoId()
    if (previa) {
      await pool.query(
        `UPDATE respuestas_instrumento
            SET estado = $1, respuestas = $2, puntaje = $3, puntaje_normalizado = $4,
                interpretacion = $5, detalle = $6, actualizado_en = $7, finalizado_en = $8,
                instrumento_version = $9
          WHERE id = $10`,
        [
          estado,
          JSON.stringify(limpias),
          puntaje,
          normalizado,
          interpretacion,
          JSON.stringify(detalle),
          ahora,
          finalizar ? ahora : null,
          instrumento.version ?? 1,
          previa.id,
        ],
      )
    } else {
      await pool.query(
        `INSERT INTO respuestas_instrumento
           (id, instrumento_id, usuario_id, estado, respuestas, puntaje, puntaje_normalizado,
            interpretacion, detalle, creado_en, actualizado_en, finalizado_en, instrumento_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12)`,
        [
          id,
          instrumento.id,
          peticion.usuario.id,
          estado,
          JSON.stringify(limpias),
          puntaje,
          normalizado,
          interpretacion,
          JSON.stringify(detalle),
          ahora,
          finalizar ? ahora : null,
          instrumento.version ?? 1,
        ],
      )
    }

    await registrarAuditoria(
      peticion.usuario.id,
      finalizar ? 'instrumento_finalizado' : 'instrumento_guardado',
      instrumento.clave,
    )

    let riesgo = null
    if (finalizar && instrumento.tipo === 'estandarizado') {
      await actualizarLineaBase(peticion.usuario.id, instrumento.dominio)
      const recalculo = await recalcularRiesgo(peticion.usuario.id, `instrumento:${instrumento.clave}`)
      riesgo = {
        puntaje: recalculo.resultado.puntaje,
        nivel: recalculo.resultado.nivel,
        confianza: recalculo.resultado.confianza,
        versionModelo: recalculo.version,
        explicacion: explicar(recalculo.resultado),
      }
    }

    const guardada = await unaFila('SELECT * FROM respuestas_instrumento WHERE id = $1', [id])
    return respuesta.json({ ...respuestaPublica(guardada), riesgo })
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
    const protegido = fila.tipo === 'sistema' || fila.tipo === 'estandarizado'
    const frecuencia = Number(cuerpo.frecuenciaDias)
    const cambios = {
      // De un instrumento estandarizado solo se administran su disponibilidad y su frecuencia.
      nombre: protegido ? fila.nombre : texto(cuerpo.nombre, 160) || fila.nombre,
      descripcion: protegido
        ? fila.descripcion
        : typeof cuerpo.descripcion === 'string'
          ? texto(cuerpo.descripcion, 600)
          : fila.descripcion,
      activo: typeof cuerpo.activo === 'boolean' ? cuerpo.activo : fila.activo,
      orden: Number.isFinite(Number(cuerpo.orden)) ? Number(cuerpo.orden) : fila.orden,
      frecuenciaDias:
        Number.isFinite(frecuencia) && frecuencia >= 1 && frecuencia <= 365
          ? Math.round(frecuencia)
          : fila.frecuencia_dias,
    }
    await pool.query(
      `UPDATE instrumentos
          SET nombre = $1, descripcion = $2, activo = $3, orden = $4, frecuencia_dias = $5
        WHERE id = $6`,
      [cambios.nombre, cambios.descripcion, cambios.activo, cambios.orden, cambios.frecuenciaDias, fila.id],
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
    if (fila.tipo === 'sistema' || fila.tipo === 'estandarizado') {
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
  if (fila.tipo === 'sistema' || fila.tipo === 'estandarizado') {
    return {
      error: {
        estado: 400,
        mensaje:
          'Las preguntas de los instrumentos estandarizados (KSS, Samn-Perelli, Epworth, NASA-TLX) no son editables: su contenido define la validez de la escala',
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
  asincrono(async (peticion, respuesta) => {
    // Paginado en servidor: con miles de evaluados el listado completo no es transportable.
    const pagina = Math.max(1, Number.parseInt(peticion.query.pagina ?? '1', 10) || 1)
    const tam = Math.min(100, Math.max(5, Number.parseInt(peticion.query.tam ?? '25', 10) || 25))
    const instrumentoId = texto(peticion.query.instrumento, 60)
    const estado = peticion.query.estado === 'borrador' || peticion.query.estado === 'finalizada'
      ? peticion.query.estado
      : ''

    const condiciones = []
    const parametros = []
    if (instrumentoId) {
      parametros.push(instrumentoId)
      condiciones.push(`r.instrumento_id = $${parametros.length}`)
    }
    if (estado) {
      parametros.push(estado)
      condiciones.push(`r.estado = $${parametros.length}`)
    }
    const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''

    const total = await unaFila(
      `SELECT COUNT(*)::int AS total FROM respuestas_instrumento r ${donde}`,
      parametros,
    )
    const filas = await consultar(
      `SELECT r.*, u.nombre AS persona_nombre, u.grado AS persona_grado, i.nombre AS instrumento_nombre
         FROM respuestas_instrumento r
         JOIN usuarios u ON u.id = r.usuario_id
         JOIN instrumentos i ON i.id = r.instrumento_id
         ${donde}
        ORDER BY r.actualizado_en DESC, r.id ASC
        LIMIT ${tam} OFFSET ${(pagina - 1) * tam}`,
      parametros,
    )
    respuesta.json({
      total: total.total,
      pagina,
      tam,
      aplicaciones: filas.map((fila) => ({
        ...respuestaPublica(fila),
        persona: `${fila.persona_grado ?? ''} ${fila.persona_nombre ?? ''}`.trim(),
        instrumentoNombre: fila.instrumento_nombre,
      })),
    })
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
