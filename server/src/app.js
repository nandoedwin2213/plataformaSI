import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import {
  autenticar,
  esAdministrador,
  exigirAdministrador,
  exigirEvaluado,
  firmarToken,
} from './auth.js'
import { rutasInstrumentos } from './instrumentos.js'
import { rutasPanel } from './panel.js'
import { recalcularRiesgo } from './servicioRiesgo.js'
import {
  baseLista,
  consultar,
  esCorreoAdmin,
  leerAjustes,
  reiniciarInicializacion,
  nuevoId,
  pool,
  registrarAuditoria,
  unaFila,
} from './db.js'
import {
  MINUTOS_VIGENCIA,
  crearCodigo,
  esCorreoDePrueba,
  limiteAlcanzado,
  limpiarCodigosVencidos,
  normalizarCorreo,
  solicitudesRecientes,
  usuarioPorCorreo,
  validarCodigo,
} from './accesoCorreo.js'
import { correoConfigurado, enviarCodigo } from './correo.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use((_peticion, _respuesta, siguiente) => {
  baseLista().then(() => siguiente(), siguiente)
})

function asincrono(manejador) {
  return (peticion, respuesta, siguiente) =>
    Promise.resolve(manejador(peticion, respuesta, siguiente)).catch(siguiente)
}

const perfilPorDefecto = {
  nombres: '',
  apellidos: '',
  cedula: '',
  fechaNacimiento: '',
  pesoKg: 75,
  tallaCm: 172,
  antecedentes: [],
  antecedentesOtros: '',
  funcionPrincipal: '',
  funcionSecundaria: '',
  cargoPrincipal: '',
  cargoAdicional: '',
}

function perfilCompleto(crudo) {
  let guardado = {}
  try {
    guardado = JSON.parse(crudo ?? '{}') ?? {}
  } catch {
    guardado = {}
  }
  const perfil = { ...perfilPorDefecto, ...guardado }
  if (!Array.isArray(perfil.antecedentes)) perfil.antecedentes = []
  return perfil
}

function usuarioPublico(fila) {
  return {
    id: fila.id,
    usuario: fila.usuario,
    correo: fila.correo ?? '',
    nombre: fila.nombre,
    grado: fila.grado,
    unidad: fila.unidad,
    rol: fila.rol,
    activo: Boolean(fila.activo),
    perfil: perfilCompleto(fila.perfil),
    creadoEn: fila.creado_en,
  }
}

function checkinPublico(fila) {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    fecha: fila.fecha,
    creadoEn: fila.creado_en,
    horasSueno: fila.horas_sueno,
    horasDespierto: fila.horas_despierto,
    kss: fila.kss,
    samnPerelli: fila.samn_perelli,
    vueloProgramado: Boolean(fila.vuelo_programado),
    vueloNocturno: Boolean(fila.vuelo_nocturno),
    notas: fila.notas,
    puntaje: fila.puntaje,
    nivel: fila.nivel,
  }
}

function registroPublico(fila) {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    creadoEn: fila.creado_en,
    evaluacion: JSON.parse(fila.evaluacion),
    resultado: JSON.parse(fila.resultado),
  }
}

app.get(
  '/api/salud',
  asincrono(async (_peticion, respuesta) => {
    await pool.query('SELECT 1')
    respuesta.json({ estado: 'ok' })
  }),
)

app.post(
  '/api/acceso/codigo',
  asincrono(async (peticion, respuesta) => {
    const correo = normalizarCorreo(peticion.body?.correo)
    const modo = peticion.body?.modo === 'admin' ? 'admin' : 'evaluado'
    if (!correo) return respuesta.status(400).json({ error: 'Correo electrónico inválido' })

    if (modo === 'admin' && !esCorreoAdmin(correo)) {
      await registrarAuditoria(null, 'acceso_admin_denegado', '')
      return respuesta.status(403).json({ error: 'Ese correo no está autorizado como administrador' })
    }
    if (modo === 'evaluado' && esCorreoAdmin(correo)) {
      return respuesta
        .status(400)
        .json({ error: 'Ese correo corresponde al administrador; ingresa por la opción de administrador' })
    }

    const existente = await unaFila('SELECT activo FROM usuarios WHERE lower(correo) = $1', [correo])
    if (existente && !existente.activo) {
      return respuesta.status(403).json({ error: 'Esta cuenta está desactivada' })
    }

    if (limiteAlcanzado(await solicitudesRecientes(correo))) {
      return respuesta
        .status(429)
        .json({ error: 'Demasiadas solicitudes de código; espera unos minutos antes de reintentar' })
    }

    const rol = esCorreoAdmin(correo) ? 'admin' : 'evaluado'
    const codigo = await crearCodigo(correo, rol)
    await limpiarCodigosVencidos()

    if (esCorreoDePrueba(correo)) {
      await registrarAuditoria(null, 'codigo_prueba', '')
      return respuesta.json({ enviado: false, minutos: MINUTOS_VIGENCIA, codigo })
    }

    if (!correoConfigurado()) {
      return respuesta.status(503).json({ error: 'El envío de códigos no está configurado en el servidor' })
    }

    try {
      await enviarCodigo(correo, codigo, MINUTOS_VIGENCIA)
    } catch (error) {
      console.error('Fallo al enviar el código de acceso:', error.message)
      return respuesta.status(502).json({ error: 'No se pudo enviar el código; intenta nuevamente' })
    }

    await registrarAuditoria(null, 'codigo_enviado', rol)
    return respuesta.json({ enviado: true, minutos: MINUTOS_VIGENCIA })
  }),
)

app.post(
  '/api/acceso/verificar',
  asincrono(async (peticion, respuesta) => {
    const correo = normalizarCorreo(peticion.body?.correo)
    const codigo = typeof peticion.body?.codigo === 'string' ? peticion.body.codigo.trim() : ''
    if (!correo) return respuesta.status(400).json({ error: 'Correo electrónico inválido' })

    const resultado = await validarCodigo(correo, codigo)
    if (resultado.error) {
      await registrarAuditoria(null, 'acceso_fallido', '')
      return respuesta.status(401).json({ error: resultado.error })
    }

    const usuario = await usuarioPorCorreo(correo)
    if (!usuario.activo) return respuesta.status(403).json({ error: 'Esta cuenta está desactivada' })

    await registrarAuditoria(usuario.id, 'acceso', usuario.rol)
    return respuesta.json({ token: await firmarToken(usuario), usuario: usuarioPublico(usuario) })
  }),
)

app.get(
  '/api/sesion',
  asincrono(autenticar),
  asincrono(async (peticion, respuesta) => respuesta.json(usuarioPublico(peticion.usuario))),
)

app.post(
  '/api/salir',
  asincrono(autenticar),
  asincrono(async (peticion, respuesta) => {
    await registrarAuditoria(peticion.usuario.id, 'cierre_sesion', '')
    respuesta.status(204).end()
  }),
)

app.get(
  '/api/usuarios',
  asincrono(autenticar),
  asincrono(async (peticion, respuesta) => {
    const filas = esAdministrador(peticion.usuario)
      ? await consultar('SELECT * FROM usuarios ORDER BY nombre')
      : [peticion.usuario]
    respuesta.json(filas.map(usuarioPublico))
  }),
)

app.post(
  '/api/usuarios',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const { nombre, grado, unidad, perfil } = peticion.body ?? {}
    const correo = normalizarCorreo(peticion.body?.correo)
    if (!correo) return respuesta.status(400).json({ error: 'Correo electrónico inválido' })
    if (esCorreoAdmin(correo)) {
      return respuesta.status(403).json({ error: 'El correo del administrador ya está reservado' })
    }
    if (!nombre?.trim()) return respuesta.status(400).json({ error: 'El nombre es obligatorio' })

    const existe = await unaFila('SELECT 1 FROM usuarios WHERE lower(correo) = $1', [correo])
    if (existe) return respuesta.status(409).json({ error: 'Ese correo ya está registrado' })

    const id = nuevoId()
    await pool.query(
      `INSERT INTO usuarios (id, usuario, clave_hash, correo, nombre, grado, unidad, rol, activo, perfil, creado_en)
       VALUES ($1,$2,NULL,$3,$4,$5,$6,'evaluado',TRUE,$7,$8)`,
      [
        id,
        correo,
        correo,
        nombre.trim(),
        grado ?? '',
        unidad ?? '',
        JSON.stringify(perfil ?? {}),
        new Date().toISOString(),
      ],
    )
    await registrarAuditoria(peticion.usuario.id, 'alta_usuario', id)
    const creado = await unaFila('SELECT * FROM usuarios WHERE id = $1', [id])
    return respuesta.status(201).json(usuarioPublico(creado))
  }),
)

app.put(
  '/api/usuarios/:id',
  asincrono(autenticar),
  asincrono(async (peticion, respuesta) => {
    const destino = await unaFila('SELECT * FROM usuarios WHERE id = $1', [peticion.params.id])
    if (!destino) return respuesta.status(404).json({ error: 'Usuario no encontrado' })

    const esPropio = destino.id === peticion.usuario.id
    const esGestor = esAdministrador(peticion.usuario)
    if (!esPropio && !esGestor) return respuesta.status(403).json({ error: 'No autorizado' })

    const { nombre, grado, unidad, activo, perfil } = peticion.body ?? {}
    const cambios = {
      nombre: nombre?.trim() || destino.nombre,
      grado: typeof grado === 'string' ? grado.slice(0, 80) : destino.grado,
      unidad: typeof unidad === 'string' ? unidad.slice(0, 120) : destino.unidad,
      perfil: perfil ? JSON.stringify(perfil) : destino.perfil,
      activo:
        esGestor && typeof activo === 'boolean' && destino.rol !== 'admin' ? activo : destino.activo,
    }
    await pool.query(
      'UPDATE usuarios SET nombre = $1, grado = $2, unidad = $3, perfil = $4, activo = $5 WHERE id = $6',
      [cambios.nombre, cambios.grado, cambios.unidad, cambios.perfil, cambios.activo, destino.id],
    )
    await registrarAuditoria(peticion.usuario.id, 'edita_usuario', destino.id)
    const actualizado = await unaFila('SELECT * FROM usuarios WHERE id = $1', [destino.id])
    return respuesta.json(usuarioPublico(actualizado))
  }),
)

app.delete(
  '/api/usuarios/:id',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    if (peticion.params.id === peticion.usuario.id) {
      return respuesta.status(400).json({ error: 'No puedes eliminar tu propia cuenta' })
    }
    await pool.query("DELETE FROM usuarios WHERE id = $1 AND rol <> 'admin'", [peticion.params.id])
    await registrarAuditoria(peticion.usuario.id, 'baja_usuario', peticion.params.id)
    return respuesta.status(204).end()
  }),
)

app.get(
  '/api/checkins',
  asincrono(autenticar),
  asincrono(async (peticion, respuesta) => {
    const filas = esAdministrador(peticion.usuario)
      ? await consultar('SELECT * FROM checkins ORDER BY fecha DESC')
      : await consultar('SELECT * FROM checkins WHERE usuario_id = $1 ORDER BY fecha DESC', [
          peticion.usuario.id,
        ])
    respuesta.json(filas.map(checkinPublico))
  }),
)

app.post(
  '/api/checkins',
  asincrono(autenticar),
  exigirEvaluado,
  asincrono(async (peticion, respuesta) => {
    const cuerpo = peticion.body ?? {}
    const hoy = new Date().toISOString().slice(0, 10)
    const fecha = typeof cuerpo.fecha === 'string' ? cuerpo.fecha : hoy
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return respuesta.status(400).json({ error: 'Fecha inválida' })
    }
    if (fecha > hoy) {
      return respuesta.status(400).json({ error: 'No se pueden registrar check-ins con fecha futura' })
    }

    await pool.query(
      `INSERT INTO checkins
         (id, usuario_id, fecha, creado_en, horas_sueno, horas_despierto, kss, samn_perelli,
          vuelo_programado, vuelo_nocturno, notas, puntaje, nivel)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (usuario_id, fecha) DO UPDATE SET
         creado_en = excluded.creado_en,
         horas_sueno = excluded.horas_sueno,
         horas_despierto = excluded.horas_despierto,
         kss = excluded.kss,
         samn_perelli = excluded.samn_perelli,
         vuelo_programado = excluded.vuelo_programado,
         vuelo_nocturno = excluded.vuelo_nocturno,
         notas = excluded.notas,
         puntaje = excluded.puntaje,
         nivel = excluded.nivel`,
      [
        nuevoId(),
        peticion.usuario.id,
        fecha,
        new Date().toISOString(),
        Number(cuerpo.horasSueno ?? 0),
        Number(cuerpo.horasDespierto ?? 0),
        Number(cuerpo.kss ?? 1),
        Number(cuerpo.samnPerelli ?? 1),
        Boolean(cuerpo.vueloProgramado),
        Boolean(cuerpo.vueloNocturno),
        String(cuerpo.notas ?? ''),
        Number(cuerpo.puntaje ?? 0),
        String(cuerpo.nivel ?? 'bajo'),
      ],
    )
    await registrarAuditoria(peticion.usuario.id, 'checkin', fecha)
    await recalcularRiesgo(peticion.usuario.id, 'registro_diario')
    const fila = await unaFila('SELECT * FROM checkins WHERE usuario_id = $1 AND fecha = $2', [
      peticion.usuario.id,
      fecha,
    ])
    respuesta.status(201).json(checkinPublico(fila))
  }),
)

app.get(
  '/api/registros',
  asincrono(autenticar),
  asincrono(async (peticion, respuesta) => {
    const filas = esAdministrador(peticion.usuario)
      ? await consultar('SELECT * FROM registros ORDER BY creado_en DESC')
      : await consultar('SELECT * FROM registros WHERE usuario_id = $1 ORDER BY creado_en DESC', [
          peticion.usuario.id,
        ])
    respuesta.json(filas.map(registroPublico))
  }),
)

app.post(
  '/api/registros',
  asincrono(autenticar),
  exigirEvaluado,
  asincrono(async (peticion, respuesta) => {
    const { evaluacion, resultado } = peticion.body ?? {}
    if (!evaluacion || !resultado) {
      return respuesta.status(400).json({ error: 'Evaluación y resultado son obligatorios' })
    }
    const destino = peticion.usuario.id

    const id = nuevoId()
    await pool.query(
      'INSERT INTO registros (id, usuario_id, creado_en, evaluacion, resultado) VALUES ($1,$2,$3,$4,$5)',
      [id, destino, new Date().toISOString(), JSON.stringify(evaluacion), JSON.stringify(resultado)],
    )
    await registrarAuditoria(peticion.usuario.id, 'evaluacion', destino)
    const creado = await unaFila('SELECT * FROM registros WHERE id = $1', [id])
    return respuesta.status(201).json(registroPublico(creado))
  }),
)

app.delete(
  '/api/registros/:id',
  asincrono(autenticar),
  asincrono(async (peticion, respuesta) => {
    const fila = await unaFila('SELECT * FROM registros WHERE id = $1', [peticion.params.id])
    if (!fila) return respuesta.status(404).json({ error: 'Registro no encontrado' })
    const esPropio = fila.usuario_id === peticion.usuario.id
    if (!esPropio && !esAdministrador(peticion.usuario)) {
      return respuesta.status(403).json({ error: 'No autorizado' })
    }
    await pool.query('DELETE FROM registros WHERE id = $1', [fila.id])
    await registrarAuditoria(peticion.usuario.id, 'elimina_evaluacion', fila.id)
    return respuesta.status(204).end()
  }),
)

// El evaluado solo recibe los parámetros necesarios para calcular y mostrar su propio resultado;
// la configuración institucional completa queda reservada al administrador.
app.get(
  '/api/ajustes',
  asincrono(autenticar),
  asincrono(async (peticion, respuesta) => {
    const ajustes = await leerAjustes()
    if (esAdministrador(peticion.usuario)) return respuesta.json(ajustes)
    return respuesta.json({
      institucion: ajustes.institucion,
      umbrales: ajustes.umbrales,
      jornadaReferencia: ajustes.jornadaReferencia,
    })
  }),
)

app.put(
  '/api/ajustes',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    const actuales = await leerAjustes()
    const nuevos = { ...actuales, ...(peticion.body ?? {}) }
    const { moderado, alto, critico } = nuevos.umbrales ?? {}
    if (!(moderado < alto && alto < critico)) {
      return respuesta.status(400).json({ error: 'Los umbrales deben ser crecientes' })
    }
    await pool.query('UPDATE ajustes SET datos = $1 WHERE id = 1', [JSON.stringify(nuevos)])
    await registrarAuditoria(peticion.usuario.id, 'ajustes', '')
    return respuesta.json(nuevos)
  }),
)

app.get(
  '/api/auditoria',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (_peticion, respuesta) => {
    const filas = await consultar('SELECT * FROM auditoria ORDER BY creado_en DESC LIMIT 200')
    respuesta.json(
      filas.map((fila) => ({
        id: fila.id,
        usuarioId: fila.usuario_id,
        accion: fila.accion,
        detalle: fila.detalle,
        creadoEn: fila.creado_en,
      })),
    )
  }),
)

// Borrado institucional de la información del personal evaluado. Conserva la cuenta
// administrativa, los instrumentos, el modelo de riesgo, las estrategias y los parámetros.
app.post(
  '/api/admin/datos/reiniciar',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (peticion, respuesta) => {
    if (peticion.body?.confirmacion !== 'BORRAR DATOS') {
      return respuesta.status(400).json({ error: 'Confirmación inválida' })
    }

    const { total: evaluados } = await unaFila(
      "SELECT COUNT(*)::int AS total FROM usuarios WHERE rol = 'evaluado'",
    )
    const { total: aplicaciones } = await unaFila(
      `SELECT COUNT(*)::int AS total FROM respuestas_instrumento r
       JOIN usuarios u ON u.id = r.usuario_id WHERE u.rol = 'evaluado'`,
    )
    const { total: checkins } = await unaFila(
      `SELECT COUNT(*)::int AS total FROM checkins c
       JOIN usuarios u ON u.id = c.usuario_id WHERE u.rol = 'evaluado'`,
    )

    const cliente = await pool.connect()
    try {
      await cliente.query('BEGIN')
      await cliente.query("DELETE FROM usuarios WHERE rol = 'evaluado'")
      await cliente.query("DELETE FROM codigos_acceso WHERE rol = 'evaluado'")
      await cliente.query('COMMIT')
    } catch (error) {
      await cliente.query('ROLLBACK')
      throw error
    } finally {
      cliente.release()
    }

    await registrarAuditoria(
      peticion.usuario.id,
      'reinicio_datos_evaluados',
      `${evaluados} evaluados, ${aplicaciones} aplicaciones, ${checkins} check-ins`,
    )
    return respuesta.json({ evaluados, aplicaciones, checkins })
  }),
)

app.post(
  '/api/reiniciar',
  asincrono(autenticar),
  exigirAdministrador,
  asincrono(async (_peticion, respuesta) => {
    await pool.query(
      `TRUNCATE registros, checkins, auditoria, usuarios, codigos_acceso,
                respuestas_instrumento, preguntas, instrumentos, evaluaciones_riesgo,
                lineas_base, alertas, reglas_alerta, estrategias_mitigacion, modelos_riesgo
                RESTART IDENTITY CASCADE`,
    )
    await pool.query('DELETE FROM ajustes')
    reiniciarInicializacion()
    await baseLista()
    const nuevoAdmin = await unaFila("SELECT id FROM usuarios WHERE rol = 'admin'")
    await registrarAuditoria(
      nuevoAdmin?.id ?? null,
      'reinicio',
      'Base restaurada a datos de demostración',
    )
    respuesta.json({ estado: 'reiniciado' })
  }),
)

app.use(rutasInstrumentos)
app.use(rutasPanel)

const raizProyecto = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const carpetaEstatica = path.join(raizProyecto, 'dist')
if (fs.existsSync(carpetaEstatica)) {
  app.use(express.static(carpetaEstatica))
  app.get(/^(?!\/api\/).*/, (_peticion, respuesta) =>
    respuesta.sendFile(path.join(carpetaEstatica, 'index.html')),
  )
}

app.use((error, _peticion, respuesta, _siguiente) => {
  console.error(error)
  respuesta.status(500).json({ error: 'Error interno del servidor' })
})

export default app
