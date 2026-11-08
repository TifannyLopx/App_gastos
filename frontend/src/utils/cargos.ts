import type { Gasto, Tarjeta, FormaPago } from '../types';
import { diferenciaMeses, inicioMes } from './fechas';
import { redondear } from './dinero';

// Cuánto le pega un gasto a un mes concreto.
// Contado/crédito sin MSI = todo en el mes de la compra. MSI = monto / meses, un mes tras otro.
// (Misma regla que usa ver_resumen en la base de datos.)
export function montoEnMes(g: Gasto, mes: string): number {
  const meses = g.msi ?? 1;
  const offset = diferenciaMeses(inicioMes(g.fecha_compra), mes);
  return offset >= 0 && offset < meses ? redondear(g.monto / meses) : 0;
}

// Número de cuota que toca en un mes ("3 de 10"), o null si no aplica.
export function cuotaEnMes(g: Gasto, mes: string): number | null {
  const meses = g.msi ?? 1;
  const offset = diferenciaMeses(inicioMes(g.fecha_compra), mes);
  return offset >= 0 && offset < meses ? offset + 1 : null;
}

// Último mes en el que un gasto todavía cobra algo (para poder ver meses futuros de MSI).
export function ultimoMesDeCobro(g: Gasto): string {
  const meses = g.msi ?? 1;
  const ini = inicioMes(g.fecha_compra);
  const y = Number(ini.slice(0, 4));
  const m = Number(ini.slice(5, 7)) - 1 + (meses - 1);
  const anio = y + Math.floor(m / 12);
  const mes = (m % 12) + 1;
  return `${anio}-${String(mes).padStart(2, '0')}-01`;
}

// A quién se descuenta: al dueño de la tarjeta, o a quien pagó si fue efectivo.
export function responsableDe(g: Gasto, tarjetas: Tarjeta[]): string | null {
  const t = tarjetas.find((x) => x.id === g.tarjeta_id);
  return t?.titular_id ?? g.usuario_id;
}

export function formaPagoDe(g: Gasto, tarjetas: Tarjeta[]): FormaPago {
  if (g.archivado) return g.archivado.forma;
  if (g.msi && g.msi > 1) return 'msi';
  const t = tarjetas.find((x) => x.id === g.tarjeta_id);
  return t?.tipo_pago === 'credito' ? 'credito' : 'contado';
}

export const NOMBRE_FORMA_PAGO: Record<FormaPago, string> = {
  contado: 'Contado',
  credito: 'Crédito',
  msi: 'MSI',
};

// Gastos del archivo local + los de la nube, sin repetir (si uno está en ambos manda el de la nube).
export function unirGastos(nube: Gasto[], archivo: Gasto[]): Gasto[] {
  const ids = new Set(nube.map((g) => g.id));
  return [...nube, ...archivo.filter((g) => !ids.has(g.id))];
}

// Un gasto ya terminó de cobrarse antes de `corte` (mismo criterio que borrar_meses_respaldados).
export function terminoAntesDe(g: Gasto, corte: string): boolean {
  const ini = inicioMes(g.fecha_compra);
  const y = Number(ini.slice(0, 4));
  const m = Number(ini.slice(5, 7)) - 1 + (g.msi ?? 1);
  const fin = `${y + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-01`;
  return fin <= corte;
}
