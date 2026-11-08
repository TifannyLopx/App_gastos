// Manda una notificación push a los demás de la familia cuando alguien registra un gasto.
// Se dispara con un Database Webhook sobre INSERT en la tabla `gastos` (ver INSTRUCCIONES en el informe).
// Los tokens están en la tabla `dispositivos`; el envío usa el servicio gratuito de Expo Push.
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const { record } = await req.json()
  if (!record?.familia_id || !record?.usuario_id) {
    return new Response(JSON.stringify({ ok: true, enviados: 0 }))
  }

  // cliente admin: las llaves las pone Supabase solo, no van en ningún archivo
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // quién gastó y quiénes más hay en la familia
  const { data: miembros } = await admin
    .from('usuarios')
    .select('id, nombre')
    .eq('familia_id', record.familia_id)

  const autor = miembros?.find((m) => m.id === record.usuario_id)
  const otros = (miembros ?? []).filter((m) => m.id !== record.usuario_id).map((m) => m.id)
  if (!autor || otros.length === 0) {
    return new Response(JSON.stringify({ ok: true, enviados: 0 }))
  }

  const { data: dispositivos } = await admin.from('dispositivos').select('token').in('usuario_id', otros)
  if (!dispositivos?.length) {
    return new Response(JSON.stringify({ ok: true, enviados: 0 }))
  }

  // el motivo viene como "[categoria|etiqueta] texto": se le quita la marca
  const texto = String(record.motivo ?? '').replace(/^\[[a-z|]+\]\s*/, '')
  const monto = Number(record.monto).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
  const meses = record.msi && record.msi > 1 ? ` a ${record.msi} MSI` : ''

  const mensajes = dispositivos.map((d) => ({
    to: d.token,
    sound: 'default',
    title: `${autor.nombre} registró un gasto`,
    body: `${monto}${meses} · ${texto}`,
    data: { tipo: 'gasto', gasto_id: record.id },
  }))

  const respuesta = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(mensajes),
  })
  const resultado = await respuesta.json().catch(() => ({}))

  // si Expo dice que un token ya no sirve (app desinstalada), se borra
  const invalidos: string[] = []
  ;(resultado?.data ?? []).forEach((r: { status: string; details?: { error?: string } }, i: number) => {
    if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered') invalidos.push(dispositivos[i].token)
  })
  if (invalidos.length) await admin.from('dispositivos').delete().in('token', invalidos)

  return new Response(JSON.stringify({ ok: true, enviados: dispositivos.length - invalidos.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
