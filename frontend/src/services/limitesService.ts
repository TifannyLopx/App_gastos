import { supabase } from '../lib/supabase'
import { crearCrud, aplicarOpciones, OpcionesVer } from './crudService'
import { traducirError } from './errores'
import { inicioDeMes } from './fechas'

const limites = crearCrud('limites')

export const crearAportacion = limites.crear
export const verAportaciones = limites.ver
export const editarAportacion = limites.editar

// resumen del mes por persona, con filtros y orden

export async function verResumen(fecha: Date = new Date(), opciones: OpcionesVer = {}) {
  const query = supabase.rpc('ver_resumen', { p_mes: inicioDeMes(fecha) } as any)
  const { data, error } = await aplicarOpciones(query, opciones)
  if (error) throw traducirError(error)
  return data
}