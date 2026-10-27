import { crearCrud } from './crudService'

const tarjetas = crearCrud('tarjetas')

export const crearTarjeta = tarjetas.crear
export const verTarjetas = tarjetas.ver
export const verTarjeta = tarjetas.verUno
export const editarTarjeta = tarjetas.editar
export const borrarTarjeta = tarjetas.borrar
