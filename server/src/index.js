import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { autenticar, exigirRol, firmarToken, puedeVerTodo } from './auth.js'
import { db, inicializarDatos, leerAjustes, nuevoId, registrarAuditoria } from './db.js'

inicializarDatos()

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const PUERTO = Number(process.env.PUERTO ?? 3001)

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

app.get('/api/salud', (_peticion, respuesta) => respuesta.json({ estado: 'ok' }))

app.post('/api/sesion', (peticion, respuesta) => {
  const { usuario, clave } = peticion.body ?? {}
  if (typeof usuario !== 'string' || typeof clave !== 'string') {
    return respuesta.status(400).json({ error: 'Usuario y contraseña requeridos' })
  }
  const fila = db
    .prepare('SELECT * FROM usuarios WHERE lower(usuario) = lower(?)')
    .get(usuario.trim())
  if (!fila || !fila.activo || !bcrypt.compareSync(clave, fila.clave_hash)) {
    registrarAuditoria(fila?.id ?? null, 'login_fallido', usuario)
    return respuesta.status(401).json({ error: 'Credenciales inválidas' })
  }
  registrarAuditoria(fila.id, 'login', '')
  return respuesta.json({ token: firmarToken(fila), usuario: usuarioPublico(fila) })
})

app.get('/api/sesion', autenticar, (peticion, respuesta) =>
  respuesta.json(usuarioPublico(peticion.usuario)),
)

app.get('/api/usuarios', autenticar, (peticion, respuesta) => {
  const filas = puedeVerTodo(peticion.usuario)
    ? db.prepare('SELECT * FROM usuarios ORDER BY nombre').all()
    : [peticion.usuario]
  respuesta.json(filas.map(usuarioPublico))
})

app.post('/api/usuarios', autenticar, exigirRol('operaciones', 'admin'), (peticion, respuesta) => {
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
  const existe = db.prepare('SELECT 1 FROM usuarios WHERE lower(usuario) = lower(?)').get(usuario.trim())
  if (existe) return respuesta.status(409).json({ error: 'Ese nombre de usuario ya existe' })

  const id = nuevoId()
  db.prepare(
    `INSERT INTO usuarios (id, usuario, clave_hash, nombre, grado, unidad, rol, activo, perfil, creado_en)
     VALUES (?,?,?,?,?,?,?,1,?,?)`,
  ).run(
    id,
    usuario.trim(),
    bcrypt.hashSync(clave, 10),
    nombre.trim(),
    grado ?? '',
    unidad ?? '',
    rol,
    JSON.stringify(perfil ?? {}),
    new Date().toISOString(),
  )
  registrarAuditoria(peticion.usuario.id, 'alta_usuario', usuario.trim())
  respuesta.status(201).json(usuarioPublico(db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id)))
})

app.put('/api/usuarios/:id', autenticar, (peticion, respuesta) => {
  const destino = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(peticion.params.id)
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
    activo: esGestor && typeof activo === 'boolean' ? Number(activo) : destino.activo,
  }
  db.prepare(
    'UPDATE usuarios SET nombre = ?, grado = ?, unidad = ?, perfil = ?, rol = ?, activo = ? WHERE id = ?',
  ).run(cambios.nombre, cambios.grado, cambios.unidad, cambios.perfil, cambios.rol, cambios.activo, destino.id)

  if (clave && (esPropio || peticion.usuario.rol === 'admin')) {
    db.prepare('UPDATE usuarios SET clave_hash = ? WHERE id = ?').run(bcrypt.hashSync(clave, 10), destino.id)
  }
  registrarAuditoria(peticion.usuario.id, 'edita_usuario', destino.usuario)
  respuesta.json(usuarioPublico(db.prepare('SELECT * FROM usuarios WHERE id = ?').get(destino.id)))
})

app.delete('/api/usuarios/:id', autenticar, exigirRol('admin'), (peticion, respuesta) => {
  if (peticion.params.id === peticion.usuario.id) {
    return respuesta.status(400).json({ error: 'No puedes eliminar tu propia cuenta' })
  }
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(peticion.params.id)
  registrarAuditoria(peticion.usuario.id, 'baja_usuario', peticion.params.id)
  respuesta.status(204).end()
})

app.get('/api/checkins', autenticar, (peticion, respuesta) => {
  const filas = puedeVerTodo(peticion.usuario)
    ? db.prepare('SELECT * FROM checkins ORDER BY fecha DESC').all()
    : db.prepare('SELECT * FROM checkins WHERE usuario_id = ? ORDER BY fecha DESC').all(peticion.usuario.id)
  respuesta.json(filas.map(checkinPublico))
})

app.post('/api/checkins', autenticar, (peticion, respuesta) => {
  const cuerpo = peticion.body ?? {}
  const fecha = typeof cuerpo.fecha === 'string' ? cuerpo.fecha : new Date().toISOString().slice(0, 10)
  const existente = db
    .prepare('SELECT id FROM checkins WHERE usuario_id = ? AND fecha = ?')
    .get(peticion.usuario.id, fecha)
  const id = existente?.id ?? nuevoId()

  db.prepare(
    `INSERT INTO checkins
       (id, usuario_id, fecha, creado_en, horas_sueno, horas_despierto, kss, samn_perelli,
        vuelo_programado, vuelo_nocturno, notas, puntaje, nivel)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
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
  ).run(
    id,
    peticion.usuario.id,
    fecha,
    new Date().toISOString(),
    Number(cuerpo.horasSueno ?? 0),
    Number(cuerpo.horasDespierto ?? 0),
    Number(cuerpo.kss ?? 1),
    Number(cuerpo.samnPerelli ?? 1),
    cuerpo.vueloProgramado ? 1 : 0,
    cuerpo.vueloNocturno ? 1 : 0,
    String(cuerpo.notas ?? ''),
    Number(cuerpo.puntaje ?? 0),
    String(cuerpo.nivel ?? 'bajo'),
  )
  registrarAuditoria(peticion.usuario.id, 'checkin', fecha)
  const fila = db.prepare('SELECT * FROM checkins WHERE usuario_id = ? AND fecha = ?').get(
    peticion.usuario.id,
    fecha,
  )
  respuesta.status(201).json(checkinPublico(fila))
})

app.get('/api/registros', autenticar, (peticion, respuesta) => {
  const filas = puedeVerTodo(peticion.usuario)
    ? db.prepare('SELECT * FROM registros ORDER BY creado_en DESC').all()
    : db
        .prepare('SELECT * FROM registros WHERE usuario_id = ? ORDER BY creado_en DESC')
        .all(peticion.usuario.id)
  respuesta.json(filas.map(registroPublico))
})

app.post('/api/registros', autenticar, (peticion, respuesta) => {
  const { evaluacion, resultado, usuarioId } = peticion.body ?? {}
  if (!evaluacion || !resultado) {
    return respuesta.status(400).json({ error: 'Evaluación y resultado son obligatorios' })
  }
  const destino = puedeVerTodo(peticion.usuario) && usuarioId ? usuarioId : peticion.usuario.id
  const existe = db.prepare('SELECT 1 FROM usuarios WHERE id = ?').get(destino)
  if (!existe) return respuesta.status(400).json({ error: 'Usuario destino inexistente' })

  const id = nuevoId()
  db.prepare(
    'INSERT INTO registros (id, usuario_id, creado_en, evaluacion, resultado) VALUES (?,?,?,?,?)',
  ).run(id, destino, new Date().toISOString(), JSON.stringify(evaluacion), JSON.stringify(resultado))
  registrarAuditoria(peticion.usuario.id, 'evaluacion', destino)
  respuesta.status(201).json(registroPublico(db.prepare('SELECT * FROM registros WHERE id = ?').get(id)))
})

app.delete('/api/registros/:id', autenticar, (peticion, respuesta) => {
  const fila = db.prepare('SELECT * FROM registros WHERE id = ?').get(peticion.params.id)
  if (!fila) return respuesta.status(404).json({ error: 'Registro no encontrado' })
  const esPropio = fila.usuario_id === peticion.usuario.id
  if (!esPropio && !['medico', 'admin'].includes(peticion.usuario.rol)) {
    return respuesta.status(403).json({ error: 'No autorizado' })
  }
  db.prepare('DELETE FROM registros WHERE id = ?').run(fila.id)
  registrarAuditoria(peticion.usuario.id, 'elimina_evaluacion', fila.id)
  respuesta.status(204).end()
})

app.get('/api/ajustes', autenticar, (_peticion, respuesta) => respuesta.json(leerAjustes()))

app.put('/api/ajustes', autenticar, exigirRol('admin'), (peticion, respuesta) => {
  const actuales = leerAjustes()
  const nuevos = { ...actuales, ...(peticion.body ?? {}) }
  const { moderado, alto, critico } = nuevos.umbrales ?? {}
  if (!(moderado < alto && alto < critico)) {
    return respuesta.status(400).json({ error: 'Los umbrales deben ser crecientes' })
  }
  db.prepare('UPDATE ajustes SET datos = ? WHERE id = 1').run(JSON.stringify(nuevos))
  registrarAuditoria(peticion.usuario.id, 'ajustes', '')
  respuesta.json(nuevos)
})

app.get('/api/auditoria', autenticar, exigirRol('admin'), (_peticion, respuesta) => {
  const filas = db.prepare('SELECT * FROM auditoria ORDER BY creado_en DESC LIMIT 200').all()
  respuesta.json(
    filas.map((fila) => ({
      id: fila.id,
      usuarioId: fila.usuario_id,
      accion: fila.accion,
      detalle: fila.detalle,
      creadoEn: fila.creado_en,
    })),
  )
})

app.post('/api/reiniciar', autenticar, exigirRol('admin'), (peticion, respuesta) => {
  db.exec('DELETE FROM registros; DELETE FROM checkins; DELETE FROM usuarios; DELETE FROM ajustes;')
  inicializarDatos()
  registrarAuditoria(peticion.usuario.id, 'reinicio', 'Base restaurada a datos de demostración')
  respuesta.json({ estado: 'reiniciado' })
})

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
  console.log(`API de fatiga escuchando en http://localhost:${PUERTO}`)
})
