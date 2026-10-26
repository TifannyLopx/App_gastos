// conviertir los errores de supabase en mensajes que entienda el usuario
const mensajes: Record<string, string> = {
  // errores de la db
  '23505': 'Ese registro ya existe',
  '23503': 'Hace referencia a algo que no existe',
  '23514': 'Algún dato no es válido',
  '23502': 'Falta un dato obligatorio',
  '42501': 'No tienes permiso para hacer eso',
  'PGRST116': 'No se encontró o no tienes permiso',
  // errores de login
  invalid_credentials: 'Correo o contraseña incorrectos',
  user_already_exists: 'Ya hay una cuenta con ese correo',
  email_not_confirmed: 'Confirma tu correo antes de entrar',
  weak_password: 'La contraseña es muy débil, minimo 8 caracteres, una mayúscula, una minúscula y un número',
}

export function traducirError(error: { code?: string; message: string }): Error {
  // P0001 son los raise exception 
  if (error.code === 'P0001') return new Error(error.message)

  // este solo tiff lo usa, solo desarrolladores
  if (__DEV__) console.warn(error)

  const mensaje = (error.code && mensajes[error.code]) || 'Algo salió mal, intenta de nuevo'
  return new Error(mensaje)
}