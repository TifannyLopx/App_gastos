import type { Gasto } from '../types';

// ---- Reglas de presupuesto: 35 / 20 / 15 ----
// El porcentaje se calcula sobre el límite del mes (aportación + arrastre).
// Si algún día cambian los porcentajes, solo se editan estos números.
export type CategoriaId = 'obligatorio' | 'necesario' | 'chucheria';

export interface Categoria {
  id: CategoriaId;
  nombre: string;
  porcentaje: number; // 0.35 = 35 %
  color: string;
  ejemplo: string;
}

export const CATEGORIAS: Categoria[] = [
  { id: 'obligatorio', nombre: 'Obligatorios', porcentaje: 0.35, color: '#4F46E5', ejemplo: 'renta, servicios, deudas' },
  { id: 'necesario', nombre: 'Necesarios', porcentaje: 0.2, color: '#0EA5E9', ejemplo: 'súper, transporte, salud' },
  { id: 'chucheria', nombre: 'Chucherías', porcentaje: 0.15, color: '#EC4899', ejemplo: 'galletas, antojos, salidas' },
];

export const PORCENTAJE_LIBRE = 1 - CATEGORIAS.reduce((s, c) => s + c.porcentaje, 0);

// Etiqueta opcional para detallar el gasto (transporte, hogar...).
export const ETIQUETAS = [
  { id: 'transporte', nombre: 'Transporte' },
  { id: 'hogar', nombre: 'Hogar' },
  { id: 'universidad', nombre: 'Universidad' },
  { id: 'restaurante', nombre: 'Restaurante' },
] as const;
export type EtiquetaId = (typeof ETIQUETAS)[number]['id'];

export const categoriaPorId = (id: CategoriaId | null) => CATEGORIAS.find((c) => c.id === id) ?? null;

// ---- La tabla gastos no tiene columna de categoría, así que la guardamos dentro de `motivo`
// con el formato:  [categoria|etiqueta] texto     ej.  [chucheria] Galletas
// Es la única parte del frontend que sabe esto: si algún día hay columna propia,
// solo cambian estas dos funciones.
export function codificarMotivo(motivo: string, categoria: CategoriaId, etiqueta: EtiquetaId | null): string {
  const marca = etiqueta ? `${categoria}|${etiqueta}` : categoria;
  return `[${marca}] ${motivo.trim()}`;
}

export interface MotivoLeido {
  texto: string;
  categoria: CategoriaId | null;
  etiqueta: EtiquetaId | null;
}

export function leerMotivo(guardado: string): MotivoLeido {
  const m = /^\[([a-z]+)(?:\|([a-z]+))?\]\s*(.*)$/s.exec(guardado);
  if (!m) return { texto: guardado, categoria: null, etiqueta: null };
  const categoria = CATEGORIAS.find((c) => c.id === m[1])?.id ?? null;
  const etiqueta = ETIQUETAS.find((e) => e.id === m[2])?.id ?? null;
  if (!categoria) return { texto: guardado, categoria: null, etiqueta: null };
  return { texto: m[3], categoria, etiqueta };
}

export const categoriaDeGasto = (g: Gasto) => leerMotivo(g.motivo).categoria;
