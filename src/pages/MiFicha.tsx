import { useState } from 'react'
import { useApp } from '../store/contexto'
import { antecedentesMedicos, gradosMilitares } from '../domain/catalogos'
import { calcularEdad, calcularImc } from '../domain/scoring'
import { perfilVacio, type PerfilUsuario } from '../domain/usuarios'
import { CampoNumero } from '../components/CampoNumero'

export function MiFicha() {
  const { usuarioActual, actualizarUsuario, ajustes } = useApp()
  const [grado, setGrado] = useState(usuarioActual?.grado || 'Teniente')
  const [unidad, setUnidad] = useState(usuarioActual?.unidad || ajustes.unidadPorDefecto)
  const [perfil, setPerfil] = useState<PerfilUsuario>({ ...perfilVacio, ...usuarioActual?.perfil })
  const [estado, setEstado] = useState<'inactivo' | 'guardando' | 'guardado' | 'error'>('inactivo')
  const [error, setError] = useState('')

  if (!usuarioActual) return null

  const edad = calcularEdad(perfil.fechaNacimiento)
  const imc = calcularImc(perfil.pesoKg, perfil.tallaCm)

  const cambiar = <Clave extends keyof PerfilUsuario>(clave: Clave, valor: PerfilUsuario[Clave]) =>
    setPerfil((previo) => ({ ...previo, [clave]: valor }))

  const alternarAntecedente = (valor: string) =>
    setPerfil((previo) => ({
      ...previo,
      antecedentes: previo.antecedentes.includes(valor)
        ? previo.antecedentes.filter((item) => item !== valor)
        : [...previo.antecedentes, valor],
    }))

  const guardar = async () => {
    if (!perfil.nombres.trim() || !perfil.apellidos.trim()) {
      setEstado('error')
      setError('Nombres y apellidos son obligatorios.')
      return
    }
    setEstado('guardando')
    try {
      await actualizarUsuario(usuarioActual.id, {
        nombre: `${perfil.nombres.trim()} ${perfil.apellidos.trim()}`,
        grado,
        unidad,
        perfil,
      })
      setEstado('guardado')
      setError('')
    } catch {
      setEstado('error')
      setError('No se pudo guardar la ficha; intenta nuevamente.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Mi ficha personal</h1>
        <p className="mt-1 text-sm text-slate-400">
          Datos de identificación y perfil institucional del personal evaluado. La edad se calcula
          automáticamente a partir de la fecha de nacimiento.
        </p>
      </div>

      <section className="card space-y-4">
        <h2 className="section-title">Identificación</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="label" htmlFor="nombres">
              Nombres
            </label>
            <input
              id="nombres"
              className="input"
              value={perfil.nombres}
              onChange={(evento) => cambiar('nombres', evento.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="apellidos">
              Apellidos
            </label>
            <input
              id="apellidos"
              className="input"
              value={perfil.apellidos}
              onChange={(evento) => cambiar('apellidos', evento.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="cedula">
              Número de identificación
            </label>
            <input
              id="cedula"
              className="input"
              value={perfil.cedula}
              onChange={(evento) => cambiar('cedula', evento.target.value.replace(/\D/g, '').slice(0, 13))}
            />
          </div>
          <div>
            <label className="label" htmlFor="correo">
              Correo electrónico
            </label>
            <input id="correo" className="input" value={usuarioActual.correo} disabled />
          </div>
          <div>
            <label className="label" htmlFor="grado">
              Grado
            </label>
            <select id="grado" className="input" value={grado} onChange={(e) => setGrado(e.target.value)}>
              {gradosMilitares.map((grupo) => (
                <optgroup key={grupo.categoria} label={grupo.categoria}>
                  {grupo.grados.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="unidad">
              Unidad
            </label>
            <input
              id="unidad"
              className="input"
              value={unidad}
              onChange={(evento) => setUnidad(evento.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="nacimiento">
              Fecha de nacimiento
            </label>
            <input
              id="nacimiento"
              type="date"
              className="input"
              value={perfil.fechaNacimiento}
              onChange={(evento) => cambiar('fechaNacimiento', evento.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              {edad !== null ? `Edad: ${edad} años` : 'Edad: pendiente'} (se calcula sola a partir de esta
              fecha; no hace falta escribirla)
            </p>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="section-title">Datos biométricos y antecedentes</h2>
        <p className="text-sm text-slate-400">
          Se solicitan porque influyen en la calidad del sueño y en la rapidez con que se recupera la fatiga.
          Puedes dejar un campo vacío si aún no lo conoces.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <CampoNumero
            id="peso"
            etiqueta="Peso (kg)"
            valor={perfil.pesoKg}
            min={35}
            max={200}
            paso={0.5}
            ayuda="(peso corporal actual en kilogramos; se usa únicamente para calcular el IMC)"
            onCambio={(valor) => cambiar('pesoKg', valor)}
          />
          <CampoNumero
            id="talla"
            etiqueta="Talla (cm)"
            valor={perfil.tallaCm}
            min={130}
            max={220}
            ayuda="(estatura en centímetros, por ejemplo 172)"
            onCambio={(valor) => cambiar('tallaCm', valor)}
          />
          <div>
            <p className="label">IMC</p>
            <p className="mt-2 text-sm text-slate-300">{imc !== null ? imc.toFixed(1) : 'Pendiente'}</p>
            <p className="mt-1 text-xs text-slate-400">
              (índice de masa corporal = peso en kg ÷ talla en metros al cuadrado. Menos de 25 = normal, 25 a
              29,9 = sobrepeso, 30 o más = obesidad; un IMC alto se asocia a apnea del sueño y peor descanso)
            </p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {antecedentesMedicos.map((antecedente) => (
            <label key={antecedente.valor} className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={perfil.antecedentes.includes(antecedente.valor)}
                onChange={() => alternarAntecedente(antecedente.valor)}
              />
              {antecedente.texto}
            </label>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="otros">
            Otros antecedentes o medicación
          </label>
          <input
            id="otros"
            className="input"
            value={perfil.antecedentesOtros}
            onChange={(evento) => cambiar('antecedentesOtros', evento.target.value)}
          />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="section-title">Información profesional</h2>
        <p className="text-sm text-slate-400">
          Funciones y cargos que cumples (sirven para detectar acumulación de responsabilidades y falta de
          relevos, una de las causas principales de la fatiga crónica).
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="funcionPrincipal">
              Función principal
            </label>
            <input
              id="funcionPrincipal"
              className="input"
              value={perfil.funcionPrincipal}
              onChange={(evento) => cambiar('funcionPrincipal', evento.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="funcionSecundaria">
              Función secundaria
            </label>
            <input
              id="funcionSecundaria"
              className="input"
              value={perfil.funcionSecundaria}
              onChange={(evento) => cambiar('funcionSecundaria', evento.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="cargoPrincipal">
              Cargo principal
            </label>
            <input
              id="cargoPrincipal"
              className="input"
              value={perfil.cargoPrincipal}
              onChange={(evento) => cambiar('cargoPrincipal', evento.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="cargoAdicional">
              Cargo adicional
            </label>
            <input
              id="cargoAdicional"
              className="input"
              value={perfil.cargoAdicional}
              onChange={(evento) => cambiar('cargoAdicional', evento.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {estado === 'guardado' && <p className="text-sm text-emerald-400">Ficha guardada.</p>}
        <button className="btn-primary" disabled={estado === 'guardando'} onClick={() => void guardar()}>
          {estado === 'guardando' ? 'Guardando…' : 'Guardar ficha'}
        </button>
      </section>
    </div>
  )
}
