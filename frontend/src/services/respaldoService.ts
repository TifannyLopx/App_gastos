import { crearCrud, llamarFuncion } from './crudService'
import type { Respaldo } from '../types'

export const verRespaldos = crearCrud<Respaldo>('respaldos').ver

// avisa que ya guardaste tu copia local de todo lo anterior a `hasta` ('AAAA-MM-01')
export const registrarRespaldo = (hasta: string) => llamarFuncion('registrar_respaldo', { p_hasta: hasta })

// borra de la nube lo anterior a `antesDe`. El servidor exige que TODA la familia haya guardado su copia
export const borrarMesesRespaldados = (antesDe: string) =>
  llamarFuncion<{ gastos: number; pagos: number }>('borrar_meses_respaldados', { p_antes_de: antesDe })
