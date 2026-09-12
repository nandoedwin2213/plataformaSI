import { randomUUID } from 'node:crypto'
import crypto from 'node:crypto'
import pg from 'pg'
import { INSTRUMENTOS_ESTANDARIZADOS } from './instrumentosBase.js'
import { definicionModeloV1, reglasAlertaPorDefecto } from './modeloRiesgo.js'

// Catálogo inicial de mitigación. Son recomendaciones generales de gestión de fatiga ya
// presentes en la plataforma; quedan marcadas como pendientes de validación institucional y
// son editables desde administración. No sustituyen protocolos médicos ni operacionales.
const estrategiasIniciales = [
  {
    titulo: 'Descanso protegido y reporte de fatiga',
    descripcion:
      'Ante nivel crítico, el evaluado no debería asumir tareas de seguridad crítica sin una decisión formal del mando o del servicio médico.',
    nivelObjetivo: 'critico',
    dominio: '',
    acciones: 'Reportar fatiga; solicitar relevo; asegurar dos periodos completos de sueño antes de reincorporarse.',
    reevaluarDias: 1,
    escalamiento: 'Jefe de operaciones y medicina aeroespacial',
  },
  {
    titulo: 'Refuerzo de tripulación y redistribución de tareas',
    descripcion: 'Reducir la exposición individual cuando el índice integrado se mantiene alto.',
    nivelObjetivo: 'alto',
    dominio: '',
    acciones: 'Tripulación aumentada; asignar maniobras críticas al personal menos fatigado; lectura cruzada de listas.',
    reevaluarDias: 2,
    escalamiento: 'Jefe de operaciones',
  },
  {
    titulo: 'Recuperación del déficit de sueño',
    descripcion: 'Indicada cuando el dominio de sueño y recuperación es el principal contribuyente.',
    nivelObjetivo: 'alto',
    dominio: 'sueno_recuperacion',
    acciones: 'Siesta de 20-30 min o 90-120 min según disponibilidad; dos noches de sueño sin alarma; evitar inicios tempranos.',
    reevaluarDias: 3,
    escalamiento: '',
  },
  {
    titulo: 'Revisión de la carga de trabajo asignada',
    descripcion: 'Indicada cuando la carga percibida (NASA-TLX) se mantiene alta.',
    nivelObjetivo: 'moderado',
    dominio: 'carga_trabajo',
    acciones: 'Revisar cargos acumulados y relevos disponibles; redistribuir tareas secundarias; revisar planificación del turno.',
    reevaluarDias: 7,
    escalamiento: 'Jefe de unidad',
  },
  {
    titulo: 'Derivación por somnolencia diurna excesiva',
    descripcion:
      'Un Epworth ≥ 11 sugiere somnolencia diurna excesiva que puede responder a un trastorno del sueño subyacente.',
    nivelObjetivo: 'moderado',
    dominio: 'somnolencia_habitual',
    acciones: 'Valoración en medicina aeroespacial; tamizaje de apnea del sueño cuando corresponda.',
    reevaluarDias: 30,
    escalamiento: 'Medicina aeroespacial',
  },
]

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

export const CORREO_ADMIN = (process.env.ADMIN_EMAIL ?? 'nandoedwin2213@gmail.com').trim().toLowerCase()

export function esCorreoAdmin(correo) {
  return typeof correo === 'string' && correo.trim().toLowerCase() === CORREO_ADMIN
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

export async function crearEsquema() {
  await pool.query(`
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  usuario TEXT NOT NULL UNIQUE,
  clave_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  grado TEXT NOT NULL,
  unidad TEXT NOT NULL,
  rol TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS codigos_acceso (
  id TEXT PRIMARY KEY,
  correo TEXT NOT NULL,
  codigo_hash TEXT NOT NULL,
  rol TEXT NOT NULL,
  expira_en TEXT NOT NULL,
  creado_en TEXT NOT NULL,
  usado_en TEXT,
  intentos INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS instrumentos (
  id TEXT PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'personalizado',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  orden INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preguntas (
  id TEXT PRIMARY KEY,
  instrumento_id TEXT NOT NULL REFERENCES instrumentos(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  ayuda TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL,
  opciones TEXT NOT NULL DEFAULT '[]',
  obligatoria BOOLEAN NOT NULL DEFAULT TRUE,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  orden INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS respuestas_instrumento (
  id TEXT PRIMARY KEY,
  instrumento_id TEXT NOT NULL REFERENCES instrumentos(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  estado TEXT NOT NULL DEFAULT 'borrador',
  respuestas TEXT NOT NULL DEFAULT '{}',
  puntaje DOUBLE PRECISION,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL,
  finalizado_en TEXT,
  UNIQUE (instrumento_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS modelos_riesgo (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  definicion TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT FALSE,
  nota TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL,
  creado_por TEXT
);

CREATE TABLE IF NOT EXISTS evaluaciones_riesgo (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  calculado_en TEXT NOT NULL,
  version_modelo INTEGER NOT NULL,
  puntaje DOUBLE PRECISION NOT NULL,
  puntaje_base DOUBLE PRECISION NOT NULL,
  nivel TEXT NOT NULL,
  confianza TEXT NOT NULL,
  cobertura DOUBLE PRECISION NOT NULL,
  detalle TEXT NOT NULL,
  disparado_por TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS lineas_base (
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dominio TEXT NOT NULL,
  media DOUBLE PRECISION NOT NULL,
  desviacion DOUBLE PRECISION NOT NULL,
  n INTEGER NOT NULL,
  provisional BOOLEAN NOT NULL DEFAULT TRUE,
  actualizado_en TEXT NOT NULL,
  PRIMARY KEY (usuario_id, dominio)
);

CREATE TABLE IF NOT EXISTS reglas_alerta (
  id TEXT PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL,
  parametros TEXT NOT NULL DEFAULT '{}',
  severidad TEXT NOT NULL DEFAULT 'media',
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alertas (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  regla_clave TEXT NOT NULL,
  severidad TEXT NOT NULL,
  motivo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierta',
  evaluacion_riesgo_id TEXT,
  nota TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL,
  cerrado_por TEXT
);

CREATE TABLE IF NOT EXISTS estrategias_mitigacion (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  nivel_objetivo TEXT NOT NULL DEFAULT 'alto',
  dominio TEXT NOT NULL DEFAULT '',
  acciones TEXT NOT NULL DEFAULT '',
  reevaluar_dias INTEGER,
  escalamiento TEXT NOT NULL DEFAULT '',
  requiere_validacion BOOLEAN NOT NULL DEFAULT TRUE,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  orden INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_preguntas_instrumento ON preguntas(instrumento_id, orden);
CREATE INDEX IF NOT EXISTS idx_respuestas_usuario ON respuestas_instrumento(usuario_id);
CREATE INDEX IF NOT EXISTS idx_checkins_usuario ON checkins(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_registros_usuario ON registros(usuario_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_codigos_correo ON codigos_acceso(correo, creado_en);
CREATE INDEX IF NOT EXISTS idx_riesgo_usuario ON evaluaciones_riesgo(usuario_id, calculado_en DESC);
CREATE INDEX IF NOT EXISTS idx_riesgo_nivel ON evaluaciones_riesgo(nivel);
CREATE INDEX IF NOT EXISTS idx_alertas_estado ON alertas(estado, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_usuario ON alertas(usuario_id, estado);
`)

  await migrarAccesoPorCorreo()
  await migrarInstrumentosLongitudinales()
}

// Las respuestas dejan de ser una por instrumento y usuario: cada aplicación es un evento
// con su fecha, su versión de instrumento y su puntaje, para poder analizar la serie temporal.
async function migrarInstrumentosLongitudinales() {
  await pool.query(`
ALTER TABLE instrumentos ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE instrumentos ADD COLUMN IF NOT EXISTS frecuencia_dias INTEGER NOT NULL DEFAULT 1;
ALTER TABLE instrumentos ADD COLUMN IF NOT EXISTS dominio TEXT NOT NULL DEFAULT '';
ALTER TABLE respuestas_instrumento ADD COLUMN IF NOT EXISTS instrumento_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE respuestas_instrumento ADD COLUMN IF NOT EXISTS puntaje_normalizado DOUBLE PRECISION;
ALTER TABLE respuestas_instrumento ADD COLUMN IF NOT EXISTS interpretacion TEXT NOT NULL DEFAULT '';
ALTER TABLE respuestas_instrumento ADD COLUMN IF NOT EXISTS detalle TEXT NOT NULL DEFAULT '{}';
ALTER TABLE respuestas_instrumento
  DROP CONSTRAINT IF EXISTS respuestas_instrumento_instrumento_id_usuario_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_respuesta_borrador_unica
  ON respuestas_instrumento (instrumento_id, usuario_id) WHERE estado = 'borrador';
CREATE INDEX IF NOT EXISTS idx_respuestas_serie
  ON respuestas_instrumento (usuario_id, instrumento_id, finalizado_en DESC);
ALTER TABLE preguntas ADD COLUMN IF NOT EXISTS clave TEXT;
ALTER TABLE preguntas ADD COLUMN IF NOT EXISTS minimo DOUBLE PRECISION;
ALTER TABLE preguntas ADD COLUMN IF NOT EXISTS maximo DOUBLE PRECISION;
ALTER TABLE preguntas ADD COLUMN IF NOT EXISTS paso DOUBLE PRECISION;
`)
}

async function migrarAccesoPorCorreo() {
  await pool.query(`
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS correo TEXT;
ALTER TABLE usuarios ALTER COLUMN clave_hash DROP NOT NULL;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
`)

  await pool.query("UPDATE usuarios SET rol = 'evaluado' WHERE rol <> 'admin'")
  await pool.query(
    `UPDATE usuarios SET rol = 'evaluado', correo = NULL
       WHERE rol = 'admin'
         AND id <> (SELECT id FROM usuarios WHERE rol = 'admin' ORDER BY creado_en LIMIT 1)`,
  )
  await pool.query("UPDATE usuarios SET correo = $1 WHERE rol = 'admin'", [CORREO_ADMIN])
  await pool.query("UPDATE usuarios SET correo = NULL WHERE rol <> 'admin' AND lower(correo) = $1", [
    CORREO_ADMIN,
  ])
  await pool.query(`
UPDATE usuarios
   SET correo = CASE
     WHEN usuario LIKE '%@%' THEN lower(usuario)
     ELSE lower(usuario) || '@demo.plataformasi.mil.ec'
   END
 WHERE rol = 'evaluado' AND (correo IS NULL OR correo = '')`)

  await pool.query(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_rol_check') THEN
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('evaluado','admin'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_unico_admin ON usuarios ((rol)) WHERE rol = 'admin';
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios (lower(correo)) WHERE correo IS NOT NULL;
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
    correo: 'luis.vasconez@demo.plataformasi.mil.ec',
    nombre: 'Vásconez Andrade Luis',
    grado: 'Teniente',
    unidad: 'Ala de Combate N.º 23',
    rol: 'evaluado',
    conHistorial: true,
    perfil: {
      ...perfilVacio,
      nombres: 'Luis',
      apellidos: 'Vásconez Andrade',
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
    correo: 'maria.cedeno@demo.plataformasi.mil.ec',
    nombre: 'Cedeño Ríos María',
    grado: 'Capitán',
    unidad: 'Ala de Transportes N.º 11',
    rol: 'evaluado',
    conHistorial: true,
    perfil: {
      ...perfilVacio,
      nombres: 'María',
      apellidos: 'Cedeño Ríos',
      fechaNacimiento: '1989-11-02',
      pesoKg: 62,
      tallaCm: 165,
      funcionPrincipal: 'Piloto de transporte táctico',
      cargoPrincipal: 'Jefa de estandarización',
    },
  },
  {
    correo: CORREO_ADMIN,
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

// El registro diario deja de contener KSS y Samn-Perelli: esas escalas son ahora instrumentos
// independientes. El registro conserva sueño, vigilia y condiciones del servicio, que alimentan
// el dominio de sueño y recuperación del modelo integrado.
const instrumentosDelSistema = [
  {
    clave: 'checkin',
    nombre: 'Registro diario de sueño y jornada',
    descripcion:
      'Registro breve previo al servicio: horas de sueño, vigilia acumulada y condiciones del vuelo.',
    dominio: 'sueno_recuperacion',
    frecuenciaDias: 1,
    orden: 10,
  },
]

export async function asegurarInstrumentosBase() {
  const ahora = new Date().toISOString()

  for (const instrumento of instrumentosDelSistema) {
    await pool.query(
      `INSERT INTO instrumentos (id, clave, nombre, descripcion, tipo, activo, orden, creado_en, dominio, frecuencia_dias)
       VALUES ($1,$2,$3,$4,'sistema',TRUE,$5,$6,$7,$8)
       ON CONFLICT (clave) DO UPDATE SET
         nombre = excluded.nombre,
         descripcion = excluded.descripcion,
         dominio = excluded.dominio,
         frecuencia_dias = excluded.frecuencia_dias`,
      [
        randomUUID(),
        instrumento.clave,
        instrumento.nombre,
        instrumento.descripcion,
        instrumento.orden,
        ahora,
        instrumento.dominio,
        instrumento.frecuenciaDias,
      ],
    )
  }

  // La evaluación agrupada queda archivada: sus escalas viven ahora por separado.
  await pool.query("UPDATE instrumentos SET activo = FALSE WHERE clave = 'evaluacion'")

  for (const definicion of INSTRUMENTOS_ESTANDARIZADOS) {
    const id = randomUUID()
    await pool.query(
      `INSERT INTO instrumentos
         (id, clave, nombre, descripcion, tipo, activo, orden, creado_en, version, frecuencia_dias, dominio)
       VALUES ($1,$2,$3,$4,'estandarizado',TRUE,$5,$6,1,$7,$8)
       ON CONFLICT (clave) DO UPDATE SET
         nombre = excluded.nombre,
         descripcion = excluded.descripcion,
         tipo = 'estandarizado',
         dominio = excluded.dominio`,
      [
        id,
        definicion.clave,
        definicion.nombre,
        definicion.descripcion,
        definicion.orden,
        ahora,
        definicion.frecuenciaDias,
        definicion.dominio,
      ],
    )
    const fila = await unaFila('SELECT id FROM instrumentos WHERE clave = $1', [definicion.clave])
    for (const pregunta of definicion.preguntas) {
      await pool.query(
        `INSERT INTO preguntas
           (id, instrumento_id, texto, ayuda, tipo, opciones, obligatoria, activa, orden, creado_en, clave, minimo, maximo, paso)
         SELECT $1,$2,$3,$4,$5,$6,TRUE,TRUE,$7,$8,$9,$10,$11,$12
         WHERE NOT EXISTS (SELECT 1 FROM preguntas WHERE instrumento_id = $2 AND clave = $9)`,
        [
          randomUUID(),
          fila.id,
          pregunta.texto,
          pregunta.ayuda,
          pregunta.tipo,
          JSON.stringify(pregunta.opciones ?? []),
          pregunta.orden,
          ahora,
          pregunta.clave,
          pregunta.minimo ?? null,
          pregunta.maximo ?? null,
          pregunta.paso ?? null,
        ],
      )
    }
  }
}

export async function asegurarModeloRiesgo() {
  await pool.query(
    `INSERT INTO modelos_riesgo (id, version, nombre, definicion, activo, nota, creado_en)
     VALUES ($1,1,$2,$3,TRUE,$4,$5)
     ON CONFLICT (version) DO NOTHING`,
    [
      randomUUID(),
      definicionModeloV1.nombre,
      JSON.stringify(definicionModeloV1),
      'Versión inicial. Pesos, umbrales y reglas requieren validación clínica e institucional.',
      new Date().toISOString(),
    ],
  )
  for (const regla of reglasAlertaPorDefecto) {
    await pool.query(
      `INSERT INTO reglas_alerta (id, clave, nombre, descripcion, tipo, parametros, severidad, activa, creado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (clave) DO NOTHING`,
      [
        randomUUID(),
        regla.clave,
        regla.nombre,
        regla.descripcion,
        regla.tipo,
        JSON.stringify(regla.parametros),
        regla.severidad,
        regla.activa,
        new Date().toISOString(),
      ],
    )
  }
  const { total } = await unaFila('SELECT COUNT(*)::int AS total FROM estrategias_mitigacion')
  if (total === 0) {
    for (const [indice, estrategia] of estrategiasIniciales.entries()) {
      await pool.query(
        `INSERT INTO estrategias_mitigacion
           (id, titulo, descripcion, nivel_objetivo, dominio, acciones, reevaluar_dias, escalamiento,
            requiere_validacion, activa, orden, creado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,TRUE,$9,$10)`,
        [
          randomUUID(),
          estrategia.titulo,
          estrategia.descripcion,
          estrategia.nivelObjetivo,
          estrategia.dominio,
          estrategia.acciones,
          estrategia.reevaluarDias,
          estrategia.escalamiento,
          indice + 1,
          new Date().toISOString(),
        ],
      )
    }
  }
}

export async function asegurarAdministrador() {
  const existente = await unaFila("SELECT id FROM usuarios WHERE rol = 'admin'")
  if (existente) return existente.id

  const porCorreo = await unaFila('SELECT id FROM usuarios WHERE lower(correo) = $1', [CORREO_ADMIN])
  if (porCorreo) {
    await pool.query("UPDATE usuarios SET rol = 'admin', activo = TRUE WHERE id = $1", [porCorreo.id])
    return porCorreo.id
  }

  const id = randomUUID()
  await pool.query(
    `INSERT INTO usuarios (id, usuario, clave_hash, correo, nombre, grado, unidad, rol, activo, perfil, creado_en)
     VALUES ($1,$2,NULL,$3,$4,'','','admin',TRUE,$5,$6)`,
    [
      id,
      CORREO_ADMIN,
      CORREO_ADMIN,
      'Administrador del sistema',
      JSON.stringify(perfilVacio),
      new Date().toISOString(),
    ],
  )
  return id
}

export async function inicializarDatos() {
  await crearEsquema()

  await pool.query('INSERT INTO ajustes (id, datos) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [
    JSON.stringify(ajustesPorDefecto),
  ])

  await asegurarInstrumentosBase()
  await asegurarModeloRiesgo()

  const { total } = await unaFila('SELECT COUNT(*)::int AS total FROM usuarios')
  if (total > 0) {
    await asegurarAdministrador()
    return
  }

  for (const [indice, demo] of usuariosDemo.entries()) {
    const id = randomUUID()
    await pool.query(
      `INSERT INTO usuarios (id, usuario, clave_hash, correo, nombre, grado, unidad, rol, activo, perfil, creado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9,$10)`,
      [
        id,
        demo.correo,
        null,
        demo.correo,
        demo.nombre,
        demo.grado,
        demo.unidad,
        demo.rol,
        JSON.stringify(demo.perfil),
        new Date().toISOString(),
      ],
    )
    if (demo.conHistorial) await sembrarCheckins(id, indice + 1)
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
