import type { Familia, Gasto } from '../types';

// ---- Reglas de presupuesto ----
// Los porcentajes (por defecto 35 / 20 / 15) ahora se guardan en la familia y se editan en
// Ajustes. Se calculan sobre el límite del mes (aportación + arrastre).
export type CategoriaId = 'obligatorio' | 'necesario' | 'chucheria';

export interface Categoria {
  id: CategoriaId;
  nombre: string;
  porcentaje: number; // 0.35 = 35 %
  color: string;
  ejemplo: string;
}

const BASE: Omit<Categoria, 'porcentaje'>[] = [
  { id: 'obligatorio', nombre: 'Obligatorios', color: '#4F46E5', ejemplo: 'renta, servicios, deudas' },
  { id: 'necesario', nombre: 'Necesarios', color: '#0EA5E9', ejemplo: 'súper, transporte, salud' },
  { id: 'chucheria', nombre: 'Chucherías', color: '#EC4899', ejemplo: 'galletas, antojos, salidas' },
];

export const PORCENTAJES_POR_DEFECTO = { obligatorio: 35, necesario: 20, chucheria: 15 };

// categorías con los porcentajes de la familia (o los de por defecto si todavía no cargan)
export function categoriasDe(familia: Familia | null): Categoria[] {
  const pct: Record<CategoriaId, number> = familia
    ? { obligatorio: familia.pct_obligatorio, necesario: familia.pct_necesario, chucheria: familia.pct_chucheria }
    : PORCENTAJES_POR_DEFECTO;
  return BASE.map((c) => ({ ...c, porcentaje: pct[c.id] / 100 }));
}

// Compatibilidad: lista con los porcentajes por defecto (para código que no tiene la familia a la mano)
export const CATEGORIAS: Categoria[] = categoriasDe(null);

export function porcentajeLibre(categorias: Categoria[]): number {
  return Math.max(0, 1 - categorias.reduce((s, c) => s + c.porcentaje, 0));
}

// Etiqueta opcional para detallar el gasto (transporte, hogar...).
export const ETIQUETAS = [
  { id: 'transporte', nombre: 'Transporte' },
  { id: 'hogar', nombre: 'Hogar' },
  { id: 'universidad', nombre: 'Universidad' },
  { id: 'restaurante', nombre: 'Restaurante' },
] as const;
export type EtiquetaId = (typeof ETIQUETAS)[number]['id'];

export const categoriaPorId = (id: CategoriaId | null) => BASE.find((c) => c.id === id) ?? null;
export const colorDeCategoria = (id: CategoriaId | null) => categoriaPorId(id)?.color ?? '#9CA3AF';

// ---- La tabla gastos no tiene columna de categoría, así que la guardamos dentro de `motivo`
// con el formato:  [categoria|etiqueta] texto     ej.  [chucheria] Galletas
// Es la única parte del frontend que sabe esto.
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
  const categoria = BASE.find((c) => c.id === m[1])?.id ?? null;
  const etiqueta = ETIQUETAS.find((e) => e.id === m[2])?.id ?? null;
  if (!categoria) return { texto: guardado, categoria: null, etiqueta: null };
  return { texto: m[3], categoria, etiqueta };
}

export const categoriaDeGasto = (g: Gasto) => leerMotivo(g.motivo).categoria;
