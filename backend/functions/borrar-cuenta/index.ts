/*
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // cliente admin, las llaves las pone supabase solo, no van en ningún archivo
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // saca quién está pidiendo a partir de su token de sesión
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const { data, error } = await admin.auth.getUser(token)

  if (error || !data.user) {
    return new Response(JSON.stringify({ error: 'Sin sesión' }), { status: 401 })
  }

  // borra la cuenta, la base borra en cascada su perfil, tarjetas y límites
  const { error: errorBorrar } = await admin.auth.admin.deleteUser(data.user.id)

  if (errorBorrar) {
    return new Response(JSON.stringify({ error: errorBorrar.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})*/