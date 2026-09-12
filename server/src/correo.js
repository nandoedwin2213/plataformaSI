const REMITENTE = process.env.CORREO_REMITENTE ?? 'PlataformaSI <onboarding@resend.dev>'

export function correoConfigurado() {
  return Boolean(process.env.RESEND_API_KEY)
}

function plantilla(codigo, minutos) {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#0f172a;padding:32px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" style="margin:0 auto;max-width:520px;background:#111c33;border:1px solid #1e3a5f;border-radius:16px">
      <tr>
        <td style="padding:28px 32px">
          <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#22d3ee">Fuerza Aérea Ecuatoriana</p>
          <h1 style="margin:8px 0 16px;font-size:20px;color:#ffffff">PlataformaSI · Código de acceso</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#cbd5f5">
            Usa este código para completar tu ingreso. Caduca en ${minutos} minutos y sirve una sola vez.
          </p>
          <p style="margin:0 0 20px;padding:16px;text-align:center;font-size:32px;letter-spacing:10px;font-weight:700;color:#22d3ee;background:#0b1220;border:1px solid #1e3a5f;border-radius:12px">
            ${codigo}
          </p>
          <p style="margin:0;font-size:12px;line-height:20px;color:#94a3b8">
            Si no solicitaste este acceso, ignora este mensaje; nadie puede ingresar sin el código.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function enviarCodigo(correo, codigo, minutos) {
  const clave = process.env.RESEND_API_KEY
  if (!clave) throw new Error('Falta RESEND_API_KEY para enviar el código de acceso')

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clave}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: REMITENTE,
      to: [correo],
      subject: `Código de acceso PlataformaSI: ${codigo}`,
      html: plantilla(codigo, minutos),
    }),
  })

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    throw new Error(`Resend respondió ${respuesta.status}: ${detalle.slice(0, 200)}`)
  }
}
