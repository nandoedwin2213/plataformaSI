# Plataforma de gestión de riesgos de fatiga (FAE)

Plataforma web institucional para diagnosticar, monitorear y mitigar la fatiga del personal militar.

- **Frontend**: React + TypeScript + Vite + Tailwind + React Router.
- **Backend** (`server/`): API Express con base PostgreSQL (Neon u otro proveedor), contraseñas hasheadas con bcrypt, sesión JWT, control de acceso por rol y bitácora de auditoría.

## Módulos

- **Login con roles**: piloto/tripulante, médico de aviación, jefe de operaciones y administrador, con navegación filtrada por rol.
- **Inicio**: semáforo del día, índice promedio de 14 días, sueño promedio, tendencia y mapa de calor de 4 semanas; para mandos, pendientes de check-in de la unidad.
- **Check-in diario**: registro de menos de un minuto (sueño, vigilia, KSS, Samn-Perelli, vuelo programado/nocturno y novedades) con semáforo de aptitud y acciones sugeridas.
- **Evaluación completa**: identificación, perfil biomédico (nacimiento, edad, peso, talla, IMC, antecedentes), funciones/cargos y jornada, sueño y vigilia, carga operacional y las escalas KSS, Samn-Perelli y Epworth.
- **Índice de riesgo 0-100** con niveles configurables, desglose de factores contribuyentes y juicio de aptitud. Reglas duras: KSS ≥ 8, Samn-Perelli ≥ 6, menos de 4 h de sueño en 24 h o jornada > 12 h sin relevo elevan el nivel a alto como mínimo.
- **Estrategias de mitigación** individuales (antes del vuelo, durante el vuelo, recuperación) y organizacionales (redistribución de cargos, plan de relevos, descanso protegido, incentivos, apoyo psicológico).
- **Historial**: métricas agregadas, tabla por evaluación, exportación CSV/JSON e impresión a PDF.
- **Tablero de escuadrón**: distribución de niveles del día, tendencia de 14 días por unidad, factores acumulados, tabla de personal con alertas de fatiga sostenida, deuda de sueño y check-ins faltantes, y exportación del reporte.
- **Personal**: alta de usuarios con grado, unidad, rol y credenciales; activación/desactivación y baja.
- **Ficha longitudinal**: historial por militar con cargos, antecedentes, mapa de calor, deuda de sueño, tendencia diaria y **proyección del índice a 7 días** (tendencia reciente + deuda de sueño frente a 8 h diarias), e informe imprimible.
- **Ajustes**: identidad de la unidad, umbrales del índice, jornada de referencia, retención de datos, respaldo JSON, auditoría reciente y reinicio de datos demo.
- **Guía clínica**: interpretación del índice según los umbrales vigentes, contramedidas individuales y organizacionales, y descripción de las escalas.

## Cuentas de demostración

| Usuario | Contraseña | Rol |
| --- | --- | --- |
| `piloto` | `piloto123` | Piloto / tripulante |
| `operaciones` | `ops123` | Jefe de operaciones |
| `medico` | `med123` | Médico de aviación |
| `admin` | `admin123` | Administrador |

## Uso

```bash
# API (puerto 3001, crea el esquema y los datos demo en PostgreSQL)
cd server && npm install
echo 'DATABASE_URL=postgresql://usuario:clave@host/base?sslmode=require' > .env
npm run dev

# Frontend (puerto 5173, proxy de /api hacia la API)
npm install
npm run dev      # servidor de desarrollo
npm run build    # compilación de producción
npm run lint     # eslint
```

Con `npm run build` hecho, la API también sirve el frontend compilado desde `dist/`, de modo que un despliegue institucional puede correr en un solo proceso.

Variables de entorno de la API:

- `DATABASE_URL` (obligatoria): cadena de conexión PostgreSQL.
- `JWT_SECRETO`: recomendada en producción; si falta, se genera y guarda en la tabla `configuracion`.
- `PORT` (o `PUERTO` en local): puerto de escucha, 3001 por defecto.

## Despliegue en Render + Neon

1. Crear la base en [Neon](https://neon.tech) y copiar la cadena de conexión.
2. Crear un Web Service en Render apuntando a este repositorio; `render.yaml` define build y arranque.
3. Configurar `DATABASE_URL` y `JWT_SECRETO` como variables del servicio (nunca en el repositorio).
4. Render inyecta `PORT`; el proceso sirve la API y el frontend compilado de `dist/`.
5. Verificar `https://<servicio>.onrender.com/api/salud`.

El esquema y los datos demo se crean automáticamente en el primer arranque si la base está vacía.

## Aviso

Herramienta de apoyo a la decisión: no sustituye el criterio del médico de aviación ni la normativa vigente de la unidad.

Las cuentas de demostración tienen contraseñas públicas y deben cambiarse antes de cualquier uso real. Para producción institucional falta además HTTPS/TLS, cifrado en reposo, integración con el directorio de personal, respaldo centralizado programado y aplicación efectiva de la política de retención.
