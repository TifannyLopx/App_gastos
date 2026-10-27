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

// A quién se le descuenta: al dueño de la tarjeta, o a quien pagó si fue efectivo.
export function responsableDe(g: Gasto, tarjetas: Tarjeta[]): string | null {
  const t = tarjetas.find((x) => x.id === g.tarjeta_id);
  return t?.titular_id ?? g.usuario_id;
}

export function formaPagoDe(g: Gasto, tarjetas: Tarjeta[]): FormaPago {
  if (g.msi && g.msi > 1) return 'msi';
  const t = tarjetas.find((x) => x.id === g.tarjeta_id);
  return t?.tipo_pago === 'credito' ? 'credito' : 'contado';
}

export const NOMBRE_FORMA_PAGO: Record<FormaPago, string> = {
  contado: 'Contado',
  credito: 'Crédito',
  msi: 'MSI',
};
