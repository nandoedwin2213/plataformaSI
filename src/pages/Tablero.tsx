import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/contexto'
import { BarrasHorizontales, LineaTendencia } from '../components/Graficos'
import { colorNivel, etiquetaNivel } from '../domain/catalogos'
import { descargarArchivo } from '../lib/almacenamiento'
import type { NivelRiesgo } from '../domain/types'

function ultimosDias(cantidad: number): string[] {
  const dias: string[] = []
  for (let indice = cantidad - 1; indice >= 0; indice -= 1) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - indice)
    dias.push(fecha.toISOString().slice(0, 10))
  }
  return dias
}

export function Tablero() {
  const { usuarios, checkins, registros, ajustes } = useApp()
  const [unidadFiltro, setUnidadFiltro] = useState('todas')

  const unidades = useMemo(
    () => Array.from(new Set(usuarios.map((usuario) => usuario.unidad))).sort(),
    [usuarios],
  )

  const personal = useMemo(
    () =>
      usuarios.filter(
        (usuario) =>
          usuario.rol === 'evaluado' && (unidadFiltro === 'todas' || usuario.unidad === unidadFiltro),
      ),
    [usuarios, unidadFiltro],
  )
  const idsPersonal = useMemo(() => new Set(personal.map((usuario) => usuario.id)), [personal])
  const checkinsFiltrados = checkins.filter((item) => idsPersonal.has(item.usuarioId))

  const dias = ultimosDias(14)
  const serie = dias.map((fecha) => {
    const delDia = checkinsFiltrados.filter((item) => item.fecha === fecha)
    const promedio = delDia.length
      ? Math.round(delDia.reduce((suma, item) => suma + item.puntaje, 0) / delDia.length)
      : 0
    return { etiqueta: fecha.slice(5), valor: promedio }
  })

  const hoy = new Date().toISOString().slice(0, 10)
  const checkinsHoy = checkinsFiltrados.filter((item) => item.fecha === hoy)
  const conteoNivel: Record<NivelRiesgo, number> = { bajo: 0, moderado: 0, alto: 0, critico: 0 }
  for (const item of checkinsHoy) conteoNivel[item.nivel] += 1

  const alertas = personal
    .map((usuario) => {
      const suyos = checkinsFiltrados
        .filter((item) => item.usuarioId === usuario.id)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
      const ultimo = suyos[0]
      const ultimos7 = suyos.slice(0, 7)
      const promedio7 = ultimos7.length
        ? Math.round(ultimos7.reduce((suma, item) => suma + item.puntaje, 0) / ultimos7.length)
        : 0
      const suenoPromedio = ultimos7.length
        ? Math.round((ultimos7.reduce((suma, item) => suma + item.horasSueno, 0) / ultimos7.length) * 10) / 10
        : 0
      return { usuario, ultimo, promedio7, suenoPromedio, sinCheckinHoy: ultimo?.fecha !== hoy }
    })
    .sort((a, b) => b.promedio7 - a.promedio7)

  const factores = useMemo(() => {
    const relevantes = registros.filter((registro) => idsPersonal.has(registro.usuarioId))
    const acumulado = new Map<string, number>()
    for (const registro of relevantes) {
      for (const contribuyente of registro.resultado.contribuyentes) {
        acumulado.set(contribuyente.factor, (acumulado.get(contribuyente.factor) ?? 0) + contribuyente.puntos)
      }
    }
    return Array.from(acumulado.entries())
      .map(([etiqueta, valor]) => ({ etiqueta, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6)
  }, [registros, idsPersonal])

  const exportar = () => {
    const encabezados = 'grado,nombre,unidad,indice_promedio_7d,sueno_promedio_7d,ultimo_nivel,ultimo_checkin'
    const filas = alertas.map((fila) =>
      [
        fila.usuario.grado,
        fila.usuario.nombre,
        fila.usuario.unidad,
        fila.promedio7,
        fila.suenoPromedio,
        fila.ultimo?.nivel ?? 'sin datos',
        fila.ultimo?.fecha ?? '',
      ]
        .map((valor) => `"${String(valor).replace(/"/g, '""')}"`)
        .join(','),
    )
    descargarArchivo(
      `tablero-fatiga-${hoy}.csv`,
      [encabezados, ...filas].join('\n'),
      'text/csv;charset=utf-8',
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Tablero de escuadrón</h1>
          <p className="mt-1 text-sm text-slate-400">
            Estado agregado de fatiga del personal · umbrales {ajustes.umbrales.moderado}/
            {ajustes.umbrales.alto}/{ajustes.umbrales.critico}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="unidad">
              Unidad
            </label>
            <select
              id="unidad"
              className="input"
              value={unidadFiltro}
              onChange={(evento) => setUnidadFiltro(evento.target.value)}
            >
              <option value="todas">Todas</option>
              {unidades.map((unidad) => (
                <option key={unidad} value={unidad}>
                  {unidad}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-ghost" onClick={exportar}>
            Exportar reporte
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['bajo', 'moderado', 'alto', 'critico'] as NivelRiesgo[]).map((nivel) => (
          <div key={nivel} className={`card border ${colorNivel[nivel]}`}>
            <p className="text-xs uppercase">{etiquetaNivel[nivel]} hoy</p>
            <p className="mt-1 text-3xl font-black">{conteoNivel[nivel]}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="section-title">Índice promedio de la unidad (14 días)</h2>
          <LineaTendencia datos={serie} />
        </section>
        <section className="card">
          <h2 className="section-title">Factores acumulados en evaluaciones completas</h2>
          {factores.length > 0 ? (
            <BarrasHorizontales datos={factores} />
          ) : (
            <p className="text-sm text-slate-400">
              Aún no hay evaluaciones completas guardadas para esta selección.
            </p>
          )}
        </section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="section-title">Personal y alertas</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase text-slate-400">
              <th className="py-2 pr-4">Tripulante</th>
              <th className="py-2 pr-4">Unidad</th>
              <th className="py-2 pr-4">Índice 7 d</th>
              <th className="py-2 pr-4">Sueño 7 d</th>
              <th className="py-2 pr-4">Último nivel</th>
              <th className="py-2 pr-4">Alerta</th>
            </tr>
          </thead>
          <tbody>
            {alertas.map((fila) => (
              <tr key={fila.usuario.id} className="border-b border-white/5 last:border-0">
                <td className="py-2 pr-4">
                  <Link
                    to={`/admin/personal/${fila.usuario.id}`}
                    className="text-slate-200 hover:text-cyan-300"
                  >
                    {fila.usuario.grado} {fila.usuario.nombre}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-slate-400">{fila.usuario.unidad}</td>
                <td className="py-2 pr-4 font-semibold text-cyan-300">{fila.promedio7}</td>
                <td className="py-2 pr-4 text-slate-300">{fila.suenoPromedio} h</td>
                <td className="py-2 pr-4">
                  {fila.ultimo ? (
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${colorNivel[fila.ultimo.nivel]}`}>
                      {etiquetaNivel[fila.ultimo.nivel]}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">sin datos</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-xs">
                  {fila.promedio7 >= ajustes.umbrales.alto && (
                    <span className="mr-2 rounded bg-red-500/20 px-2 py-0.5 text-red-300">fatiga sostenida</span>
                  )}
                  {fila.suenoPromedio > 0 && fila.suenoPromedio < 6 && (
                    <span className="mr-2 rounded bg-orange-500/20 px-2 py-0.5 text-orange-300">
                      deuda de sueño
                    </span>
                  )}
                  {fila.sinCheckinHoy && (
                    <span className="rounded bg-slate-500/20 px-2 py-0.5 text-slate-300">sin check-in hoy</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
