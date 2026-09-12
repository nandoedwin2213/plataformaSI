import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Inicio } from './pages/Inicio'
import { CheckInDiario } from './pages/CheckInDiario'
import { Evaluacion } from './pages/Evaluacion'
import { Ficha } from './pages/Ficha'
import { MiFicha } from './pages/MiFicha'
import { HistorialPagina } from './pages/HistorialPagina'
import { Tablero } from './pages/Tablero'
import { Personal } from './pages/Personal'
import { Ajustes } from './pages/Ajustes'
import { Guia } from './pages/Guia'
import { useApp } from './store/contexto'
import type { Rol } from './domain/usuarios'

function Protegida({ roles, children }: { roles?: Rol[]; children: ReactNode }) {
  const { usuarioActual } = useApp()
  if (!usuarioActual) return <Navigate to="/login" replace />
  if (roles && !roles.includes(usuarioActual.rol)) return <Navigate to="/inicio" replace />
  return <>{children}</>
}

export default function App() {
  const { usuarioActual } = useApp()

  return (
    <Routes>
      <Route path="/login" element={usuarioActual ? <Navigate to="/inicio" replace /> : <Login />} />
      <Route
        element={
          <Protegida>
            <Layout />
          </Protegida>
        }
      >
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/perfil" element={<MiFicha />} />
        <Route path="/checkin" element={<CheckInDiario />} />
        <Route path="/evaluacion" element={<Evaluacion />} />
        <Route path="/ficha" element={<Ficha />} />
        <Route path="/ficha/:id" element={<Ficha />} />
        <Route path="/historial" element={<HistorialPagina />} />
        <Route
          path="/tablero"
          element={
            <Protegida roles={['admin']}>
              <Tablero />
            </Protegida>
          }
        />
        <Route
          path="/personal"
          element={
            <Protegida roles={['admin']}>
              <Personal />
            </Protegida>
          }
        />
        <Route
          path="/ajustes"
          element={
            <Protegida roles={['admin']}>
              <Ajustes />
            </Protegida>
          }
        />
        <Route path="/guia" element={<Guia />} />
      </Route>
      <Route path="*" element={<Navigate to={usuarioActual ? '/inicio' : '/login'} replace />} />
    </Routes>
  )
}
