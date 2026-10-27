import { crearCrud, llamarFuncion, OpcionesVer } from './crudService'

const familias = crearCrud('familias')
const usuarios = crearCrud('usuarios')

export async function verFamilia() {
  const [familia] = await familias.ver()
  return familia
}

// solo el admin puede
export async function editarFamilia(cambios: { nombre: string }) {
  const familia = await verFamilia()
  return familias.editar(familia.id, cambios)
}

export function verMiembros(opciones?: OpcionesVer) {
  return usuarios.ver(opciones)
}

export function unirseFamilia(codigo: string) {
  return llamarFuncion('unirse_familia', { codigo })
}

export function salirFamilia() {
  return llamarFuncion('salir_familia')
}

export function expulsarMiembro(miembroId: string) {
  return llamarFuncion('expulsar_miembro', { miembro: miembroId })
}

// regresa el código nuevo
export function regenerarCodigo() {
  return llamarFuncion<string>('regenerar_codigo')
}