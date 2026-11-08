import { crearCrud, llamarFuncion } from './crudService'
import { fechaLocal } from './fechas'
import type { GastoRecurrente, NuevoGastoRecurrente } from '../types'

// gastos automáticos: "cada X días se gasta $Y". El servidor los crea solo todos los días
const recurrentes = crearCrud<GastoRecurrente | NuevoGastoRecurrente>('gastos_recurrentes')

export const crearRecurrente = (datos: NuevoGastoRecurrente) => recurrentes.crear(datos)
export const verRecurrentes = recurrentes.ver
export const editarRecurrente = (id: number, cambios: Partial<GastoRecurrente>) => recurrentes.editar(id, cambios)
export const borrarRecurrente = recurrentes.borrar

// la app la llama al abrirse para que lo de hoy aparezca al momento
export const generarMisRecurrentes = () =>
  llamarFuncion<number>('generar_mis_recurrentes', { p_hoy: fechaLocal(new Date()) })
