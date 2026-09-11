// Genera una población sintética para verificar que el panel poblacional soporta 1.000+
// evaluados. Los datos son artificiales: nombres, correos y respuestas se producen con un
// generador pseudoaleatorio. Nunca debe ejecutarse con datos personales reales ni contra la
// base de producción.

import { randomUUID } from 'node:crypto'
import { consultar, pool, unaFila } from '../src/db.js'
import { recalcularRiesgo } from '../src/servicioRiesgo.js'

const TOTAL = Number(process.env.TOTAL_SINTETICO ?? 1000)
const DIAS = Number(process.env.DIAS_SINTETICOS ?? 45)

const grados = ['Sargento Segundo', 'Sargento Primero', 'Subteniente', 'Teniente', 'Capitán', 'Mayor']
const unidades = ['Ala de Combate N.º 21', 'Ala de Combate N.º 23', 'Ala de Transporte N.º 11', 'Escuela Militar']

let semilla = 20260911
function aleatorio() {
  semilla = (semilla * 1664525 + 1013904223) % 4294967296
  return semilla / 4294967296
}

function entre(minimo, maximo) {
  return Math.round(minimo + aleatorio() * (maximo - minimo))
}

async function main() {
  const inicio = Date.now()
  const instrumentos = await consultar("SELECT * FROM instrumentos WHERE tipo = 'estandarizado'")
  const porClave = Object.fromEntries(instrumentos.map((fila) => [fila.clave, fila]))
  const preguntas = {}
  for (const instrumento of instrumentos) {
    preguntas[instrumento.clave] = await consultar(
      'SELECT * FROM preguntas WHERE instrumento_id = $1 ORDER BY orden',
      [instrumento.id],
    )
  }

  const usuarios = []
  for (let indice = 0; indice < TOTAL; indice += 1) {
    usuarios.push({
      id: randomUUID(),
      usuario: `sintetico${indice}`,
      correo: `sintetico${indice}@ejemplo.invalid`,
      nombre: `Evaluado Sintético ${indice + 1}`,
      grado: grados[entre(0, grados.length - 1)],
      unidad: unidades[entre(0, unidades.length - 1)],
    })
  }

  const ahora = Date.now()
  const creadoEn = new Date(ahora - DIAS * 86_400_000).toISOString()
  for (const usuario of usuarios) {
    await pool.query(
      `INSERT INTO usuarios (id, usuario, correo, clave_hash, nombre, grado, unidad, rol, activo, perfil, creado_en)
       VALUES ($1,$2,$3,'',$4,$5,$6,'evaluado',TRUE,$7,$8)
       ON CONFLICT (usuario) DO NOTHING`,
      [
        usuario.id,
        usuario.usuario,
        usuario.correo,
        usuario.nombre,
        usuario.grado,
        usuario.unidad,
        JSON.stringify({ nombres: usuario.nombre, apellidos: 'Sintético', fechaNacimiento: '1990-01-01' }),
        creadoEn,
      ],
    )
  }

  console.log(`Usuarios sintéticos insertados en ${Date.now() - inicio} ms`)

  // Cada evaluado responde KSS y Samn-Perelli varias veces, NASA-TLX semanalmente y Epworth una vez.
  for (const usuario of usuarios) {
    const sesgo = aleatorio()
    const filas = []
    for (let dia = DIAS; dia >= 0; dia -= 2) {
      const fecha = new Date(ahora - dia * 86_400_000).toISOString()
      const deriva = ((DIAS - dia) / DIAS) * (sesgo > 0.7 ? 3 : 0)
      const kss = Math.min(9, Math.max(1, Math.round(3 + sesgo * 4 + deriva + (aleatorio() - 0.5) * 2)))
      const sp = Math.min(7, Math.max(1, Math.round(2 + sesgo * 3 + deriva * 0.7 + (aleatorio() - 0.5) * 2)))
      filas.push(['kss', kss, ((kss - 1) / 8) * 100, fecha])
      filas.push(['samn_perelli', sp, ((sp - 1) / 6) * 100, fecha])
      if (dia % 14 === 0) {
        const tlx = Math.min(100, Math.max(0, Math.round(35 + sesgo * 40 + (aleatorio() - 0.5) * 20)))
        filas.push(['nasa_tlx', tlx, tlx, fecha])
      }
      if (dia === DIAS) {
        const ep = Math.min(24, Math.max(0, Math.round(5 + sesgo * 12)))
        filas.push(['epworth', ep, (ep / 24) * 100, fecha])
      }
    }

    const valores = []
    const parametros = []
    filas.forEach(([clave, puntaje, normalizado, fecha], indice) => {
      const base = indice * 7
      valores.push(
        `($${base + 1},$${base + 2},$${base + 3},'finalizada','{}',$${base + 4},$${base + 5},'Aplicación sintética','{}',$${base + 6},$${base + 6},$${base + 7},1)`,
      )
      parametros.push(randomUUID(), porClave[clave].id, usuario.id, puntaje, normalizado, fecha, fecha)
    })
    await pool.query(
      `INSERT INTO respuestas_instrumento
         (id, instrumento_id, usuario_id, estado, respuestas, puntaje, puntaje_normalizado,
          interpretacion, detalle, creado_en, actualizado_en, finalizado_en, instrumento_version)
       VALUES ${valores.join(',')}`,
      parametros,
    )
  }
  console.log(`Aplicaciones sintéticas insertadas en ${Date.now() - inicio} ms`)

  const inicioRiesgo = Date.now()
  for (const usuario of usuarios) {
    await recalcularRiesgo(usuario.id, 'poblacion_sintetica')
  }
  console.log(
    `Índice integrado calculado para ${usuarios.length} evaluados en ${Date.now() - inicioRiesgo} ms ` +
      `(${Math.round((Date.now() - inicioRiesgo) / usuarios.length)} ms por evaluado)`,
  )

  const total = await unaFila("SELECT COUNT(*)::int AS total FROM usuarios WHERE rol = 'evaluado'")
  const aplicaciones = await unaFila("SELECT COUNT(*)::int AS total FROM respuestas_instrumento WHERE estado = 'finalizada'")
  console.log(`Población total: ${total.total} evaluados, ${aplicaciones.total} aplicaciones finalizadas`)
  await pool.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
