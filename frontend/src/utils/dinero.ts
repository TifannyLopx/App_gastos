// Formato de dinero a mano (sin Intl) para que se vea igual en Android, iOS y web.
export function formatoMXN(n: number): string {
  const negativo = n < 0;
  const [entero, decimales] = Math.abs(n).toFixed(2).split('.');
  const conComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negativo ? '-' : ''}$${conComas}.${decimales}`;
}

// Convierte lo que teclea el usuario ("1,200.50") a número. Devuelve null si no es válido.
export function leerMonto(texto: string): number | null {
  const limpio = texto.replace(/,/g, '').trim();
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
