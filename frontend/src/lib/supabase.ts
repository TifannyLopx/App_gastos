import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY

// si faltan variables esto será util :D
if (!url || !key) {
  throw new Error('Faltan variables en el .env')
}

// la conexión se crea una sola vez
export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,      // dónde se guarda la sesión para no estarla poniendo a cada rato
    persistSession: true,       // que no se borre al cerrar la app
    autoRefreshToken: true,     // renueva la sesión sola
    detectSessionInUrl: false,  // esto es para web si no se quita busca una url la cual no existe en cel
  },
})