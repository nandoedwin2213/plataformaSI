import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import jwt from 'jsonwebtoken'
import { db } from './db.js'

const RUTA_DATOS = process.env.RUTA_DATOS ?? path.join(process.cwd(), 'datos')

function obtenerSecreto() {
  if (process.env.JWT_SECRETO) return process.env.JWT_SECRETO
  const archivo = path.join(RUTA_DATOS, 'jwt.secreto')
  if (!fs.existsSync(archivo)) {
    fs.writeFileSync(archivo, crypto.randomBytes(48).toString('hex'), { mode: 0o600 })
  }
  return fs.readFileSync(archivo, 'utf8').trim()
}

const SECRETO = obtenerSecreto()
const VIGENCIA = '12h'

export function firmarToken(usuario) {
  return jwt.sign({ sub: usuario.id, rol: usuario.rol }, SECRETO, { expiresIn: VIGENCIA })
}

export function autenticar(peticion, respuesta, siguiente) {
  const cabecera = peticion.headers.authorization ?? ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null
  if (!token) return respuesta.status(401).json({ error: 'Token requerido' })

  let carga
  try {
    carga = jwt.verify(token, SECRETO)
  } catch {
    return respuesta.status(401).json({ error: 'Sesión inválida o expirada' })
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(carga.sub)
  if (!usuario || !usuario.activo) return respuesta.status(401).json({ error: 'Usuario no habilitado' })

  peticion.usuario = usuario
  return siguiente()
}

export function exigirRol(...roles) {
  return (peticion, respuesta, siguiente) => {
    if (!roles.includes(peticion.usuario.rol)) {
      return respuesta.status(403).json({ error: 'No autorizado para esta operación' })
    }
    return siguiente()
  }
}

export function puedeVerTodo(usuario) {
  return usuario.rol !== 'piloto'
}
