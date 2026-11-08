import { crearCrud, llamarFuncion } from './crudService'
import type { Meta, MovimientoMeta } from '../types'

const metas = crearCrud<{ id: number; nombre: string; objetivo: number }>('metas')
const movimientos = crearCrud<MovimientoMeta>('movimientos_meta')

export const crearMeta = (datos: { nombre: string; objetivo: number }) => metas.crear(datos)
export const editarMeta = (id: number, cambios: { nombre?: string; objetivo?: number }) => metas.editar(id, cambios)
export const borrarMeta = metas.borrar

// metas con cuánto lleva cada una
export const verMetas = () => llamarFuncion<Meta[]>('ver_metas')

// monto positivo = mete dinero, negativo = saca. desdeAhorro: el dinero sale (o regresa) a tu ahorro libre
export function moverMeta(metaId: number, monto: number, desdeAhorro: boolean, nota?: string) {
  return llamarFuncion('mover_meta', {
    p_meta: metaId,
    p_monto: monto,
    p_desde_ahorro: desdeAhorro,
    ...(nota ? { p_nota: nota } : {}),
  })
}

export const verMovimientosMeta = movimientos.ver
export const borrarMovimientoMeta = movimientos.borrar
