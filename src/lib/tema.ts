import { useCallback, useEffect, useState } from 'react'

export type Tema = 'dia' | 'noche'

const CLAVE = 'fae-fatiga-tema'

// Sin preferencia guardada el ambiente sigue la hora local: día de 06:00 a 18:59.
function temaPorHora(): Tema {
  const hora = new Date().getHours()
  return hora >= 6 && hora < 19 ? 'dia' : 'noche'
}

function temaInicial(): Tema {
  const guardado = localStorage.getItem(CLAVE)
  return guardado === 'dia' || guardado === 'noche' ? guardado : temaPorHora()
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(temaInicial)

  useEffect(() => {
    document.documentElement.dataset.tema = tema
  }, [tema])

  const alternar = useCallback(() => {
    setTema((previo) => {
      const siguiente = previo === 'dia' ? 'noche' : 'dia'
      localStorage.setItem(CLAVE, siguiente)
      return siguiente
    })
  }, [])

  return { tema, alternar }
}
