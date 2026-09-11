import app from './app.js'

const PUERTO = Number(process.env.PORT ?? process.env.PUERTO ?? 3001)

app.listen(PUERTO, () => {
  console.log(`API de fatiga escuchando en el puerto ${PUERTO}`)
})
