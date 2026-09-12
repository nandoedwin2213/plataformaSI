import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { LayoutAdmin } from './components/LayoutAdmin'
import { Login } from './pages/Login'
import { Inicio } from './pages/Inicio'
import { CheckInDiario } from './pages/CheckInDiario'
import { Evaluacion } from './pages/Evaluacion'
import { Ficha } from './pages/Ficha'
import { MiFicha } from './pages/MiFicha'
import { Pruebas } from './pages/Pruebas'
import { ResponderPrueba } from './pages/ResponderPrueba'
import { HistorialPagina } from './pages/HistorialPagina'
import { Tablero } from './pages/Tablero'
import { Personal } from './pages/Personal'
import { Ajustes } from './pages/Ajustes'
import { Guia } from './pages/Guia'
import { PanelAdmin } from './pages/admin/PanelAdmin'
import { EvaluacionesAdmin } from './pages/admin/Evaluaciones'
import { TestsAdmin } from './pages/admin/Tests'
import { Auditoria } from './pages/admin/Auditoria'
import { CuentaAdmin } from './pages/admin/CuentaAdmin'
import { useApp } from './store/contexto'
import type { Rol } from './domain/usuarios'

function inicioDe(rol: Rol): string {
  return rol === 'admin' ? '/admin' : '/inicio'
}

function Protegida({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { usuarioActual } = useApp()
  if (!usuarioActual) return <Navigate to="/login" replace />
  if (!roles.includes(usuarioActual.rol)) return <Navigate to={inicioDe(usuarioActual.rol)} replace />
  return <>{children}</>
}

export default function App() {
  const { usuarioActual } = useApp()
  const destino = usuarioActual ? inicioDe(usuarioActual.rol) : '/login'

  return (
    <Routes>
      <Route path="/login" element={usuarioActual ? <Navigate to={destino} replace /> : <Login />} />

      {/* Experiencia del personal evaluado */}
      <Route
        element={
          <Protegida roles={['evaluado']}>
            <Layout />
          </Protegida>
        }
      >
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/perfil" element={<MiFicha />} />
        <Route path="/checkin" element={<CheckInDiario />} />
        <Route path="/evaluacion" element={<Evaluacion />} />
        <Route path="/pruebas" element={<Pruebas />} />
        <Route path="/pruebas/:id" element={<ResponderPrueba />} />
        <Route path="/ficha" element={<Ficha />} />
        <Route path="/historial" element={<HistorialPagina />} />
        <Route path="/guia" element={<Guia />} />
      </Route>

      {/* Panel administrativo */}
      <Route
        path="/admin"
        element={
          <Protegida roles={['admin']}>
            <LayoutAdmin />
          </Protegida>
        }
      >
        <Route index element={<PanelAdmin />} />
        <Route path="personal" element={<Personal />} />
        <Route path="personal/:id" element={<Ficha />} />
        <Route path="evaluaciones" element={<EvaluacionesAdmin />} />
        <Route path="tests" element={<TestsAdmin />} />
        <Route path="estadisticas" element={<Tablero />} />
        <Route path="parametros" element={<Ajustes />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="cuenta" element={<CuentaAdmin />} />
      </Route>

      <Route path="*" element={<Navigate to={destino} replace />} />
    </Routes>
  )
}
