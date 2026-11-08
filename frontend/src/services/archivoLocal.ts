import * as SQLite from 'expo-sqlite'
import type { Gasto } from '../types'

// Archivo de meses viejos: vive en una base SQLite DENTRO del teléfono (no depende de internet).
// Cada gasto se guarda con los nombres ya escritos, porque la tarjeta o la persona pudieron borrarse después.
let abierta: Promise<SQLite.SQLiteDatabase> | null = null

function db() {
  if (!abierta) {
    abierta = (async () => {
      const base = await SQLite.openDatabaseAsync('archivo.db')
      await base.execAsync(`
        CREATE TABLE IF NOT EXISTS gastos_archivo (
          id INTEGER PRIMARY KEY,
          familia_id INTEGER,
          usuario_id TEXT,
          usuario TEXT,
          tarjeta_id INTEGER,
          tarjeta TEXT,
          forma TEXT,
          monto REAL NOT NULL,
          motivo TEXT NOT NULL,
          fecha_compra TEXT NOT NULL,
          msi INTEGER,
          creada_el TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_archivo_fecha ON gastos_archivo (fecha_compra);
      `)
      return base
    })()
  }
  return abierta
}

type Fila = {
  id: number; familia_id: number; usuario_id: string | null; usuario: string; tarjeta_id: number | null
  tarjeta: string | null; forma: string; monto: number; motivo: string; fecha_compra: string
  msi: number | null; creada_el: string
}

// guarda (o actualiza) gastos en el archivo; devuelve cuántos
export async function guardarEnArchivo(
  gastos: Gasto[],
  nombres: { usuario: (id: string | null) => string; tarjeta: (id: number | null) => string | null; forma: (g: Gasto) => string },
): Promise<number> {
  const base = await db()
  await base.withTransactionAsync(async () => {
    for (const g of gastos) {
      await base.runAsync(
        `INSERT OR REPLACE INTO gastos_archivo
         (id, familia_id, usuario_id, usuario, tarjeta_id, tarjeta, forma, monto, motivo, fecha_compra, msi, creada_el)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        g.id, g.familia_id, g.usuario_id, nombres.usuario(g.usuario_id), g.tarjeta_id,
        nombres.tarjeta(g.tarjeta_id), nombres.forma(g), g.monto, g.motivo, g.fecha_compra, g.msi, g.creada_el,
      )
    }
  })
  return gastos.length
}

export async function leerArchivo(): Promise<Gasto[]> {
  const base = await db()
  const filas = await base.getAllAsync<Fila>('SELECT * FROM gastos_archivo ORDER BY fecha_compra DESC, id DESC')
  return filas.map((f) => ({
    id: f.id,
    familia_id: f.familia_id,
    usuario_id: f.usuario_id,
    tarjeta_id: f.tarjeta_id,
    monto: f.monto,
    motivo: f.motivo,
    fecha_compra: f.fecha_compra,
    msi: f.msi,
    creada_el: f.creada_el,
    archivado: { usuario: f.usuario, tarjeta: f.tarjeta, forma: f.forma as 'contado' | 'credito' | 'msi' },
  }))
}

export async function contarArchivo(): Promise<number> {
  const base = await db()
  const fila = await base.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM gastos_archivo')
  return fila?.n ?? 0
}
