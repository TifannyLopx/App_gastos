// Todas las fechas viajan como texto 'YYYY-MM-DD' (igual que las columnas date de Supabase).
// Así evitamos los líos de zona horaria de Date.
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

const dos = (n: number) => String(n).padStart(2, '0');

export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

// '2026-10-26' -> '2026-10-01'
export function inicioMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

// 'YYYY-MM-DD' -> Date local (los servicios de Tiff piden Date para los meses)
export function aFecha(iso: string): Date {
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

export function sumarMeses(iso: string, n: number): string {
  const anio = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7)) - 1 + n;
  const a = anio + Math.floor(mes / 12);
  const m = ((mes % 12) + 12) % 12;
  return `${a}-${dos(m + 1)}-01`;
}

// Cuántos meses hay de a a b (b - a).
export function diferenciaMeses(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
}

export function sumarDias(iso: string, n: number): string {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
}

export function nombreMes(iso: string): string {
  return `${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

export function fechaCorta(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MESES_CORTOS[Number(iso.slice(5, 7)) - 1]}`;
}
