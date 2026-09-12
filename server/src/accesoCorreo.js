import crypto from 'node:crypto'
import {
  CORREO_ADMIN,
  asegurarAdministrador,
  esCorreoAdmin,
  nuevoId,
  pool,
  registrarAuditoria,
  unaFila,
} from './db.js'

export const MINUTOS_VIGENCIA = 10
const MAX_INTENTOS = 5
const MAX_CODIGOS_POR_CORREO = 3
const VENTANA_MINUTOS = 15

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

export function normalizarCorreo(valor) {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim().toLowerCase()
  if (limpio.length > 254 || !PATRON_CORREO.test(limpio)) return null
  return limpio
}

function correosDePrueba() {
  return (process.env.CORREOS_PRUEBA ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item && item !== CORREO_ADMIN)
}

export function esCorreoDePrueba(correo) {
  return correosDePrueba().includes(correo)
}

function hashear(codigo) {
  return crypto.createHash('sha256').update(codigo).digest('hex')
}

function generarCodigo() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

export async function solicitudesRecientes(correo) {
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60_000).toISOString()
  const fila = await unaFila(
    'SELECT COUNT(*)::int AS total FROM codigos_acceso WHERE correo = $1 AND creado_en > $2',
    [correo, desde],
  )
  return fila.total
}

export function limiteAlcanzado(total) {
  return total >= MAX_CODIGOS_POR_CORREO
}

export async function crearCodigo(correo, rol) {
  await pool.query('UPDATE codigos_acceso SET usado_en = $1 WHERE correo = $2 AND usado_en IS NULL', [
    new Date().toISOString(),
    correo,
  ])

  const codigo = generarCodigo()
  const ahora = new Date()
  await pool.query(
    `INSERT INTO codigos_acceso (id, correo, codigo_hash, rol, expira_en, creado_en, usado_en, intentos)
     VALUES ($1,$2,$3,$4,$5,$6,NULL,0)`,
    [
      nuevoId(),
      correo,
      hashear(codigo),
      rol,
      new Date(ahora.getTime() + MINUTOS_VIGENCIA * 60_000).toISOString(),
      ahora.toISOString(),
    ],
  )
  return codigo
}

export async function limpiarCodigosVencidos() {
  const limite = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  await pool.query('DELETE FROM codigos_acceso WHERE creado_en < $1', [limite])
}

export async function validarCodigo(correo, codigo) {
  if (!/^\d{6}$/.test(codigo ?? '')) return { error: 'Código inválido o expirado' }

  const fila = await unaFila(
    'SELECT * FROM codigos_acceso WHERE correo = $1 AND usado_en IS NULL ORDER BY creado_en DESC LIMIT 1',
    [correo],
  )
  if (!fila) return { error: 'Código inválido o expirado' }

  if (fila.expira_en < new Date().toISOString() || fila.intentos >= MAX_INTENTOS) {
    await pool.query('UPDATE codigos_acceso SET usado_en = $1 WHERE id = $2', [
      new Date().toISOString(),
      fila.id,
    ])
    return { error: 'Código inválido o expirado' }
  }

  if (fila.codigo_hash !== hashear(codigo)) {
    await pool.query('UPDATE codigos_acceso SET intentos = intentos + 1 WHERE id = $1', [fila.id])
    return { error: 'Código inválido o expirado' }
  }

  await pool.query('UPDATE codigos_acceso SET usado_en = $1 WHERE id = $2', [
    new Date().toISOString(),
    fila.id,
  ])
  return { rol: fila.rol }
}

function nombreDesdeCorreo(correo) {
  return correo.split('@')[0].replace(/[._-]+/g, ' ').trim().slice(0, 80)
}

export async function usuarioPorCorreo(correo) {
  if (esCorreoAdmin(correo)) {
    const id = await asegurarAdministrador()
    return unaFila('SELECT * FROM usuarios WHERE id = $1', [id])
  }

  const existente = await unaFila("SELECT * FROM usuarios WHERE lower(correo) = $1 AND rol = 'evaluado'", [
    correo,
  ])
  if (existente) return existente

  const id = nuevoId()
  await pool.query(
    `INSERT INTO usuarios (id, usuario, clave_hash, correo, nombre, grado, unidad, rol, activo, perfil, creado_en)
     VALUES ($1,$2,NULL,$3,$4,'','','evaluado',TRUE,'{}',$5)`,
    [id, correo, correo, nombreDesdeCorreo(correo), new Date().toISOString()],
  )
  await registrarAuditoria(id, 'alta_evaluado', 'Alta automática por acceso con correo')
  return unaFila('SELECT * FROM usuarios WHERE id = $1', [id])
}
