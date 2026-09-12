import { useEffect, useState } from 'react'

interface Props {
  etiqueta: string
  valor: number
  min: number
  max: number
  paso?: number
  ayuda?: string
  id?: string
  onCambio: (valor: number) => void
}

// Campo numérico que conserva el borrado total del contenido: el texto vacío se mantiene
// mientras se escribe y se comunica como 0 al formulario, en lugar de reescribir un «0» fijo.
export function CampoNumero({ etiqueta, valor, min, max, paso = 1, ayuda, id, onCambio }: Props) {
  const [texto, setTexto] = useState(() => String(valor))

  useEffect(() => {
    setTexto((actual) => (Number(actual === '' ? 0 : actual) === valor ? actual : String(valor)))
  }, [valor])

  const escribir = (entrada: string) => {
    setTexto(entrada)
    if (entrada === '') {
      onCambio(0)
      return
    }
    const numero = Number(entrada)
    if (!Number.isNaN(numero)) onCambio(numero)
  }

  const salir = () => {
    if (texto === '') return
    const numero = Number(texto)
    if (Number.isNaN(numero)) {
      setTexto('')
      onCambio(0)
      return
    }
    const acotado = Math.min(max, Math.max(min, numero))
    setTexto(String(acotado))
    onCambio(acotado)
  }

  return (
    <div>
      <label className="label" htmlFor={id}>
        {etiqueta}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className="input"
        value={texto}
        min={min}
        max={max}
        step={paso}
        onChange={(evento) => escribir(evento.target.value)}
        onBlur={salir}
      />
      {ayuda && <p className="mt-1 text-xs text-slate-400">{ayuda}</p>}
    </div>
  )
}
