import { crearCrud, OpcionesVer } from './crudService'
import { inicioDeMes, inicioDeMesSiguiente } from './fechas'
import type { Gasto, NuevoGasto } from '../types'

const gastos = crearCrud<Gasto | NuevoGasto>('gastos')

export const crearGasto = (datos: NuevoGasto) => gastos.crear(datos)
export const verGastos = gastos.ver
export const verGasto = gastos.verUno
export const editarGasto = (id: number, cambios: Partial<NuevoGasto>) => gastos.editar(id, cambios)
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

// Supabase entrega máximo 1000 filas por consulta: esto pide por páginas hasta traer todos
export async function verTodosLosGastos(): Promise<Gasto[]> {
  const POR_PAGINA = 1000
  const todos: Gasto[] = []
  for (let pagina = 1; pagina <= 50; pagina++) {
    const lote = (await gastos.ver({
      orden: { campo: 'id', asc: false },
      limite: POR_PAGINA,
      pagina,
    })) as Gasto[]
    todos.push(...lote)
    if (lote.length < POR_PAGINA) break
  }
  return todos
}
