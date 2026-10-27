import { crearCrud, OpcionesVer } from './crudService'
import { inicioDeMes, inicioDeMesSiguiente } from './fechas'

const gastos = crearCrud('gastos')

export const crearGasto = gastos.crear
export const verGastos = gastos.ver
export const verGasto = gastos.verUno
export const editarGasto = gastos.editar
export const borrarGasto = gastos.borrar

// gastos comprados en un mes (por defecto este mes), por fecha de compra
export function verGastosDelMes(fecha: Date = new Date(), opciones: OpcionesVer = {}) {
  return gastos.ver({
    ...opciones,
    filtros: [
      ...(opciones.filtros ?? []),
      { campo: 'fecha_compra', op: 'gte', valor: inicioDeMes(fecha) },
      { campo: 'fecha_compra', op: 'lt', valor: inicioDeMesSiguiente(fecha) },
    ],
  })
}
