import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import type { Gasto } from '../types'
import { leerMotivo, categoriaPorId } from '../utils/categorias'

const celda = (v: string | number | null | undefined) => {
  const t = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

// Convierte gastos a CSV (se abre en Excel / Hojas de cálculo)
export function gastosACsv(
  gastos: Gasto[],
  nombres: { usuario: (g: Gasto) => string; tarjeta: (g: Gasto) => string; forma: (g: Gasto) => string },
): string {
  const filas = [['fecha', 'quien', 'que', 'categoria', 'detalle', 'monto_total', 'meses_sin_intereses', 'cuota_mensual', 'forma_pago', 'cuenta']]
  for (const g of gastos) {
    const { texto, categoria, etiqueta } = leerMotivo(g.motivo)
    filas.push([
      g.fecha_compra, nombres.usuario(g), texto, categoriaPorId(categoria)?.nombre ?? '', etiqueta ?? '',
      g.monto.toFixed(2), g.msi ? String(g.msi) : '', (g.monto / (g.msi ?? 1)).toFixed(2),
      nombres.forma(g), nombres.tarjeta(g),
    ])
  }
  // el BOM hace que Excel muestre bien los acentos
  return '\uFEFF' + filas.map((f) => f.map(celda).join(',')).join('\n')
}

// Guarda el texto en un archivo temporal y abre el menú de compartir (WhatsApp, Drive, correo...)
export async function compartirArchivo(nombre: string, contenido: string, mimeType: string): Promise<void> {
  const archivo = new File(Paths.cache, nombre)
  if (archivo.exists) archivo.delete()
  archivo.create()
  archivo.write(contenido)
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este dispositivo no puede compartir archivos')
  await Sharing.shareAsync(archivo.uri, { mimeType, dialogTitle: nombre })
}
