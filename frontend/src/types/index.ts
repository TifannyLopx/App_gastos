// Tipos que reflejan las tablas y funciones que ya existen en Supabase.
// Los ids de usuario son uuid (string) y los demás ids son numéricos.

export type Rol = 'admin' | 'miembro';

export interface Usuario {
  id: string;
  familia_id: number;
  nombre: string;
  rol: Rol;
  salario: number | null;
}

export interface Familia {
  id: number;
  nombre: string;
  codigo_invitacion: string;
}

export type TipoPagoTarjeta = 'credito' | 'debito';

export interface Tarjeta {
  id: number;
  familia_id: number;
  titular_id: string;
  nombre: string;
  tipo_pago: TipoPagoTarjeta;
  dia_corte: number | null;
  dia_pago: number | null;
}

// familia_id y titular_id los pone la base de datos sola (valores por defecto)
export interface NuevaTarjeta {
  nombre: string;
  tipo_pago: TipoPagoTarjeta;
  dia_corte: number | null;
  dia_pago: number | null;
}

export interface Gasto {
  id: number;
  familia_id: number;
  usuario_id: string | null;
  tarjeta_id: number | null; // null = efectivo
  monto: number;
  motivo: string; // ojo: aquí viaja la categoría codificada, ver utils/categorias.ts
  fecha_compra: string; // 'YYYY-MM-DD'
  msi: number | null;
  creada_el: string;
}

// familia_id y usuario_id los pone la base de datos sola (valores por defecto)
export interface NuevoGasto {
  tarjeta_id: number | null;
  monto: number;
  motivo: string;
  fecha_compra: string;
  msi: number | null;
}

// Una fila de la función ver_resumen (una por persona).
export interface ResumenPersona {
  usuario_id: string;
  nombre: string;
  aportacion: number;
  arrastre: number;
  limite: number;
  gastado: number;
  disponible: number;
  disponible_familia: number;
  disponible_real: number;
  sin_limite: boolean;
}

export type DestinoCierre = 'siguiente_mes' | 'ahorro';

export interface Cierre {
  id: number;
  familia_id: number;
  usuario_id: string;
  mes: string;
  limite: number;
  gastado: number;
  sobrante: number;
  destino: DestinoCierre;
}

export interface AhorroPersona {
  usuario_id: string;
  nombre: string;
  ahorro: number;
}

// Meta de ahorro: vive solo en el teléfono (AsyncStorage).
export interface Meta {
  id: string;
  nombre: string;
  objetivo: number;
}

export type FormaPago = 'contado' | 'credito' | 'msi';
