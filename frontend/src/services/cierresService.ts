import { crearCrud, llamarFuncion } from './crudService'
import { inicioDeMes } from './fechas'

type Destino = 'siguiente_mes' | 'ahorro'

const cierres = crearCrud('cierres')

export const verCierres = cierres.ver

// por defecto cierra el mes pasado
export function cerrarMes(destino: Destino, fecha?: Date) {
  return llamarFuncion('cerrar_mes', {
    p_destino: destino,
    ...(fecha && { p_mes: inicioDeMes(fecha) }),
  })
}

export function editarCierre(fecha: Date, destino: Destino) {
  return llamarFuncion('editar_cierre', { p_mes: inicioDeMes(fecha), p_destino: destino })
}

export function verAhorro() {
  return llamarFuncion('ver_ahorro')
}

// ---- reparto del sobrante a la medida ----
// reparto = [{ tipo: 'siguiente_mes' | 'ahorro' | 'meta', meta_id?, monto }]
// lo que no se reparta se va al mes siguiente. Si el mes aún no estaba cerrado, lo cierra.
export function guardarReparto(fecha: Date, reparto: { tipo: string; meta_id?: number; monto: number }[]) {
  return llamarFuncion('guardar_reparto', { p_mes: inicioDeMes(fecha), p_reparto: reparto })
}

export const verRepartos = crearCrud('cierre_repartos').ver
