import jwt from 'jsonwebtoken'
import { secretoJwt, unaFila } from './db.js'

const VIGENCIA = '12h'

let secretoEnCache = null

async function secreto() {
  if (!secretoEnCache) secretoEnCache = await secretoJwt()
  return secretoEnCache
}

export async function firmarToken(usuario) {
  return jwt.sign({ sub: usuario.id, rol: usuario.rol }, await secreto(), { expiresIn: VIGENCIA })
}

export async function autenticar(peticion, respuesta, siguiente) {
  const cabecera = peticion.headers.authorization ?? ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null
  if (!token) return respuesta.status(401).json({ error: 'Token requerido' })

  let carga
  try {
    carga = jwt.verify(token, await secreto())
  } catch {
    return respuesta.status(401).json({ error: 'Sesión inválida o expirada' })
  }

  const usuario = await unaFila('SELECT * FROM usuarios WHERE id = $1', [carga.sub])
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
