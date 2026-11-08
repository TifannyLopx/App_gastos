import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MetaLocal } from '../types';

// Las metas de ahorro se guardan solo en este teléfono (no hay tabla para ellas en Supabase).
const clave = (familiaId: number) => `metas:${familiaId}`;

export async function cargarMetas(familiaId: number): Promise<MetaLocal[]> {
  try {
    const crudo = await AsyncStorage.getItem(clave(familiaId));
    return crudo ? (JSON.parse(crudo) as MetaLocal[]) : [];
  } catch {
    return [];
  }
}

export async function guardarMetas(familiaId: number, metas: MetaLocal[]) {
  await AsyncStorage.setItem(clave(familiaId), JSON.stringify(metas));
}

// borra las metas locales (después de pasarlas a la nube)
export async function borrarMetasLocales(familiaId: number) {
  await AsyncStorage.removeItem(clave(familiaId));
}
