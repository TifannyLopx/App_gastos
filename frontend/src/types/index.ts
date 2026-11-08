// Tipos que reflejan las tablas y funciones de Supabase (ver backend/sql/13_mejoras.sql).
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
  // porcentajes del presupuesto (antes eran 35/20/15 fijos)
  pct_obligatorio: number;
  pct_necesario: number;
  pct_chucheria: number;
}

// 'efectivo' es una cuenta por persona (se crea sola); no se puede borrar
export type TipoCuenta = 'credito' | 'debito' | 'efectivo';

export interface Tarjeta {
  id: number;
  familia_id: number;
  titular_id: string;
  nombre: string;
  tipo_pago: TipoCuenta;
  dia_corte: number | null;
  dia_pago: number | null;
  limite_credito: number | null; // solo crédito
  saldo: number; // solo débito y efectivo: dinero que hay
  deuda_inicial: number; // solo crédito: lo que ya se debía antes de usar la app
  control_desde: string;
  cuenta_pago_id: number | null; // solo crédito: con qué cuenta se paga
}

// familia_id y titular_id los pone la base de datos sola
export interface NuevaTarjeta {
  nombre: string;
  tipo_pago: TipoCuenta;
  dia_corte?: number | null;
  dia_pago?: number | null;
  limite_credito?: number | null;
  saldo?: number;
  deuda_inicial?: number;
  cuenta_pago_id?: number | null;
}

export interface Gasto {
  id: number;
  familia_id: number;
  usuario_id: string | null;
  tarjeta_id: number | null; // null = efectivo de antes de las cuentas
  monto: number;
  motivo: string; // aquí viaja la categoría codificada, ver utils/categorias.ts
  fecha_compra: string; // 'YYYY-MM-DD'
  msi: number | null;
  creada_el: string;
  // solo en gastos que vienen del archivo local (la tarjeta o la persona pudieron borrarse)
  archivado?: { usuario: string; tarjeta: string | null; forma: FormaPago };
}

// familia_id y usuario_id los pone la base de datos sola
export interface NuevoGasto {
  tarjeta_id: number | null;
  monto: number;
  motivo: string;
  fecha_compra: string;
  msi: number | null;
}

// Una fila de ver_resumen (una por persona).
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

export type TipoReparto = 'siguiente_mes' | 'ahorro' | 'meta';

export interface Reparto {
  id: number;
  cierre_id: number;
  usuario_id: string;
  tipo: TipoReparto;
  meta_id: number | null;
  monto: number;
}

// lo que se manda a guardar_reparto (lo que no se reparte se va al mes siguiente)
export interface ItemReparto {
  tipo: TipoReparto;
  meta_id?: number;
  monto: number;
}

export interface AhorroPersona {
  usuario_id: string;
  nombre: string;
  ahorro: number;
}

export interface Meta {
  id: number;
  nombre: string;
  objetivo: number;
  ahorrado: number;
}

export interface MovimientoMeta {
  id: number;
  meta_id: number;
  usuario_id: string;
  monto: number; // + mete dinero, - saca
  desde_ahorro: boolean;
  nota: string | null;
  creada_el: string;
}

// Una fila de ver_estado_tarjetas: números ya calculados por el servidor.
export interface EstadoCuenta {
  tarjeta_id: number;
  tipo_pago: TipoCuenta;
  saldo: number;
  limite_credito: number | null;
  usado: number | null;
  disponible_credito: number | null;
  a_pagar: number | null; // ya facturado y sin pagar
  apartado: number | null; // lo que hay que tener listo: a pagar + lo que se factura en el próximo corte
  ultimo_corte: string | null;
  prox_corte: string | null;
  fecha_limite_pago: string | null; // solo si hay algo por pagar
  prox_pago: string | null;
  apartado_en_cuenta: number | null; // débito/efectivo: reservado para pagar créditos
  libre: number | null; // débito/efectivo: saldo - apartado
}

export interface GastoRecurrente {
  id: number;
  usuario_id: string;
  tarjeta_id: number | null;
  motivo: string;
  monto: number;
  cada_dias: number;
  msi: number | null;
  proxima_fecha: string;
  activo: boolean;
}

export interface NuevoGastoRecurrente {
  tarjeta_id: number | null;
  motivo: string;
  monto: number;
  cada_dias: number;
  msi?: number | null;
  proxima_fecha: string;
}

export interface Respaldo {
  usuario_id: string;
  hasta: string;
}

export type FormaPago = 'contado' | 'credito' | 'msi';

// meta que antes vivía solo en el teléfono (para pasarla a la nube una vez)
export interface MetaLocal {
  id: string;
  nombre: string;
  objetivo: number;
}
