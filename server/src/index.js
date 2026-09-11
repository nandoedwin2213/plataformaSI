import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { autenticar, exigirRol, firmarToken, puedeVerTodo } from './auth.js'
import {
  consultar,
  inicializarDatos,
  leerAjustes,
  nuevoId,
  pool,
  registrarAuditoria,
  unaFila,
} from './db.js'

await inicializarDatos()

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const PUERTO = Number(process.env.PORT ?? process.env.PUERTO ?? 3001)

function asincrono(manejador) {
  return (peticion, respuesta, siguiente) =>
    Promise.resolve(manejador(peticion, respuesta, siguiente)).catch(siguiente)
}

function usuarioPublico(fila) {
  return {
    id: fila.id,
    usuario: fila.usuario,
    nombre: fila.nombre,
    grado: fila.grado,
    unidad: fila.unidad,
    rol: fila.rol,
    activo: Boolean(fila.activo),
    perfil: JSON.parse(fila.perfil),
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
  '/api/sesion',
  asincrono(async (peticion, respuesta) => {
    const { usuario, clave } = peticion.body ?? {}
    if (typeof usuario !== 'string' || typeof clave !== 'string') {
      return respuesta.status(400).json({ error: 'Usuario y contraseña requeridos' })
    }
    const fila = await unaFila('SELECT * FROM usuarios WHERE lower(usuario) = lower($1)', [usuario.trim()])
    if (!fila || !fila.activo || !bcrypt.compareSync(clave, fila.clave_hash)) {
      await registrarAuditoria(fila?.id ?? null, 'login_fallido', usuario)
      return respuesta.status(401).json({ error: 'Credenciales inválidas' })
    }
    await registrarAuditoria(fila.id, 'login', '')
    return respuesta.json({ token: firmarToken(fila), usuario: usuarioPublico(fila) })
  }),
)

app.get(
  '/api/sesion',
  asincrono(autenticar),
  asincrono(async (peticion, respuesta) => respuesta.json(usuarioPublico(peticion.usuario))),
)

app.get(
  '/api/usuarios',
  asincrono(autenticar),
  asincrono(async (peticion, respuesta) => {
    const filas = puedeVerTodo(peticion.usuario)
      ? await consultar('SELECT * FROM usuarios ORDER BY nombre')
      : [peticion.usuario]
    respuesta.json(filas.map(usuarioPublico))
  }),
)

app.post(
  '/api/usuarios',
  asincrono(autenticar),
  exigirRol('operaciones', 'admin'),
  asincrono(async (peticion, respuesta) => {
    const { usuario, clave, nombre, grado, unidad, rol, perfil } = peticion.body ?? {}
    if (!usuario?.trim() || !clave || !nombre?.trim()) {
      return respuesta.status(400).json({ error: 'Usuario, contraseña y nombre son obligatorios' })
    }
    if (!['piloto', 'medico', 'operaciones', 'admin'].includes(rol)) {
      return respuesta.status(400).json({ error: 'Rol inválido' })
    }
    if (rol === 'admin' && peticion.usuario.rol !== 'admin') {
      return respuesta.status(403).json({ error: 'Solo un administrador puede crear administradores' })
    }
    const existe = await unaFila('SELECT 1 FROM usuarios WHERE lower(usuario) = lower($1)', [usuario.trim()])
    if (existe) return respuesta.status(409).json({ error: 'Ese nombre de usuario ya existe' })

    const id = nuevoId()
    await pool.query(
      `INSERT INTO usuarios (id, usuario, clave_hash, nombre, grado, unidad, rol, activo, perfil, creado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9)`,
      [
        id,
        usuario.trim(),
        bcrypt.hashSync(clave, 10),
        nombre.trim(),
        grado ?? '',
        unidad ?? '',
        rol,
        JSON.stringify(perfil ?? {}),
        new Date().toISOString(),
      ],
    )
    await registrarAuditoria(peticion.usuario.id, 'alta_usuario', usuario.trim())
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
    const esGestor = ['operaciones', 'admin'].includes(peticion.usuario.rol)
    if (!esPropio && !esGestor) return respuesta.status(403).json({ error: 'No autorizado' })

    const { nombre, grado, unidad, rol, activo, perfil, clave } = peticion.body ?? {}
    const cambios = {
      nombre: nombre?.trim() || destino.nombre,
      grado: grado ?? destino.grado,
      unidad: unidad ?? destino.unidad,
      perfil: perfil ? JSON.stringify(perfil) : destino.perfil,
      rol: esGestor && rol ? rol : destino.rol,
      activo: esGestor && typeof activo === 'boolean' ? activo : destino.activo,
    }
    await pool.query(
      'UPDATE usuarios SET nombre = $1, grado = $2, unidad = $3, perfil = $4, rol = $5, activo = $6 WHERE id = $7',
      [cambios.nombre, cambios.grado, cambios.unidad, cambios.perfil, cambios.rol, cambios.activo, destino.id],
    )

    if (clave && (esPropio || peticion.usuario.rol === 'admin')) {
      await pool.query('UPDATE usuarios SET clave_hash = $1 WHERE id = $2', [
        bcrypt.hashSync(clave, 10),
        destino.id,
      ])
    }
    await registrarAuditoria(peticion.usuario.id, 'edita_usuario', destino.usuario)
    const actualizado = await unaFila('SELECT * FROM usuarios WHERE id = $1', [destino.id])
    return respuesta.json(usuarioPublico(actualizado))
  }),
)

app.delete(
  '/api/usuarios/:id',
  asincrono(autenticar),
  exigirRol('admin'),
  asincrono(async (peticion, respuesta) => {
    if (peticion.params.id === peticion.usuario.id) {
      return respuesta.status(400).json({ error: 'No puedes eliminar tu propia cuenta' })
    }
    await pool.query('DELETE FROM usuarios WHERE id = $1', [peticion.params.id])
    await registrarAuditoria(peticion.usuario.id, 'baja_usuario', peticion.params.id)
    return respuesta.status(204).end()
  }),
)

app.get(
  '/api/checkins',
  asincrono(autenticar),
  asincrono(async (peticion, respuesta) => {
    const filas = puedeVerTodo(peticion.usuario)
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
  asincrono(async (peticion, respuesta) => {
    const cuerpo = peticion.body ?? {}
    const fecha = typeof cuerpo.fecha === 'string' ? cuerpo.fecha : new Date().toISOString().slice(0, 10)

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
    const filas = puedeVerTodo(peticion.usuario)
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
  asincrono(async (peticion, respuesta) => {
    const { evaluacion, resultado, usuarioId } = peticion.body ?? {}
    if (!evaluacion || !resultado) {
      return respuesta.status(400).json({ error: 'Evaluación y resultado son obligatorios' })
    }
    const destino = puedeVerTodo(peticion.usuario) && usuarioId ? usuarioId : peticion.usuario.id
    const existe = await unaFila('SELECT 1 FROM usuarios WHERE id = $1', [destino])
    if (!existe) return respuesta.status(400).json({ error: 'Usuario destino inexistente' })

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
    if (!esPropio && !['medico', 'admin'].includes(peticion.usuario.rol)) {
      return respuesta.status(403).json({ error: 'No autorizado' })
    }
    await pool.query('DELETE FROM registros WHERE id = $1', [fila.id])
    await registrarAuditoria(peticion.usuario.id, 'elimina_evaluacion', fila.id)
    return respuesta.status(204).end()
  }),
)

app.get(
  '/api/ajustes',
  asincrono(autenticar),
  asincrono(async (_peticion, respuesta) => respuesta.json(await leerAjustes())),
)

app.put(
  '/api/ajustes',
  asincrono(autenticar),
  exigirRol('admin'),
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
  exigirRol('admin'),
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

app.post(
  '/api/reiniciar',
  asincrono(autenticar),
  exigirRol('admin'),
  asincrono(async (peticion, respuesta) => {
    const administrador = peticion.usuario.usuario
    await pool.query('TRUNCATE registros, checkins, auditoria, usuarios RESTART IDENTITY CASCADE')
    await pool.query('DELETE FROM ajustes')
    await inicializarDatos()
    const nuevoAdmin = await unaFila('SELECT id FROM usuarios WHERE usuario = $1', [administrador])
    await registrarAuditoria(
      nuevoAdmin?.id ?? null,
      'reinicio',
      'Base restaurada a datos de demostración',
    )
    respuesta.json({ estado: 'reiniciado' })
  }),
)

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

app.listen(PUERTO, () => {
  console.log(`API de fatiga escuchando en el puerto ${PUERTO}`)
})
