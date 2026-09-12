// Orquestación del motor de riesgo: reúne las mediciones vigentes de cada instrumento,
// mantiene la línea base individual, calcula el índice integrado con el modelo activo,
// guarda el resultado con su trazabilidad y evalúa las reglas de alerta configuradas.

import { consultar, nuevoId, pool, unaFila } from './db.js'
import { calcularLineaBase, calcularRiesgo, definicionModeloV1, zRespectoBase } from './modeloRiesgo.js'

export async function modeloActivo() {
  const fila = await unaFila('SELECT * FROM modelos_riesgo WHERE activo ORDER BY version DESC LIMIT 1')
  if (!fila) return { version: 1, definicion: definicionModeloV1 }
  try {
    return { version: fila.version, definicion: JSON.parse(fila.definicion) }
  } catch {
    return { version: fila.version, definicion: definicionModeloV1 }
  }
}

export async function medicionesVigentes(usuarioId) {
  return consultar(
    `SELECT DISTINCT ON (i.clave)
            i.clave, i.dominio, r.puntaje, r.puntaje_normalizado, r.finalizado_en
       FROM respuestas_instrumento r
       JOIN instrumentos i ON i.id = r.instrumento_id
      WHERE r.usuario_id = $1 AND r.estado = 'finalizada' AND i.tipo = 'estandarizado'
      ORDER BY i.clave, r.finalizado_en DESC`,
    [usuarioId],
  ).then((filas) =>
    filas
      .filter((fila) => fila.puntaje_normalizado !== null)
      .map((fila) => ({
        clave: fila.clave,
        dominio: fila.dominio,
        puntaje: Number(fila.puntaje),
        normalizado: Number(fila.puntaje_normalizado),
        fecha: fila.finalizado_en,
      })),
  )
}

export async function ultimoRegistroDiario(usuarioId) {
  const fila = await unaFila(
    'SELECT * FROM checkins WHERE usuario_id = $1 ORDER BY fecha DESC LIMIT 1',
    [usuarioId],
  )
  if (!fila) return null
  return {
    fecha: fila.creado_en ?? `${fila.fecha}T12:00:00.000Z`,
    horasSueno: Number(fila.horas_sueno),
    horasDespierto: Number(fila.horas_despierto),
  }
}

export async function lineasBaseDe(usuarioId) {
  const filas = await consultar('SELECT * FROM lineas_base WHERE usuario_id = $1', [usuarioId])
  const salida = {}
  for (const fila of filas) {
    salida[fila.dominio] = {
      media: Number(fila.media),
      desviacion: Number(fila.desviacion),
      n: fila.n,
      provisional: fila.provisional,
    }
  }
  return salida
}

// La línea base se construye con las primeras mediciones finalizadas del evaluado (hasta 10),
// que representan su punto de partida antes de acumular exposición.
export async function actualizarLineaBase(usuarioId, dominio) {
  const filas = await consultar(
    `SELECT r.puntaje_normalizado
       FROM respuestas_instrumento r
       JOIN instrumentos i ON i.id = r.instrumento_id
      WHERE r.usuario_id = $1 AND i.dominio = $2 AND r.estado = 'finalizada'
        AND r.puntaje_normalizado IS NOT NULL
      ORDER BY r.finalizado_en ASC
      LIMIT 10`,
    [usuarioId, dominio],
  )
  const base = calcularLineaBase(filas.map((fila) => Number(fila.puntaje_normalizado)))
  if (!base) return null
  await pool.query(
    `INSERT INTO lineas_base (usuario_id, dominio, media, desviacion, n, provisional, actualizado_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (usuario_id, dominio) DO UPDATE SET
       media = excluded.media, desviacion = excluded.desviacion, n = excluded.n,
       provisional = excluded.provisional, actualizado_en = excluded.actualizado_en`,
    [usuarioId, dominio, base.media, base.desviacion, base.n, base.provisional, new Date().toISOString()],
  )
  return base
}

export async function historialIntegrado(usuarioId, limite = 60) {
  const filas = await consultar(
    'SELECT calculado_en, puntaje, nivel FROM evaluaciones_riesgo WHERE usuario_id = $1 ORDER BY calculado_en DESC LIMIT $2',
    [usuarioId, limite],
  )
  return filas.map((fila) => ({
    fecha: fila.calculado_en,
    puntaje: Number(fila.puntaje),
    nivel: fila.nivel,
  }))
}

async function reglasActivas() {
  return consultar('SELECT * FROM reglas_alerta WHERE activa')
}

function parametrosDe(fila) {
  try {
    return JSON.parse(fila.parametros ?? '{}') ?? {}
  } catch {
    return {}
  }
}

async function abrirAlerta(usuarioId, regla, motivo, evaluacionId) {
  const abierta = await unaFila(
    "SELECT id FROM alertas WHERE usuario_id = $1 AND regla_clave = $2 AND estado = 'abierta'",
    [usuarioId, regla.clave],
  )
  const ahora = new Date().toISOString()
  if (abierta) {
    await pool.query(
      'UPDATE alertas SET motivo = $1, actualizado_en = $2, evaluacion_riesgo_id = $3 WHERE id = $4',
      [motivo, ahora, evaluacionId, abierta.id],
    )
    return abierta.id
  }
  const id = nuevoId()
  await pool.query(
    `INSERT INTO alertas (id, usuario_id, regla_clave, severidad, motivo, estado, evaluacion_riesgo_id, creado_en, actualizado_en)
     VALUES ($1,$2,$3,$4,$5,'abierta',$6,$7,$7)`,
    [id, usuarioId, regla.clave, regla.severidad, motivo, evaluacionId, ahora],
  )
  return id
}

async function evaluarAlertas({ usuarioId, resultado, evaluacionId, lineasBase, mediciones, ahora }) {
  const generadas = []
  for (const regla of await reglasActivas()) {
    const parametros = parametrosDe(regla)
    if (regla.tipo === 'nivel') {
      const orden = ['bajo', 'moderado', 'alto', 'critico']
      if (orden.indexOf(resultado.nivel) >= orden.indexOf(parametros.nivelMinimo ?? 'alto')) {
        generadas.push({
          regla,
          motivo: `Índice integrado ${resultado.puntaje}/100 en nivel ${resultado.nivel}.`,
        })
      }
    } else if (regla.tipo === 'desviacion') {
      for (const componente of resultado.componentes) {
        if (!componente.vigente) continue
        const z = zRespectoBase(componente.normalizado, lineasBase[componente.dominio])
        if (z !== null && z >= (parametros.z ?? 1.5)) {
          generadas.push({
            regla,
            motivo: `${componente.nombre} a ${z} desviaciones de la línea base individual.`,
          })
          break
        }
      }
    } else if (regla.tipo === 'persistencia') {
      if (resultado.senales.medicionesConsecutivasElevadas >= (parametros.mediciones ?? 3)) {
        generadas.push({
          regla,
          motivo: `${resultado.senales.medicionesConsecutivasElevadas} mediciones consecutivas en nivel alto o superior.`,
        })
      }
    } else if (regla.tipo === 'cobertura') {
      const dias = parametros.diasSinDatos ?? 7
      const ultima = mediciones
        .map((medicion) => Date.parse(medicion.fecha))
        .filter((valor) => Number.isFinite(valor))
        .sort((a, b) => b - a)[0]
      if (!ultima || (ahora.getTime() - ultima) / 86_400_000 >= dias) {
        generadas.push({ regla, motivo: `Sin mediciones en los últimos ${dias} días.` })
      }
    }
  }

  const claves = []
  for (const { regla, motivo } of generadas) {
    await abrirAlerta(usuarioId, regla, motivo, evaluacionId)
    claves.push(regla.clave)
  }

  // Las alertas que dejaron de cumplirse se cierran automáticamente y quedan en el historial.
  if (claves.length > 0) {
    await pool.query(
      `UPDATE alertas SET estado = 'resuelta', actualizado_en = $1
        WHERE usuario_id = $2 AND estado = 'abierta' AND regla_clave <> ALL($3)`,
      [new Date().toISOString(), usuarioId, claves],
    )
  } else {
    await pool.query(
      "UPDATE alertas SET estado = 'resuelta', actualizado_en = $1 WHERE usuario_id = $2 AND estado = 'abierta'",
      [new Date().toISOString(), usuarioId],
    )
  }
  return claves
}

export async function recalcularRiesgo(usuarioId, disparadoPor = '') {
  const [{ version, definicion }, mediciones, registroDiario, lineasBase, historial] = await Promise.all([
    modeloActivo(),
    medicionesVigentes(usuarioId),
    ultimoRegistroDiario(usuarioId),
    lineasBaseDe(usuarioId),
    historialIntegrado(usuarioId),
  ])

  const ahora = new Date()
  const resultado = calcularRiesgo({
    definicion,
    mediciones,
    registroDiario,
    lineasBase,
    historialIntegrado: historial,
    ahora,
  })

  const id = nuevoId()
  await pool.query(
    `INSERT INTO evaluaciones_riesgo
       (id, usuario_id, calculado_en, version_modelo, puntaje, puntaje_base, nivel, confianza, cobertura, detalle, disparado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      usuarioId,
      resultado.calculadoEn,
      version,
      resultado.puntaje,
      resultado.puntajeBase,
      resultado.nivel,
      resultado.confianza,
      resultado.cobertura,
      JSON.stringify({
        componentes: resultado.componentes,
        modificadores: resultado.modificadores,
        banderas: resultado.banderas,
        factores: resultado.factores,
        tendencia: resultado.tendencia,
        senales: resultado.senales,
        lineasBase,
      }),
      disparadoPor,
    ],
  )

  const alertas = await evaluarAlertas({
    usuarioId,
    resultado,
    evaluacionId: id,
    lineasBase,
    mediciones,
    ahora,
  })

  return { id, version, resultado, alertas, lineasBase }
}

export async function estrategiasSugeridas(resultado) {
  const dominiosElevados = resultado.componentes
    .filter((componente) => componente.vigente && componente.normalizado >= 60)
    .map((componente) => componente.dominio)
  const orden = ['bajo', 'moderado', 'alto', 'critico']
  const filas = await consultar('SELECT * FROM estrategias_mitigacion WHERE activa ORDER BY orden')
  return filas
    .filter(
      (fila) =>
        orden.indexOf(resultado.nivel) >= orden.indexOf(fila.nivel_objetivo) &&
        (fila.dominio === '' || dominiosElevados.includes(fila.dominio)),
    )
    .map((fila) => ({
      id: fila.id,
      titulo: fila.titulo,
      descripcion: fila.descripcion,
      nivelObjetivo: fila.nivel_objetivo,
      dominio: fila.dominio,
      acciones: fila.acciones,
      reevaluarDias: fila.reevaluar_dias,
      escalamiento: fila.escalamiento,
      requiereValidacion: fila.requiere_validacion,
    }))
}
