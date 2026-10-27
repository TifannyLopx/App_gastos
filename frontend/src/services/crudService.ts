import { supabase } from '../lib/supabase'
import { traducirError } from './errores'

// operadores para filtros: igual, diferente, mayor, mayor o igual, menor, menor o igual, buscar texto, lista, nulo
export type Operador = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'in' | 'is'

// un filtro, ejemplirijillo. { campo: 'monto', op: 'gt', valor: 500 }
export type Filtro = {
  campo: string
  op: Operador
  valor: unknown
}

// todo lo que se puede pedir al ver una lista
export type OpcionesVer = {
  filtros?: Filtro[]
  orden?: { campo: string; asc?: boolean }
  limite?: number   
  pagina?: number     
  columnas?: string   
}

// pone filtros, orden y páginas a cualquier consulta
export function aplicarOpciones(query: any, opciones: OpcionesVer = {}) {
  const { filtros = [], orden, limite, pagina = 1 } = opciones

  for (const f of filtros) {
    query = f.op === 'in'
      ? query.in(f.campo, f.valor as unknown[])
      : query.filter(f.campo, f.op, f.valor)
  }

  if (orden) {
    query = query.order(orden.campo, { ascending: orden.asc ?? true })
  }

  if (limite) {
    const desde = (pagina - 1) * limite
    query = query.range(desde, desde + limite - 1)
  }

  return query
}

// crea el crud completo de la tabla que le pidamos
export function crearCrud<T = any>(tabla: string) {
  return {
    // insert, regresa lo que se guardó
    async crear(datos: Partial<T>): Promise<T> {
      const { data, error } = await supabase.from(tabla).insert(datos as any).select().single()
      if (error) throw traducirError(error)
      return data
    },

    // select de varios, con filtros, orden y páginas opcionales
    async ver(opciones?: OpcionesVer): Promise<T[]> {
      const query = supabase.from(tabla).select(opciones?.columnas ?? '*')
      const { data, error } = await aplicarOpciones(query, opciones)
      if (error) throw traducirError(error)
      return data
    },

    // select de uno por su id
    async verUno(id: number | string): Promise<T> {
      const { data, error } = await supabase.from(tabla).select('*').eq('id', id).single()
      if (error) throw traducirError(error)
      return data
    },

    // update, regresa cómo quedó
    async editar(id: number | string, cambios: Partial<T>): Promise<T> {
      const { data, error } = await supabase.from(tabla).update(cambios as any).eq('id', id).select().single()
      if (error) throw traducirError(error)
      return data
    },

    // delete, si RLS no te deja no truena solo, por eso revisamos que sí borró algo
    async borrar(id: number | string): Promise<void> {
      const { data, error } = await supabase.from(tabla).delete().eq('id', id).select()
      if (error) throw traducirError(error)
      if (!data?.length) throw new Error('No se encontró o no tienes permiso')
    },
  }
}
// llama una función de sql
export async function llamarFuncion<T = any>(nombre: string, parametros?: object): Promise<T> {
  const { data, error } = await supabase.rpc(nombre, parametros as any)
  if (error) throw traducirError(error)
  return data
}