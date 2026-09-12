// Service worker mínimo: habilita la instalación como aplicación de escritorio.
// No cachea respuestas a propósito: los datos de fatiga deben venir siempre del servidor
// y una copia obsoleta podría mostrar un riesgo que ya cambió.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (evento) => evento.respondWith(fetch(evento.request)))
