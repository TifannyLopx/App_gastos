// regresa el día 1 del mes en formato 'AAAA-MM-01',como lo guarda la db
export function inicioDeMes(fecha: Date = new Date()): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')  // enero es 0 en js, por eso el +1
  return `${anio}-${mes}-01`
}

// el día 1 del mes siguiente, sirve para filtrar "este mes"
export function inicioDeMesSiguiente(fecha: Date = new Date()): string {
  return inicioDeMes(new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1))
}