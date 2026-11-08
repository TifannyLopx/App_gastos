import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { escucharSesion, verSesion } from '../services/authService';

interface AuthValor {
  sesion: Session | null;
  cargando: boolean; // true mientras revisa si ya había una sesión guardada
}

const AuthContext = createContext<AuthValor>({ sesion: null, cargando: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // 1) sesión que ya estaba guardada en el teléfono
    verSesion()
      .then(setSesion)
      .catch(() => setSesion(null))
      .finally(() => setCargando(false));
    // 2) cambios futuros (login, logout, token renovado); regresa la función para dejar de escuchar
    return escucharSesion(setSesion);
  }, []);

  return <AuthContext.Provider value={{ sesion, cargando }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
