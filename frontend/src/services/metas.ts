import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Meta } from '../types';

// Las metas de ahorro se guardan solo en este teléfono (no hay tabla para ellas en Supabase).
const clave = (familiaId: number) => `metas:${familiaId}`;

export async function cargarMetas(familiaId: number): Promise<Meta[]> {
  try {
    const crudo = await AsyncStorage.getItem(clave(familiaId));
    return crudo ? (JSON.parse(crudo) as Meta[]) : [];
  } catch {
    return [];
  }
}

export async function guardarMetas(familiaId: number, metas: Meta[]) {
  await AsyncStorage.setItem(clave(familiaId), JSON.stringify(metas));
}
