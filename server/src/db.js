import { randomUUID } from 'node:crypto'
import crypto from 'node:crypto'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const cadena = process.env.DATABASE_URL
if (!cadena) {
  throw new Error('Falta DATABASE_URL con la cadena de conexión de PostgreSQL')
}

export const pool = new pg.Pool({
  connectionString: cadena,
  ssl: cadena.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
  max: Number(process.env.PG_MAX_CONEXIONES ?? 5),
})

export async function consultar(sql, parametros = []) {
  const { rows } = await pool.query(sql, parametros)
  return rows
}

export async function unaFila(sql, parametros = []) {
  const filas = await consultar(sql, parametros)
  return filas[0] ?? null
}

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

export async function crearEsquema() {
  await pool.query(`
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  usuario TEXT NOT NULL UNIQUE,
  clave_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  grado TEXT NOT NULL,
  unidad TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('piloto','medico','operaciones','admin')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  perfil TEXT NOT NULL DEFAULT '{}',
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  creado_en TEXT NOT NULL,
  horas_sueno DOUBLE PRECISION NOT NULL,
  horas_despierto DOUBLE PRECISION NOT NULL,
  kss INTEGER NOT NULL,
  samn_perelli INTEGER NOT NULL,
  vuelo_programado BOOLEAN NOT NULL,
  vuelo_nocturno BOOLEAN NOT NULL,
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

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkins_usuario ON checkins(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_registros_usuario ON registros(usuario_id, creado_en);
`)
}

export async function registrarAuditoria(usuarioId, accion, detalle = '') {
  await pool.query(
    'INSERT INTO auditoria (id, usuario_id, accion, detalle, creado_en) VALUES ($1,$2,$3,$4,$5)',
    [randomUUID(), usuarioId, accion, detalle, new Date().toISOString()],
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

async function sembrarCheckins(usuarioId, semilla) {
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
    const puntaje = puntajeCheckin({ horasSueno, horasDespierto, kss, samnPerelli, vueloNocturno })
    await pool.query(
      `INSERT INTO checkins
         (id, usuario_id, fecha, creado_en, horas_sueno, horas_despierto, kss, samn_perelli,
          vuelo_programado, vuelo_nocturno, notas, puntaje, nivel)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (usuario_id, fecha) DO NOTHING`,
      [
        randomUUID(),
        usuarioId,
        dia,
        fecha.toISOString(),
        horasSueno,
        horasDespierto,
        kss,
        samnPerelli,
        true,
        vueloNocturno,
        '',
        puntaje,
        nivelPorPuntaje(puntaje),
      ],
    )
  }
}

export async function inicializarDatos() {
  await crearEsquema()

  await pool.query('INSERT INTO ajustes (id, datos) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [
    JSON.stringify(ajustesPorDefecto),
  ])

  const { total } = await unaFila('SELECT COUNT(*)::int AS total FROM usuarios')
  if (total > 0) return

  for (const [indice, demo] of usuariosDemo.entries()) {
    const id = randomUUID()
    await pool.query(
      `INSERT INTO usuarios (id, usuario, clave_hash, nombre, grado, unidad, rol, activo, perfil, creado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9)`,
      [
        id,
        demo.usuario,
        bcrypt.hashSync(demo.clave, 10),
        demo.nombre,
        demo.grado,
        demo.unidad,
        demo.rol,
        JSON.stringify(demo.perfil),
        new Date().toISOString(),
      ],
    )
    if (demo.rol === 'piloto') await sembrarCheckins(id, indice + 1)
  }
  await registrarAuditoria(null, 'semilla', 'Datos de demostración creados')
}

let inicializacion = null

export function baseLista() {
  if (!inicializacion) inicializacion = inicializarDatos()
  return inicializacion
}

export function reiniciarInicializacion() {
  inicializacion = null
}

export async function leerAjustes() {
  const fila = await unaFila('SELECT datos FROM ajustes WHERE id = 1')
  return fila ? JSON.parse(fila.datos) : ajustesPorDefecto
}

export async function secretoJwt() {
  if (process.env.JWT_SECRETO) return process.env.JWT_SECRETO
  await crearEsquema()
  const generado = crypto.randomBytes(48).toString('hex')
  await pool.query(
    "INSERT INTO configuracion (clave, valor) VALUES ('jwt_secreto', $1) ON CONFLICT (clave) DO NOTHING",
    [generado],
  )
  const fila = await unaFila("SELECT valor FROM configuracion WHERE clave = 'jwt_secreto'")
  return fila.valor
}

export function nuevoId() {
  return randomUUID()
}
