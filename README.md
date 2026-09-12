# Plataforma de gestión de riesgos de fatiga (FAE)

Plataforma web institucional para diagnosticar, monitorear y mitigar la fatiga del personal militar.

- **Frontend**: React + TypeScript + Vite + Tailwind + React Router.
- **Backend** (`server/`): API Express con base PostgreSQL (Neon u otro proveedor), acceso passwordless por código de un solo uso enviado con Resend, sesión JWT, control de acceso por rol validado en servidor y bitácora de auditoría.

## Módulos

- **Login con dos perfiles**: *Personal evaluado* y *Administrador*. El acceso es por correo electrónico: la plataforma envía un código de 6 dígitos (vigencia 10 minutos, un solo uso, máximo 5 intentos y 3 códigos por correo cada 15 minutos). Existe un único administrador, definido por `ADMIN_EMAIL`; cualquier otro correo que intente entrar como administrador es rechazado en el backend.
- **Mi ficha personal**: nombres, apellidos, cédula, grado, unidad, fecha de nacimiento (edad calculada), peso, talla, IMC, antecedentes, funciones y cargos.
- **Inicio**: semáforo del día, índice promedio de 14 días, sueño promedio, tendencia y mapa de calor de 4 semanas; para mandos, pendientes de check-in de la unidad.
- **Check-in diario**: registro de menos de un minuto (sueño, vigilia, KSS, Samn-Perelli, vuelo programado/nocturno y novedades) con semáforo de aptitud y acciones sugeridas.
- **Evaluación completa**: identificación, perfil biomédico (nacimiento, edad, peso, talla, IMC, antecedentes), funciones/cargos y jornada, sueño y vigilia, carga operacional y las escalas KSS, Samn-Perelli y Epworth.
- **Índice de riesgo 0-100** con niveles configurables, desglose de factores contribuyentes y juicio de aptitud. Reglas duras: KSS ≥ 8, Samn-Perelli ≥ 6, menos de 4 h de sueño en 24 h o jornada > 12 h sin relevo elevan el nivel a alto como mínimo.
- **Estrategias de mitigación** individuales (antes del vuelo, durante el vuelo, recuperación) y organizacionales (redistribución de cargos, plan de relevos, descanso protegido, incentivos, apoyo psicológico).
- **Historial**: métricas agregadas, tabla por evaluación, exportación CSV/JSON e impresión a PDF.
- **Tablero de escuadrón**: distribución de niveles del día, tendencia de 14 días por unidad, factores acumulados, tabla de personal con alertas de fatiga sostenida, deuda de sueño y check-ins faltantes, y exportación del reporte.
- **Personal**: alta de personal evaluado con correo, grado y unidad; activación/desactivación y baja (solo administrador).
- **Ficha longitudinal**: historial por militar con cargos, antecedentes, mapa de calor, deuda de sueño, tendencia diaria y **proyección del índice a 7 días** (tendencia reciente + deuda de sueño frente a 8 h diarias), e informe imprimible.
- **Ajustes**: identidad de la unidad, umbrales del índice, jornada de referencia, retención de datos, respaldo JSON, auditoría reciente y reinicio de datos demo.
- **Guía clínica**: interpretación del índice según los umbrales vigentes, contramedidas individuales y organizacionales, y descripción de las escalas.

## Acceso

No hay contraseñas. Se ingresa con el correo y el código recibido por email:

- **Administrador**: únicamente el correo configurado en `ADMIN_EMAIL` (por defecto `nandoedwin2213@gmail.com`).
- **Personal evaluado**: cualquier otro correo válido; la cuenta se crea automáticamente en el primer ingreso.

En desarrollo, los correos listados en `CORREOS_PRUEBA` no reciben email: la API devuelve el código en la respuesta para poder probar el flujo. **No configurar esa variable en producción.**

## Uso

```bash
npm install

# API (puerto 3001, crea el esquema y los datos demo en PostgreSQL)
echo 'DATABASE_URL=postgresql://usuario:clave@host/base?sslmode=require' > server/.env
npm run api

# Frontend (puerto 5173, proxy de /api hacia la API)
npm run dev      # servidor de desarrollo
npm run build    # compilación de producción
npm run lint     # eslint
```

Con `npm run build` hecho, la API también sirve el frontend compilado desde `dist/`, de modo que un despliegue institucional puede correr en un solo proceso.

Variables de entorno de la API:

- `DATABASE_URL` (obligatoria): cadena de conexión PostgreSQL.
- `JWT_SECRETO`: recomendada en producción; si falta, se genera y guarda en la tabla `configuracion`.
- `RESEND_API_KEY` (obligatoria para enviar códigos): clave de [Resend](https://resend.com). Nunca se escribe en el repositorio.
- `CORREO_REMITENTE`: remitente de los códigos; en producción `PlataformaSI <no-responder@gestionfatiga.com>`. Debe pertenecer a un dominio verificado en Resend; si no se define se usa `onboarding@resend.dev`, que solo puede enviar a la dirección dueña de la cuenta de Resend.
- `ADMIN_EMAIL`: correo del único administrador (por defecto `nandoedwin2213@gmail.com`).
- `CORREOS_PRUEBA`: solo para desarrollo; lista separada por comas de correos que reciben el código en la respuesta HTTP en lugar de por email.
- `PORT` (o `PUERTO` en local): puerto de escucha, 3001 por defecto.

## Modelo de acceso y seguridad

- Dos roles: `evaluado` y `admin`; restricción en base de datos (índice único parcial) que impide más de un administrador.
- El rol nunca se acepta desde el cliente: se deriva del correo verificado y se revalida en cada petición contra la base de datos.
- Los códigos se guardan hasheados (SHA-256), expiran, se invalidan al usarse y al emitir uno nuevo.
- Aislamiento horizontal: un evaluado solo lee y modifica su propio usuario, sus check-ins y sus evaluaciones; las rutas administrativas responden 403.
- Auditoría de accesos, altas, bajas, ediciones, ajustes y cierres de sesión.

## Despliegue en Vercel + Neon

1. Crear la base en [Neon](https://neon.tech) y copiar la cadena de conexión.
2. Importar el repositorio en Vercel; `vercel.json` compila el frontend a `dist/` y publica `api/index.js` como función serverless que monta la misma API Express.
3. Configurar `DATABASE_URL`, `JWT_SECRETO`, `RESEND_API_KEY`, `CORREO_REMITENTE` y `ADMIN_EMAIL` como variables de entorno del proyecto (nunca en el repositorio). `JWT_SECRETO` es obligatoria en Vercel para que las sesiones sobrevivan entre instancias, y `CORREOS_PRUEBA` debe quedar sin definir.
4. En Resend: el dominio de envío es `gestionfatiga.com` (región `sa-east-1`). En el DNS del dominio deben existir `TXT resend._domainkey`, `CNAME rsend → rsend-sae1.forge.rmta.net` y `CNAME send → send.forge.rmta.net`, y luego pulsar «Verify DNS Records». Sin dominio verificado solo se puede enviar al correo propietario de la cuenta.
5. Verificar `https://<proyecto>.vercel.app/api/salud`.

El esquema y los datos demo se crean automáticamente en el primer arranque si la base está vacía.

## Instalación como aplicación de escritorio

La plataforma es una PWA instalable: `public/manifest.webmanifest` define el nombre, el color y los iconos (`public/icono-*.png`), y `public/sw.js` es un service worker mínimo que solo habilita la instalación (no cachea respuestas, para que los datos de fatiga nunca se muestren obsoletos).

Para instalarla en Windows/macOS/Linux: abrir la plataforma en Chrome o Edge → menú `···` → «Instalar página como app…» (o el icono de instalar en la barra de direcciones). Queda como ventana propia con su icono en el escritorio y el menú de inicio. En Android/iOS: «Añadir a pantalla de inicio».

## Aviso

Herramienta de apoyo a la decisión: no sustituye el criterio del médico de aviación ni la normativa vigente de la unidad.

Las cuentas de demostración tienen contraseñas públicas y deben cambiarse antes de cualquier uso real. Para producción institucional falta además HTTPS/TLS, cifrado en reposo, integración con el directorio de personal, respaldo centralizado programado y aplicación efectiva de la política de retención.
