import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { ResumenAdmin } from '../../domain/instrumentos'
import { etiquetaNivel } from '../../domain/catalogos'

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: number | string; detalle?: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase text-slate-400">{titulo}</p>
      <p className="mt-1 text-3xl font-bold text-amber-300">{valor}</p>
      {detalle && <p className="text-xs text-slate-500">{detalle}</p>}
    </div>
  )
}

export function PanelAdmin() {
  const [resumen, setResumen] = useState<ResumenAdmin | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void api
      .resumenAdmin()
      .then(setResumen)
      .catch((fallo: unknown) =>
        setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar el resumen'),
      )
  }, [])

  if (error) return <p className="card text-sm text-red-400">{error}</p>
  if (!resumen) return <p className="card text-sm text-slate-400">Cargando estado del sistema…</p>

  const niveles = Object.entries(resumen.nivelesHoy)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Estado general de la plataforma</h1>
        <p className="mt-1 text-sm text-slate-400">Corte del {resumen.fecha}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          titulo="Personal registrado"
          valor={resumen.personal}
          detalle={`${resumen.personalActivo} activos`}
        />
        <Indicador
          titulo="Evaluaciones completas"
          valor={resumen.evaluacionesCompletas}
          detalle="Instrumento clínico extendido"
        />
        <Indicador
          titulo="Check-ins registrados"
          valor={resumen.checkins}
          detalle={`${resumen.checkinsHoy} hoy`}
        />
        <Indicador
          titulo="Pendientes de check-in hoy"
          valor={resumen.pendientesCheckinHoy}
          detalle="Personal activo sin registro"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          titulo="Test configurados"
          valor={resumen.instrumentos}
          detalle={`${resumen.instrumentosActivos} activos · ${resumen.preguntasActivas} preguntas`}
        />
        <Indicador titulo="Pruebas finalizadas" valor={resumen.pruebasFinalizadas} />
        <Indicador titulo="Pruebas en curso" valor={resumen.pruebasEnCurso} />
        <Indicador
          titulo="Fichas incompletas"
          valor={resumen.fichasIncompletas}
          detalle="Sin nombres, cédula o nacimiento"
        />
      </div>

      <section className="card">
        <h2 className="section-title">Niveles de riesgo de hoy</h2>
        {niveles.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay check-ins registrados hoy.</p>
        ) : (
          <ul className="flex flex-wrap gap-4 text-sm text-slate-300">
            {niveles.map(([nivel, cantidad]) => (
              <li key={nivel}>
                {etiquetaNivel[nivel as keyof typeof etiquetaNivel] ?? nivel}: <strong>{cantidad}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">Accesos rápidos</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/personal" className="btn-ghost">
            Gestionar personal
          </Link>
          <Link to="/admin/evaluaciones" className="btn-ghost">
            Ver evaluaciones
          </Link>
          <Link to="/admin/tests" className="btn-ghost">
            Configurar test
          </Link>
          <Link to="/admin/estadisticas" className="btn-ghost">
            Estadísticas de la unidad
          </Link>
        </div>
      </section>
    </div>
  )
}
