import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AhorroPersona, Cierre, Familia, Gasto, ResumenPersona, Tarjeta, Usuario } from '../types';
import { useAuth } from './AuthContext';
import { verPerfil } from '../services/usuariosService';
import { verFamilia, verMiembros } from '../services/familiasService';
import { verGastos } from '../services/gastosService';
import { verTarjetas } from '../services/tarjetasService';
import { verAportaciones, verResumen } from '../services/limitesService';
import { verAhorro, verCierres } from '../services/cierresService';
import { aFecha, hoyISO, inicioMes } from '../utils/fechas';

// Aquí vive todo lo que las pantallas necesitan ver. Se carga una vez y se vuelve a
// cargar con refrescar() después de cualquier cambio (registrar gasto, cambiar aportación...).
// Los servicios (src/services) son los de Tiff; aquí solo se convierten los números
// (Postgres a veces los manda como texto) y se guardan en estado.
interface MiAportacion {
  id: number;
  aportacion: number;
}

interface DatosValor {
  mes: string; // mes actual, 'YYYY-MM-01'
  perfil: Usuario | null;
  familia: Familia | null;
  miembros: Usuario[];
  tarjetas: Tarjeta[];
  gastos: Gasto[];
  resumen: ResumenPersona[];
  cierres: Cierre[];
  ahorro: AhorroPersona[];
  miAportacion: MiAportacion | null; // mi aportación de este mes (null = aún no la pone)
  cargando: boolean;
  error: string | null;
  refrescar: () => Promise<void>;
  nombreDe: (uid: string | null) => string;
}

const DatosContext = createContext<DatosValor | null>(null);

const num = (v: unknown) => Number(v);
const numONull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function DatosProvider({ children }: { children: React.ReactNode }) {
  const { sesion } = useAuth();
  const uid = sesion?.user.id ?? null;
  const mes = inicioMes(hoyISO());

  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [familia, setFamilia] = useState<Familia | null>(null);
  const [miembros, setMiembros] = useState<Usuario[]>([]);
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [resumen, setResumen] = useState<ResumenPersona[]>([]);
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [ahorro, setAhorro] = useState<AhorroPersona[]>([]);
  const [miAportacion, setMiAportacion] = useState<MiAportacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    if (!uid) return;
    try {
      setError(null);
      const [p, f, m, t, g, r, c, a, ap] = await Promise.all([
        verPerfil(),
        verFamilia(),
        verMiembros({ orden: { campo: 'creada_el' } }),
        verTarjetas({ orden: { campo: 'id' } }),
        verGastos({ orden: { campo: 'fecha_compra', asc: false }, limite: 1000 }),
        verResumen(aFecha(mes)),
        verCierres({ orden: { campo: 'mes', asc: false } }),
        verAhorro(),
        verAportaciones({
          filtros: [
            { campo: 'usuario_id', op: 'eq', valor: uid },
            { campo: 'mes', op: 'eq', valor: mes },
          ],
        }),
      ]);

      setPerfil({ ...p, salario: numONull(p.salario) });
      setFamilia(f);
      setMiembros((m as Usuario[]).map((u) => ({ ...u, salario: numONull(u.salario) })));
      setTarjetas(t as Tarjeta[]);
      setGastos((g as Gasto[]).map((x) => ({ ...x, monto: num(x.monto) })));
      setResumen(
        (r as ResumenPersona[]).map((x) => ({
          ...x,
          aportacion: num(x.aportacion),
          arrastre: num(x.arrastre),
          limite: num(x.limite),
          gastado: num(x.gastado),
          disponible: num(x.disponible),
          disponible_familia: num(x.disponible_familia),
          disponible_real: num(x.disponible_real),
        })),
      );
      setCierres(
        (c as Cierre[]).map((x) => ({ ...x, limite: num(x.limite), gastado: num(x.gastado), sobrante: num(x.sobrante) })),
      );
      setAhorro((a as AhorroPersona[]).map((x) => ({ ...x, ahorro: num(x.ahorro) })));
      const propia = (ap as { id: number; aportacion: unknown }[])[0];
      setMiAportacion(propia ? { id: propia.id, aportacion: num(propia.aportacion) } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos');
    } finally {
      setCargando(false);
    }
  }, [uid, mes]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  const nombreDe = useCallback(
    (id: string | null) => miembros.find((m) => m.id === id)?.nombre ?? 'Alguien',
    [miembros],
  );

  const valor = useMemo(
    () => ({ mes, perfil, familia, miembros, tarjetas, gastos, resumen, cierres, ahorro, miAportacion, cargando, error, refrescar, nombreDe }),
    [mes, perfil, familia, miembros, tarjetas, gastos, resumen, cierres, ahorro, miAportacion, cargando, error, refrescar, nombreDe],
  );

  return <DatosContext.Provider value={valor}>{children}</DatosContext.Provider>;
}

export function useDatos(): DatosValor {
  const v = useContext(DatosContext);
  if (!v) throw new Error('useDatos debe usarse dentro de <DatosProvider>');
  return v;
}
