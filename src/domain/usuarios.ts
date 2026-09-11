import type { Evaluacion, NivelRiesgo } from './types'

export type Rol = 'piloto' | 'medico' | 'operaciones' | 'admin'

export interface PerfilUsuario {
  fechaNacimiento: string
  pesoKg: number
  tallaCm: number
  antecedentes: string[]
  antecedentesOtros: string
  funcionPrincipal: string
  funcionSecundaria: string
  cargoPrincipal: string
  cargoAdicional: string
}

export interface Usuario {
  id: string
  usuario: string
  nombre: string
  grado: string
  unidad: string
  rol: Rol
  activo: boolean
  perfil: PerfilUsuario
  creadoEn: string
}

export interface CheckIn {
  id: string
  usuarioId: string
  fecha: string
  creadoEn: string
  horasSueno: number
  horasDespierto: number
  kss: number
  samnPerelli: number
  vueloProgramado: boolean
  vueloNocturno: boolean
  notas: string
  puntaje: number
  nivel: NivelRiesgo
}

export interface Umbrales {
  moderado: number
  alto: number
  critico: number
}

export interface AjustesInstitucionales {
  institucion: string
  unidadPorDefecto: string
  umbrales: Umbrales
  jornadaReferencia: number
  alertasActivas: boolean
  retencionDias: number
}

export const rolesDisponibles: { valor: Rol; texto: string; descripcion: string }[] = [
  { valor: 'piloto', texto: 'Piloto / tripulante', descripcion: 'Check-in diario y evaluaciones propias' },
  { valor: 'medico', texto: 'Médico de aviación', descripcion: 'Acceso clínico al personal y alertas' },
  {
    valor: 'operaciones',
    texto: 'Jefe de operaciones',
    descripcion: 'Tablero de escuadrón y planificación de relevos',
  },
  { valor: 'admin', texto: 'Administrador', descripcion: 'Gestión de usuarios y parámetros del sistema' },
]

export const ajustesPorDefecto: AjustesInstitucionales = {
  institucion: 'Fuerza Aérea Ecuatoriana',
  unidadPorDefecto: 'Ala de Combate N.º 23',
  umbrales: { moderado: 20, alto: 40, critico: 60 },
  jornadaReferencia: 8,
  alertasActivas: true,
  retencionDias: 365,
}

export const perfilVacio: PerfilUsuario = {
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

export function aplicarPerfil(evaluacion: Evaluacion, usuario: Usuario): Evaluacion {
  return {
    ...evaluacion,
    piloto: usuario.nombre,
    grado: usuario.grado,
    unidad: usuario.unidad,
    ...usuario.perfil,
  }
}
