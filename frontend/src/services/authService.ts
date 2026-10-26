import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { traducirError } from './errores'

// crea la cuenta, el nombre llega al trigger y se le crea su familia
export async function registrarse(nombre: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre } },
  })
  if (error) throw traducirError(error)
  return data.user
}

export async function iniciarSesion(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw traducirError(error)
  return data.user
}

export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut()
  if (error) throw traducirError(error)
}

// regresa la sesión guardada en el cel, o null si no hay
export async function verSesion() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw traducirError(error)
  return data.session
}

// avisa cada que alguien entra o sale, para que tu novio cambie de pantalla
// regresa una función para dejar de escuchar
export function escucharSesion(callback: (sesion: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => callback(sesion))
  return () => data.subscription.unsubscribe()
}