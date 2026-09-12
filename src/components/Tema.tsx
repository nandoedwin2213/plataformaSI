import type { Tema } from '../lib/tema'

export function Ambiente() {
  return (
    <div className="ambiente" aria-hidden="true">
      <div className="estrellas" />
      <div className="sol" />
    </div>
  )
}

export function BotonTema({ tema, onAlternar }: { tema: Tema; onAlternar: () => void }) {
  return (
    <button
      type="button"
      onClick={onAlternar}
      title={
        tema === 'dia'
          ? 'Cambiar a modo noche (pantalla oscura para servicios nocturnos)'
          : 'Cambiar a modo día (pantalla clara para luz ambiente)'
      }
      className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/10"
    >
      {tema === 'dia' ? '☀ Día' : '☾ Noche'}
    </button>
  )
}
