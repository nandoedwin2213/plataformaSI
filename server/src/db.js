import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

const RUTA_DATOS = process.env.RUTA_DATOS ?? path.join(process.cwd(), 'datos')
fs.mkdirSync(RUTA_DATOS, { recursive: true })

export const db = new Database(path.join(RUTA_DATOS, 'fatiga.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  usuario TEXT NOT NULL UNIQUE,
  clave_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  grado TEXT NOT NULL,
  unidad TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('piloto','medico','operaciones','admin')),
  activo INTEGER NOT NULL DEFAULT 1,
  perfil TEXT NOT NULL DEFAULT '{}',
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  creado_en TEXT NOT NULL,
  horas_sueno REAL NOT NULL,
  horas_despierto REAL NOT NULL,
  kss INTEGER NOT NULL,
  samn_perelli INTEGER NOT NULL,
  vuelo_programado INTEGER NOT NULL,
  vuelo_nocturno INTEGER NOT NULL,
  notas TEXT NOT NULL DEFAULT '',
  puntaje INTEGER NOT NULL,
  nivel TEXT NOT NULL,
  UNIQUE (usuario_id, fecha)
);

CREATE TABLE IF NOT EXISTS registros (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_en TEXT NOT NULL,
  evaluacion TEXT NOT NULL,
  resultado TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ajustes (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  datos TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auditoria (
  id TEXT PRIMARY KEY,
  usuario_id TEXT,
  accion TEXT NOT NULL,
  detalle TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkins_usuario ON checkins(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_registros_usuario ON registros(usuario_id, creado_en);
`)

export const ajustesPorDefecto = {
  institucion: 'Fuerza Aérea Ecuatoriana',
  unidadPorDefecto: 'Ala de Combate N.º 23',
  umbrales: { moderado: 20, alto: 40, critico: 60 },
  jornadaReferencia: 8,
  alertasActivas: true,
  retencionDias: 365,
}

const perfilVacio = {
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

export function registrarAuditoria(usuarioId, accion, detalle = '') {
  db.prepare('INSERT INTO auditoria (id, usuario_id, accion, detalle, creado_en) VALUES (?,?,?,?,?)').run(
    randomUUID(),
    usuarioId,
    accion,
    detalle,
    new Date().toISOString(),
  )
}

function nivelPorPuntaje(puntaje, umbrales = ajustesPorDefecto.umbrales) {
  if (puntaje >= umbrales.critico) return 'critico'
  if (puntaje >= umbrales.alto) return 'alto'
  if (puntaje >= umbrales.moderado) return 'moderado'
  return 'bajo'
}

function puntajeCheckin({ horasSueno, horasDespierto, kss, samnPerelli, vueloNocturno }) {
  let puntaje = 0
  if (horasSueno < 5) puntaje += 22
  else if (horasSueno < 6) puntaje += 15
  else if (horasSueno < 7) puntaje += 8
  if (horasDespierto > 16) puntaje += 14
  else if (horasDespierto > 12) puntaje += 8
  puntaje += Math.max(0, kss - 3) * 4
  puntaje += Math.max(0, samnPerelli - 2) * 4
  if (vueloNocturno) puntaje += 8
  return Math.min(100, Math.round(puntaje))
}

const usuariosDemo = [
  {
    usuario: 'piloto',
    clave: 'piloto123',
    nombre: 'Vásconez Andrade Luis',
    grado: 'Teniente',
    unidad: 'Ala de Combate N.º 23',
    rol: 'piloto',
    perfil: {
      ...perfilVacio,
      fechaNacimiento: '1992-04-18',
      pesoKg: 78,
      tallaCm: 175,
      funcionPrincipal: 'Piloto de combate',
      funcionSecundaria: 'Instructor de vuelo',
      cargoPrincipal: 'Oficial de operaciones del escuadrón',
      cargoAdicional: 'Oficial de seguridad operacional',
    },
  },
  {
    usuario: 'piloto2',
    clave: 'piloto123',
    nombre: 'Cedeño Ríos María',
    grado: 'Capitán',
    unidad: 'Ala de Transportes N.º 11',
    rol: 'piloto',
    perfil: {
      ...perfilVacio,
      fechaNacimiento: '1989-11-02',
      pesoKg: 62,
      tallaCm: 165,
      funcionPrincipal: 'Piloto de transporte táctico',
      cargoPrincipal: 'Jefa de estandarización',
    },
  },
  {
    usuario: 'operaciones',
    clave: 'ops123',
    nombre: 'Jefe de Operaciones',
    grado: 'Teniente Coronel',
    unidad: 'Ala de Combate N.º 23',
    rol: 'operaciones',
    perfil: { ...perfilVacio, funcionPrincipal: 'Jefatura de operaciones' },
  },
  {
    usuario: 'medico',
    clave: 'med123',
    nombre: 'Médico de Aviación',
    grado: 'Mayor',
    unidad: 'Servicio de Medicina Aeroespacial',
    rol: 'medico',
    perfil: { ...perfilVacio, funcionPrincipal: 'Medicina aeroespacial' },
  },
  {
    usuario: 'admin',
    clave: 'admin123',
    nombre: 'Administrador del sistema',
    grado: 'Coronel',
    unidad: 'Comando de Educación y Doctrina',
    rol: 'admin',
    perfil: { ...perfilVacio, funcionPrincipal: 'Administración de la plataforma' },
  },
]

function sembrarCheckins(usuarioId, semilla) {
  const insertar = db.prepare(
    `INSERT OR IGNORE INTO checkins
     (id, usuario_id, fecha, creado_en, horas_sueno, horas_despierto, kss, samn_perelli,
      vuelo_programado, vuelo_nocturno, notas, puntaje, nivel)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
  for (let indice = 13; indice >= 1; indice -= 1) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - indice)
    const dia = fecha.toISOString().slice(0, 10)
    const onda = Math.sin((indice + semilla) / 2.2)
    const horasSueno = Math.round((6.8 + onda * 1.3) * 10) / 10
    const horasDespierto = Math.round((4 + Math.abs(onda) * 6) * 10) / 10
    const kss = Math.max(1, Math.min(9, Math.round(4 + onda * 2 + semilla * 0.5)))
    const samnPerelli = Math.max(1, Math.min(7, Math.round(3 + onda * 1.5)))
    const vueloNocturno = indice % 7 === semilla % 7
    const datos = { horasSueno, horasDespierto, kss, samnPerelli, vueloNocturno }
    const puntaje = puntajeCheckin(datos)
    insertar.run(
      randomUUID(),
      usuarioId,
      dia,
      fecha.toISOString(),
      horasSueno,
      horasDespierto,
      kss,
      samnPerelli,
      1,
      vueloNocturno ? 1 : 0,
      '',
      puntaje,
      nivelPorPuntaje(puntaje),
    )
  }
}

export function inicializarDatos() {
  const fila = db.prepare('SELECT datos FROM ajustes WHERE id = 1').get()
  if (!fila) {
    db.prepare('INSERT INTO ajustes (id, datos) VALUES (1, ?)').run(JSON.stringify(ajustesPorDefecto))
  }

  const total = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total
  if (total > 0) return

  const insertar = db.prepare(
    `INSERT INTO usuarios (id, usuario, clave_hash, nombre, grado, unidad, rol, activo, perfil, creado_en)
     VALUES (?,?,?,?,?,?,?,1,?,?)`,
  )
  usuariosDemo.forEach((demo, indice) => {
    const id = randomUUID()
    insertar.run(
      id,
      demo.usuario,
      bcrypt.hashSync(demo.clave, 10),
      demo.nombre,
      demo.grado,
      demo.unidad,
      demo.rol,
      JSON.stringify(demo.perfil),
      new Date().toISOString(),
    )
    if (demo.rol === 'piloto') sembrarCheckins(id, indice + 1)
  })
  registrarAuditoria(null, 'semilla', 'Datos de demostración creados')
}

export function leerAjustes() {
  const fila = db.prepare('SELECT datos FROM ajustes WHERE id = 1').get()
  return fila ? JSON.parse(fila.datos) : ajustesPorDefecto
}

export function nuevoId() {
  return randomUUID()
}
