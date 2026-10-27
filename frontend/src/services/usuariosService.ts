import { supabase } from '../lib/supabase'
import { crearCrud } from './crudService'
import { traducirError } from './errores'

const usuarios = crearCrud('usuarios')

// id de quien está logueado
async function miId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('No hay sesión')
  return data.session.user.id
}

export async function verPerfil() {
  return usuarios.verUno(await miId())
}

// solo se puede editar nombre y salario
export async function editarPerfil(cambios: { nombre?: string; salario?: number }) {
  return usuarios.editar(await miId(), cambios)
}

// borra la cuenta con la edge function y cierra sesión
export async function borrarCuenta() {
  const { error } = await supabase.functions.invoke('borrar-cuenta')
  if (error) throw new Error('No se pudo borrar la cuenta')
  await supabase.auth.signOut()
}