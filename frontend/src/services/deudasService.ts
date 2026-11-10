import { crearCrud } from './crudService'
import { crearGasto } from './gastosService'
import { hoyISO } from '../utils/fechas'

const deudas = crearCrud('deudas')
const automaticos = crearCrud('gastos_recurrentes')

// la categoría va dentro del motivo, como en todos los gastos
const motivoAbono = (nombre: string) => `[obligatorio] Abono ${nombre}`

export const verDeudas = deudas.ver
export const editarDeuda = deudas.editar
export const borrarDeuda = deudas.borrar   // su abono automático se borra solo

// crea la deuda y, si se pide, su abono automático cada x días
export async function crearDeuda(
  datos: { nombre: string; falta: number; total: number | null; abono: number | null; cada_dias: number | null },
  automatico?: { proximaFecha: string; tarjetaId: number | null },
) {
  const deuda = await deudas.crear(datos)
  if (automatico) {
    await automaticos.crear({
      motivo: motivoAbono(deuda.nombre),
      monto: deuda.abono,
      cada_dias: deuda.cada_dias,
      proxima_fecha: automatico.proximaFecha,
      tarjeta_id: automatico.tarjetaId,
      deuda_id: deuda.id,
    })
  }
  return deuda
}

// abono de cualquier monto, cuenta como gasto y baja lo que falta
export function abonarDeuda(deudaId: number, nombre: string, monto: number, tarjetaId: number | null) {
  return crearGasto({
    monto,
    motivo: motivoAbono(nombre),
    fecha_compra: hoyISO(),   // el abono es de hoy
    msi: null,                // un abono no es a meses
    deuda_id: deudaId,
    tarjeta_id: tarjetaId,
  })
}