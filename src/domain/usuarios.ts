import type { Evaluacion, NivelRiesgo } from './types'

export type Rol = 'evaluado' | 'admin'

export interface PerfilUsuario {
  nombres: string
  apellidos: string
  cedula: string
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
  correo: string
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
  subtitulo: string
  unidadPorDefecto: string
  umbrales: Umbrales
  jornadaReferencia: number
  alertasActivas: boolean
  retencionDias: number
}

export const rolesDisponibles: { valor: Rol; texto: string; descripcion: string }[] = [
  {
    valor: 'evaluado',
    texto: 'Personal evaluado',
    descripcion: 'Ficha personal, check-in diario y evaluaciones propias',
  },
  {
    valor: 'admin',
    texto: 'Administrador',
    descripcion: 'Panel institucional, gestión de personal, ajustes y auditoría',
  },
]

export const ajustesPorDefecto: AjustesInstitucionales = {
  institucion: 'Fuerza Aérea Ecuatoriana',
  subtitulo: 'Medicina Aeroespacial',
  unidadPorDefecto: 'Ala de Combate N.º 23',
  umbrales: { moderado: 20, alto: 40, critico: 60 },
  jornadaReferencia: 8,
  alertasActivas: true,
  retencionDias: 365,
}

export const perfilVacio: PerfilUsuario = {
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

export function aplicarPerfil(evaluacion: Evaluacion, usuario: Usuario): Evaluacion {
  return {
    ...evaluacion,
    piloto: usuario.nombre,
    grado: usuario.grado,
    unidad: usuario.unidad,
    ...usuario.perfil,
  }
}
