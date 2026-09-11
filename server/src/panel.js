// Panel poblacional del administrador.
//
// Todas las agregaciones se resuelven en PostgreSQL y el listado de personas está paginado en
// servidor: el navegador nunca recibe la población completa, de modo que el panel se comporta
// igual con 50 que con 1.000 o más evaluados.

import express from 'express'
import { autenticar, exigirAdministrador } from './auth.js'
import { consultar, nuevoId, pool, registrarAuditoria, unaFila } from './db.js'
import { NIVELES, explicar } from './modeloRiesgo.js'
import {
  estrategiasSugeridas,
  historialIntegrado,
  lineasBaseDe,
  modeloActivo,
  recalcularRiesgo,
} from './servicioRiesgo.js'

function asincrono(manejador) {
  return (peticion, respuesta, siguiente) =>
    Promise.resolve(manejador(peticion, respuesta, siguiente)).catch(siguiente)
}

function texto(valor, maximo) {
  return typeof valor === 'string' ? valor.trim().slice(0, maximo) : ''
}

const ULTIMO_RIESGO = `
  SELECT DISTINCT ON (usuario_id) *
    FROM evaluaciones_riesgo
   ORDER BY usuario_id, calculado_en DESC`

export const rutasPanel = express.Router()

rutasPanel.get(
  '/api/admin/panel/resumen',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (_peticion, respuesta) => {
    const hoy = new Date().toISOString().slice(0, 10)
    const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString()

    const [totales, distribucion, alertas, porInstrumento, tendencia, senales] = await Promise.all([
      unaFila(
        `SELECT
           (SELECT COUNT(*)::int FROM usuarios WHERE rol = 'evaluado') AS personal,
           (SELECT COUNT(*)::int FROM usuarios WHERE rol = 'evaluado' AND activo) AS personal_activo,
           (SELECT COUNT(*)::int FROM respuestas_instrumento WHERE estado = 'finalizada') AS aplicaciones,
           (SELECT COUNT(*)::int FROM respuestas_instrumento WHERE estado = 'finalizada' AND finalizado_en >= $1) AS aplicaciones_7d,
           (SELECT COUNT(*)::int FROM respuestas_instrumento WHERE estado = 'borrador') AS en_curso,
           (SELECT COUNT(DISTINCT usuario_id)::int FROM respuestas_instrumento WHERE estado = 'finalizada' AND finalizado_en >= $1) AS evaluados_7d,
           (SELECT COUNT(*)::int FROM checkins WHERE fecha = $2) AS registros_hoy,
           (SELECT COUNT(*)::int FROM usuarios WHERE rol = 'evaluado' AND COALESCE(perfil::json->>'fechaNacimiento','') = '') AS fichas_incompletas`,
        [hace7, hoy],
      ),
      consultar(`SELECT nivel, COUNT(*)::int AS total FROM (${ULTIMO_RIESGO}) u GROUP BY nivel`),
      consultar(
        "SELECT severidad, COUNT(*)::int AS total FROM alertas WHERE estado = 'abierta' GROUP BY severidad",
      ),
      consultar(
        `SELECT i.clave, i.nombre, i.frecuencia_dias,
                COUNT(r.id)::int AS aplicaciones,
                COUNT(r.id) FILTER (WHERE r.finalizado_en >= $1)::int AS aplicaciones_7d,
                ROUND(AVG(r.puntaje_normalizado) FILTER (WHERE r.finalizado_en >= $2)::numeric, 1) AS promedio_30d,
                COUNT(DISTINCT r.usuario_id) FILTER (WHERE r.finalizado_en >= $1)::int AS evaluados_7d
           FROM instrumentos i
           LEFT JOIN respuestas_instrumento r
             ON r.instrumento_id = i.id AND r.estado = 'finalizada'
          WHERE i.tipo = 'estandarizado'
          GROUP BY i.clave, i.nombre, i.frecuencia_dias, i.orden
          ORDER BY i.orden`,
        [hace7, hace30],
      ),
      consultar(
        `SELECT substring(calculado_en, 1, 10) AS dia,
                ROUND(AVG(puntaje)::numeric, 1) AS promedio,
                COUNT(*)::int AS mediciones,
                COUNT(*) FILTER (WHERE nivel IN ('alto','critico'))::int AS elevados
           FROM evaluaciones_riesgo
          WHERE calculado_en >= $1
          GROUP BY dia ORDER BY dia`,
        [hace30],
      ),
      unaFila(
        `SELECT
           COUNT(*) FILTER (WHERE (detalle::json->'senales'->>'persistente') = 'true')::int AS persistentes,
           COUNT(*) FILTER (WHERE (detalle::json->'tendencia'->>'direccion') = 'deterioro')::int AS deterioro,
           COUNT(*) FILTER (WHERE (detalle::json->'tendencia'->>'direccion') = 'recuperacion')::int AS recuperacion,
           COUNT(*) FILTER (WHERE confianza = 'baja')::int AS confianza_baja
           FROM (${ULTIMO_RIESGO}) u`,
      ),
    ])

    const evaluadosActivos = totales.personal_activo
    respuesta.json({
      fecha: hoy,
      personal: totales.personal,
      personalActivo: evaluadosActivos,
      aplicaciones: totales.aplicaciones,
      aplicaciones7d: totales.aplicaciones_7d,
      enCurso: totales.en_curso,
      evaluados7d: totales.evaluados_7d,
      sinEvaluar7d: Math.max(0, evaluadosActivos - totales.evaluados_7d),
      adherencia7d:
        evaluadosActivos === 0 ? 0 : Math.round((totales.evaluados_7d / evaluadosActivos) * 100),
      registrosHoy: totales.registros_hoy,
      fichasIncompletas: totales.fichas_incompletas,
      distribucion: {
        ...Object.fromEntries(NIVELES.map((nivel) => [nivel, 0])),
        ...Object.fromEntries(distribucion.map((fila) => [fila.nivel, fila.total])),
      },
      alertasAbiertas: Object.fromEntries(alertas.map((fila) => [fila.severidad, fila.total])),
      instrumentos: porInstrumento.map((fila) => ({
        clave: fila.clave,
        nombre: fila.nombre,
        frecuenciaDias: fila.frecuencia_dias,
        aplicaciones: fila.aplicaciones,
        aplicaciones7d: fila.aplicaciones_7d,
        promedio30d: fila.promedio_30d === null ? null : Number(fila.promedio_30d),
        evaluados7d: fila.evaluados_7d,
      })),
      tendencia: tendencia.map((fila) => ({
        dia: fila.dia,
        promedio: Number(fila.promedio),
        mediciones: fila.mediciones,
        elevados: fila.elevados,
      })),
      senales: {
        persistentes: senales?.persistentes ?? 0,
        deterioro: senales?.deterioro ?? 0,
        recuperacion: senales?.recuperacion ?? 0,
        confianzaBaja: senales?.confianza_baja ?? 0,
      },
    })
  }),
)

rutasPanel.get(
  '/api/admin/panel/personas',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const pagina = Math.max(1, Number(peticion.query.pagina ?? 1) || 1)
    const tam = Math.min(100, Math.max(10, Number(peticion.query.tam ?? 25) || 25))
    const nivel = NIVELES.includes(peticion.query.nivel) ? peticion.query.nivel : null
    const unidad = texto(peticion.query.unidad, 120) || null
    const grado = texto(peticion.query.grado, 80) || null
    const busqueda = texto(peticion.query.busqueda, 120) || null
    const conAlerta = peticion.query.conAlerta === 'true'
    const sinDatos = peticion.query.sinDatos === 'true'
    // El id desempata: sin criterio total, dos páginas consecutivas pueden repetir filas.
    const orden =
      peticion.query.orden === 'nombre'
        ? 'u.nombre ASC, u.id ASC'
        : 'r.puntaje DESC NULLS LAST, u.id ASC'

    const filtros = ["u.rol = 'evaluado'"]
    const parametros = []
    if (nivel) {
      parametros.push(nivel)
      filtros.push(`r.nivel = $${parametros.length}`)
    }
    if (unidad) {
      parametros.push(unidad)
      filtros.push(`u.unidad = $${parametros.length}`)
    }
    if (grado) {
      parametros.push(grado)
      filtros.push(`u.grado = $${parametros.length}`)
    }
    if (busqueda) {
      parametros.push(`%${busqueda.toLowerCase()}%`)
      filtros.push(`(lower(u.nombre) LIKE $${parametros.length} OR lower(u.correo) LIKE $${parametros.length})`)
    }
    if (conAlerta) filtros.push('a.abiertas > 0')
    if (sinDatos) filtros.push('r.calculado_en IS NULL')

    const donde = filtros.join(' AND ')
    const base = `
        FROM usuarios u
        LEFT JOIN (${ULTIMO_RIESGO}) r ON r.usuario_id = u.id
        LEFT JOIN (
          SELECT usuario_id, COUNT(*)::int AS abiertas
            FROM alertas WHERE estado = 'abierta' GROUP BY usuario_id
        ) a ON a.usuario_id = u.id
       WHERE ${donde}`

    const total = await unaFila(`SELECT COUNT(*)::int AS total ${base}`, parametros)
    const filas = await consultar(
      `SELECT u.id, u.nombre, u.grado, u.unidad, u.correo, u.activo,
              r.puntaje, r.nivel, r.confianza, r.calculado_en,
              r.detalle::json->'tendencia'->>'direccion' AS direccion,
              (r.detalle::json->'senales'->>'persistente')::boolean AS persistente,
              COALESCE(a.abiertas, 0) AS alertas
         ${base}
        ORDER BY ${orden}
        LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
      [...parametros, tam, (pagina - 1) * tam],
    )

    respuesta.json({
      pagina,
      tam,
      total: total.total,
      paginas: Math.max(1, Math.ceil(total.total / tam)),
      personas: filas.map((fila) => ({
        id: fila.id,
        nombre: fila.nombre,
        grado: fila.grado,
        unidad: fila.unidad,
        correo: fila.correo,
        activo: fila.activo,
        puntaje: fila.puntaje === null ? null : Number(fila.puntaje),
        nivel: fila.nivel,
        confianza: fila.confianza,
        calculadoEn: fila.calculado_en,
        direccion: fila.direccion,
        persistente: Boolean(fila.persistente),
        alertas: Number(fila.alertas),
      })),
    })
  }),
)

rutasPanel.get(
  '/api/admin/panel/filtros',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (_peticion, respuesta) => {
    const [unidades, grados] = await Promise.all([
      consultar("SELECT DISTINCT unidad FROM usuarios WHERE rol = 'evaluado' AND unidad <> '' ORDER BY unidad"),
      consultar("SELECT DISTINCT grado FROM usuarios WHERE rol = 'evaluado' AND grado <> '' ORDER BY grado"),
    ])
    respuesta.json({
      unidades: unidades.map((fila) => fila.unidad),
      grados: grados.map((fila) => fila.grado),
    })
  }),
)

rutasPanel.get(
  '/api/admin/panel/personas/:id',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const usuario = await unaFila("SELECT * FROM usuarios WHERE id = $1 AND rol = 'evaluado'", [
      peticion.params.id,
    ])
    if (!usuario) return respuesta.status(404).json({ error: 'Evaluado no encontrado' })

    const [ultimo, aplicaciones, alertas, historial, lineasBase] = await Promise.all([
      unaFila(
        'SELECT * FROM evaluaciones_riesgo WHERE usuario_id = $1 ORDER BY calculado_en DESC LIMIT 1',
        [usuario.id],
      ),
      consultar(
        `SELECT i.clave, i.nombre, i.dominio, r.puntaje, r.puntaje_normalizado, r.interpretacion,
                r.finalizado_en, r.instrumento_version
           FROM respuestas_instrumento r
           JOIN instrumentos i ON i.id = r.instrumento_id
          WHERE r.usuario_id = $1 AND r.estado = 'finalizada'
          ORDER BY r.finalizado_en DESC
          LIMIT 120`,
        [usuario.id],
      ),
      consultar('SELECT * FROM alertas WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 30', [
        usuario.id,
      ]),
      historialIntegrado(usuario.id, 60),
      lineasBaseDe(usuario.id),
    ])

    let resultado = null
    let estrategias = []
    let explicacion = []
    if (ultimo) {
      resultado = {
        puntaje: Number(ultimo.puntaje),
        puntajeBase: Number(ultimo.puntaje_base),
        nivel: ultimo.nivel,
        confianza: ultimo.confianza,
        cobertura: Number(ultimo.cobertura),
        versionModelo: ultimo.version_modelo,
        calculadoEn: ultimo.calculado_en,
        ...JSON.parse(ultimo.detalle),
      }
      explicacion = explicar(resultado)
      estrategias = await estrategiasSugeridas(resultado)
    }

    return respuesta.json({
      persona: {
        id: usuario.id,
        nombre: usuario.nombre,
        grado: usuario.grado,
        unidad: usuario.unidad,
        correo: usuario.correo,
        activo: usuario.activo,
      },
      resultado,
      explicacion,
      estrategias,
      historial,
      lineasBase,
      aplicaciones: aplicaciones.map((fila) => ({
        clave: fila.clave,
        nombre: fila.nombre,
        dominio: fila.dominio,
        puntaje: Number(fila.puntaje),
        normalizado: fila.puntaje_normalizado === null ? null : Number(fila.puntaje_normalizado),
        interpretacion: fila.interpretacion,
        fecha: fila.finalizado_en,
        instrumentoVersion: fila.instrumento_version,
      })),
      alertas: alertas.map(alertaPublica),
    })
  }),
)

function alertaPublica(fila) {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    reglaClave: fila.regla_clave,
    severidad: fila.severidad,
    motivo: fila.motivo,
    estado: fila.estado,
    nota: fila.nota,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  }
}

rutasPanel.get(
  '/api/admin/alertas',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const estado = ['abierta', 'reconocida', 'resuelta'].includes(peticion.query.estado)
      ? peticion.query.estado
      : 'abierta'
    const filas = await consultar(
      `SELECT a.*, u.nombre, u.grado, u.unidad
         FROM alertas a JOIN usuarios u ON u.id = a.usuario_id
        WHERE a.estado = $1
        ORDER BY a.creado_en DESC LIMIT 200`,
      [estado],
    )
    respuesta.json(
      filas.map((fila) => ({
        ...alertaPublica(fila),
        persona: { nombre: fila.nombre, grado: fila.grado, unidad: fila.unidad },
      })),
    )
  }),
)

rutasPanel.put(
  '/api/admin/alertas/:id',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const estado = ['abierta', 'reconocida', 'resuelta'].includes(peticion.body?.estado)
      ? peticion.body.estado
      : null
    if (!estado) return respuesta.status(400).json({ error: 'Estado de alerta inválido' })
    const fila = await unaFila('SELECT * FROM alertas WHERE id = $1', [peticion.params.id])
    if (!fila) return respuesta.status(404).json({ error: 'Alerta no encontrada' })
    await pool.query(
      'UPDATE alertas SET estado = $1, nota = $2, actualizado_en = $3, cerrado_por = $4 WHERE id = $5',
      [estado, texto(peticion.body?.nota, 600), new Date().toISOString(), peticion.usuario.id, fila.id],
    )
    await registrarAuditoria(peticion.usuario.id, 'alerta_actualizada', `${fila.regla_clave}:${estado}`)
    const actualizada = await unaFila('SELECT * FROM alertas WHERE id = $1', [fila.id])
    return respuesta.json(alertaPublica(actualizada))
  }),
)

// -------------------------------------------------------------- modelo de riesgo

rutasPanel.get(
  '/api/admin/modelo',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (_peticion, respuesta) => {
    const filas = await consultar('SELECT * FROM modelos_riesgo ORDER BY version DESC')
    respuesta.json(
      filas.map((fila) => ({
        id: fila.id,
        version: fila.version,
        nombre: fila.nombre,
        activo: fila.activo,
        nota: fila.nota,
        creadoEn: fila.creado_en,
        definicion: JSON.parse(fila.definicion),
      })),
    )
  }),
)

// Cambiar la parametrización crea SIEMPRE una versión nueva: los resultados históricos
// conservan la versión con la que fueron calculados.
rutasPanel.post(
  '/api/admin/modelo',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const definicion = peticion.body?.definicion
    if (!definicion || typeof definicion !== 'object') {
      return respuesta.status(400).json({ error: 'Definición del modelo inválida' })
    }
    const pesos = definicion.pesos ?? {}
    const suma = Object.values(pesos).reduce((total, peso) => total + Number(peso ?? 0), 0)
    if (Object.keys(pesos).length === 0 || Math.abs(suma - 1) > 0.001) {
      return respuesta.status(400).json({ error: 'Los pesos de los dominios deben sumar 1' })
    }
    const { moderado, alto, critico } = definicion.umbrales ?? {}
    if (!(moderado < alto && alto < critico)) {
      return respuesta.status(400).json({ error: 'Los umbrales deben ser crecientes' })
    }

    const { maxima } = await unaFila('SELECT COALESCE(MAX(version), 0) AS maxima FROM modelos_riesgo')
    const version = Number(maxima) + 1
    await pool.query('UPDATE modelos_riesgo SET activo = FALSE')
    await pool.query(
      `INSERT INTO modelos_riesgo (id, version, nombre, definicion, activo, nota, creado_en, creado_por)
       VALUES ($1,$2,$3,$4,TRUE,$5,$6,$7)`,
      [
        nuevoId(),
        version,
        texto(peticion.body?.nombre, 160) || `Modelo integrado v${version}`,
        JSON.stringify({ ...definicion, nombre: texto(peticion.body?.nombre, 160) || definicion.nombre }),
        texto(peticion.body?.nota, 600),
        new Date().toISOString(),
        peticion.usuario.id,
      ],
    )
    await registrarAuditoria(peticion.usuario.id, 'modelo_versionado', `v${version}`)
    return respuesta.status(201).json({ version })
  }),
)

rutasPanel.put(
  '/api/admin/modelo/:version/activar',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const version = Number(peticion.params.version)
    const fila = await unaFila('SELECT * FROM modelos_riesgo WHERE version = $1', [version])
    if (!fila) return respuesta.status(404).json({ error: 'Versión no encontrada' })
    await pool.query('UPDATE modelos_riesgo SET activo = (version = $1)', [version])
    await registrarAuditoria(peticion.usuario.id, 'modelo_activado', `v${version}`)
    return respuesta.json({ version, activo: true })
  }),
)

rutasPanel.post(
  '/api/admin/modelo/recalcular',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const usuarios = await consultar(
      `SELECT DISTINCT u.id FROM usuarios u
         JOIN respuestas_instrumento r ON r.usuario_id = u.id AND r.estado = 'finalizada'
        WHERE u.rol = 'evaluado'`,
    )
    const inicio = Date.now()
    for (const usuario of usuarios) {
      await recalcularRiesgo(usuario.id, 'recalculo_administrativo')
    }
    const { version } = await modeloActivo()
    await registrarAuditoria(peticion.usuario.id, 'recalculo_masivo', `${usuarios.length} evaluados`)
    return respuesta.json({
      evaluados: usuarios.length,
      versionModelo: version,
      milisegundos: Date.now() - inicio,
    })
  }),
)

// -------------------------------------------------------------- reglas de alerta

rutasPanel.get(
  '/api/admin/reglas-alerta',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (_peticion, respuesta) => {
    const filas = await consultar('SELECT * FROM reglas_alerta ORDER BY clave')
    respuesta.json(
      filas.map((fila) => ({
        id: fila.id,
        clave: fila.clave,
        nombre: fila.nombre,
        descripcion: fila.descripcion,
        tipo: fila.tipo,
        parametros: JSON.parse(fila.parametros ?? '{}'),
        severidad: fila.severidad,
        activa: fila.activa,
      })),
    )
  }),
)

rutasPanel.put(
  '/api/admin/reglas-alerta/:id',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const fila = await unaFila('SELECT * FROM reglas_alerta WHERE id = $1', [peticion.params.id])
    if (!fila) return respuesta.status(404).json({ error: 'Regla no encontrada' })
    const parametros =
      peticion.body?.parametros && typeof peticion.body.parametros === 'object'
        ? peticion.body.parametros
        : JSON.parse(fila.parametros ?? '{}')
    const severidad = ['baja', 'media', 'alta'].includes(peticion.body?.severidad)
      ? peticion.body.severidad
      : fila.severidad
    await pool.query(
      'UPDATE reglas_alerta SET parametros = $1, severidad = $2, activa = $3 WHERE id = $4',
      [
        JSON.stringify(parametros),
        severidad,
        typeof peticion.body?.activa === 'boolean' ? peticion.body.activa : fila.activa,
        fila.id,
      ],
    )
    await registrarAuditoria(peticion.usuario.id, 'regla_alerta_editada', fila.clave)
    const actualizada = await unaFila('SELECT * FROM reglas_alerta WHERE id = $1', [fila.id])
    return respuesta.json({
      id: actualizada.id,
      clave: actualizada.clave,
      nombre: actualizada.nombre,
      descripcion: actualizada.descripcion,
      tipo: actualizada.tipo,
      parametros: JSON.parse(actualizada.parametros ?? '{}'),
      severidad: actualizada.severidad,
      activa: actualizada.activa,
    })
  }),
)

// -------------------------------------------------------------- estrategias de mitigación

function estrategiaPublica(fila) {
  return {
    id: fila.id,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    nivelObjetivo: fila.nivel_objetivo,
    dominio: fila.dominio,
    acciones: fila.acciones,
    reevaluarDias: fila.reevaluar_dias,
    escalamiento: fila.escalamiento,
    requiereValidacion: fila.requiere_validacion,
    activa: fila.activa,
    orden: fila.orden,
  }
}

function datosEstrategia(cuerpo, previa) {
  const nivel = NIVELES.includes(cuerpo?.nivelObjetivo)
    ? cuerpo.nivelObjetivo
    : (previa?.nivel_objetivo ?? 'alto')
  const reevaluar = Number(cuerpo?.reevaluarDias)
  return {
    titulo: texto(cuerpo?.titulo, 160) || previa?.titulo || '',
    descripcion:
      typeof cuerpo?.descripcion === 'string' ? texto(cuerpo.descripcion, 800) : (previa?.descripcion ?? ''),
    nivelObjetivo: nivel,
    dominio: typeof cuerpo?.dominio === 'string' ? texto(cuerpo.dominio, 60) : (previa?.dominio ?? ''),
    acciones: typeof cuerpo?.acciones === 'string' ? texto(cuerpo.acciones, 800) : (previa?.acciones ?? ''),
    reevaluarDias: Number.isFinite(reevaluar) && reevaluar > 0 ? Math.round(reevaluar) : (previa?.reevaluar_dias ?? null),
    escalamiento:
      typeof cuerpo?.escalamiento === 'string' ? texto(cuerpo.escalamiento, 200) : (previa?.escalamiento ?? ''),
    requiereValidacion:
      typeof cuerpo?.requiereValidacion === 'boolean'
        ? cuerpo.requiereValidacion
        : Boolean(previa?.requiere_validacion ?? true),
    activa: typeof cuerpo?.activa === 'boolean' ? cuerpo.activa : Boolean(previa?.activa ?? true),
  }
}

rutasPanel.get(
  '/api/admin/estrategias',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (_peticion, respuesta) => {
    const filas = await consultar('SELECT * FROM estrategias_mitigacion ORDER BY orden, creado_en')
    respuesta.json(filas.map(estrategiaPublica))
  }),
)

rutasPanel.post(
  '/api/admin/estrategias',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const datos = datosEstrategia(peticion.body, null)
    if (!datos.titulo) return respuesta.status(400).json({ error: 'El título es obligatorio' })
    const { maximo } = await unaFila('SELECT COALESCE(MAX(orden),0) AS maximo FROM estrategias_mitigacion')
    const id = nuevoId()
    await pool.query(
      `INSERT INTO estrategias_mitigacion
         (id, titulo, descripcion, nivel_objetivo, dominio, acciones, reevaluar_dias, escalamiento,
          requiere_validacion, activa, orden, creado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        datos.titulo,
        datos.descripcion,
        datos.nivelObjetivo,
        datos.dominio,
        datos.acciones,
        datos.reevaluarDias,
        datos.escalamiento,
        datos.requiereValidacion,
        datos.activa,
        Number(maximo) + 1,
        new Date().toISOString(),
      ],
    )
    await registrarAuditoria(peticion.usuario.id, 'estrategia_creada', datos.titulo)
    const fila = await unaFila('SELECT * FROM estrategias_mitigacion WHERE id = $1', [id])
    return respuesta.status(201).json(estrategiaPublica(fila))
  }),
)

rutasPanel.put(
  '/api/admin/estrategias/:id',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const previa = await unaFila('SELECT * FROM estrategias_mitigacion WHERE id = $1', [peticion.params.id])
    if (!previa) return respuesta.status(404).json({ error: 'Estrategia no encontrada' })
    const datos = datosEstrategia(peticion.body, previa)
    await pool.query(
      `UPDATE estrategias_mitigacion
          SET titulo = $1, descripcion = $2, nivel_objetivo = $3, dominio = $4, acciones = $5,
              reevaluar_dias = $6, escalamiento = $7, requiere_validacion = $8, activa = $9
        WHERE id = $10`,
      [
        datos.titulo,
        datos.descripcion,
        datos.nivelObjetivo,
        datos.dominio,
        datos.acciones,
        datos.reevaluarDias,
        datos.escalamiento,
        datos.requiereValidacion,
        datos.activa,
        previa.id,
      ],
    )
    await registrarAuditoria(peticion.usuario.id, 'estrategia_editada', previa.id)
    const fila = await unaFila('SELECT * FROM estrategias_mitigacion WHERE id = $1', [previa.id])
    return respuesta.json(estrategiaPublica(fila))
  }),
)

rutasPanel.delete(
  '/api/admin/estrategias/:id',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    await pool.query('DELETE FROM estrategias_mitigacion WHERE id = $1', [peticion.params.id])
    await registrarAuditoria(peticion.usuario.id, 'estrategia_eliminada', peticion.params.id)
    respuesta.status(204).end()
  }),
)
