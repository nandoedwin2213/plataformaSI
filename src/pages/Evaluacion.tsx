import { useState } from 'react'
import { Formulario } from '../components/Formulario'
import { PanelResultado } from '../components/PanelResultado'
import { evaluacionInicial } from '../domain/catalogos'
import { evaluarFatiga } from '../domain/scoring'
import type { Evaluacion as EvaluacionDatos, Resultado } from '../domain/types'
import { aplicarPerfil } from '../domain/usuarios'
import { useApp } from '../store/contexto'

export function Evaluacion() {
  const { usuarioActual, ajustes, guardarRegistro } = useApp()
  const [evaluacion, setEvaluacion] = useState<EvaluacionDatos>(() =>
    usuarioActual ? aplicarPerfil(evaluacionInicial, usuarioActual) : evaluacionInicial,
  )
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  if (!usuarioActual) return null

  const guardar = async (datos: Resultado) => {
    try {
      await guardarRegistro({ evaluacion, resultado: datos })
      setError('')
      setGuardado(true)
    } catch {
      setError('No se pudo guardar la evaluación en el servidor.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Evaluación completa de fatiga</h1>
        <p className="mt-1 text-sm text-slate-400">
          Instrumento extendido: perfil biomédico, cargos y jornada, escalas KSS, Samn-Perelli y Epworth.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <Formulario
          evaluacion={evaluacion}
          onCambio={(parcial) => {
            setEvaluacion((previo) => ({ ...previo, ...parcial }))
            setGuardado(false)
          }}
          onEvaluar={() => {
            setResultado(evaluarFatiga(evaluacion, ajustes.umbrales))
            setGuardado(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          onReiniciar={() => {
            setEvaluacion(aplicarPerfil({ ...evaluacionInicial, epworth: Array(8).fill(0) }, usuarioActual))
            setResultado(null)
            setGuardado(false)
          }}
        />
        <div>
          {resultado ? (
            <PanelResultado
              evaluacion={evaluacion}
              resultado={resultado}
              guardado={guardado}
              onGuardar={() => void guardar(resultado)}
            />
          ) : null}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          {!resultado && (
            <div className="card text-sm text-slate-400">
              Completa el formulario y pulsa <strong className="text-slate-200">Calcular diagnóstico</strong> para
              obtener el índice de riesgo, los factores contribuyentes y el plan de mitigación.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
