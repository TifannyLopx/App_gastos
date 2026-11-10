import { crearCrud, llamarFuncion } from './crudService'
import { fechaLocal } from './fechas'
import type { EstadoCuenta, NuevaTarjeta, Tarjeta } from '../types'
import { supabase } from '../lib/supabase'
import { traducirError } from './errores'

// "tarjetas" son las cuentas: crédito, débito y efectivo
const tarjetas = crearCrud<Tarjeta | NuevaTarjeta>('tarjetas')
const pagos = crearCrud('pagos_tarjeta')

export const crearTarjeta = (datos: NuevaTarjeta) => tarjetas.crear(datos)
export const verTarjetas = tarjetas.ver
export const verTarjeta = tarjetas.verUno
export const editarTarjeta = (id: number, cambios: Partial<NuevaTarjeta>) => tarjetas.editar(id, cambios)
export const borrarTarjeta = tarjetas.borrar

// estado de todas las cuentas: usado/disponible/a pagar de los créditos, y libre/asignado de las demás
export function verEstadoTarjetas(hoy: Date = new Date()) {
  return llamarFuncion<EstadoCuenta[]>('ver_estado_tarjetas', { p_hoy: fechaLocal(hoy) })
}

// pasa dinero entre cuentas de débito/efectivo (la de origen tiene que ser tuya)
export function transferir(origenId: number, destinoId: number, monto: number) {
  return llamarFuncion('transferir', { p_origen: origenId, p_destino: destinoId, p_monto: monto })
}

// "Ya pagué": sin monto paga lo que toca pagar ahora; sin cuenta usa la que tiene asignada la tarjeta
export function pagarTarjeta(tarjetaId: number, opciones: { monto?: number; cuentaId?: number; hoy?: Date } = {}) {
  return llamarFuncion('pagar_tarjeta', {
    p_tarjeta: tarjetaId,
    ...(opciones.monto !== undefined && { p_monto: opciones.monto }),
    ...(opciones.cuentaId !== undefined && { p_cuenta: opciones.cuentaId }),
    p_hoy: fechaLocal(opciones.hoy ?? new Date()),
  })
}

export const deshacerPago = (pagoId: number) => llamarFuncion('deshacer_pago', { p_pago: pagoId })
export const verPagos = pagos.ver

// msi de antes de usar la app
const msiPrevios = crearCrud('msi_previos')

export const crearMsiAnterior = msiPrevios.crear
export const editarMsiAnterior = msiPrevios.editar
export const borrarMsiAnterior = msiPrevios.borrar

// msi activos de todas las tarjetas, los de la app y los anteriores
export async function verMsi() {
  const { data, error } = await supabase.rpc('ver_msi')
  if (error) throw traducirError(error)
  return data
}