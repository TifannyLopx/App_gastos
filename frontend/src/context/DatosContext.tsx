import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './AuthContext';
import { verPerfil } from '../services/usuariosService';
import { verFamilia, verMiembros } from '../services/familiasService';
import { verTodosLosGastos } from '../services/gastosService';
import { verEstadoTarjetas, verMsi, verTarjetas } from '../services/tarjetasService';
import { verDeudas } from '../services/deudasService';
import { verAportaciones, verResumen } from '../services/limitesService';
import { verAhorro, verCierres, verRepartos } from '../services/cierresService';
import { verMetas } from '../services/metasService';
import { generarMisRecurrentes } from '../services/recurrentesService';
import { leerArchivo } from '../services/archivoLocal';
import {
  cargarConfigAvisos, configurarNotificaciones, EstadoPush, programarAvisosDePago, registrarPush,
} from '../services/notificacionesService';
import { aFecha, hoyISO, inicioMes, sumarMeses } from '../utils/fechas';
import { Categoria, categoriasDe } from '../utils/categorias';
import { unirGastos } from '../utils/cargos';
import type {
  AhorroPersona, Cierre, Deuda, EstadoCuenta, Familia, Gasto, Meta, MsiActivo, Reparto, ResumenPersona, Tarjeta, Usuario,
} from '../types';

// Aquí vive todo lo que las pantallas necesitan ver. Se carga una vez y se vuelve a
// cargar con refrescar() después de cualquier cambio (registrar gasto, pagar tarjeta...).
// Los servicios (src/services) hablan con Supabase; aquí solo se convierten los números
// (Postgres a veces los manda como texto) y se guardan en estado.
interface MiAportacion {
  id: number;
  aportacion: number;
}

interface DatosValor {
  mes: string; // mes actual, 'YYYY-MM-01'
  mesPasado: string;
  perfil: Usuario | null;
  familia: Familia | null;
  categorias: Categoria[]; // con los porcentajes de la familia
  miembros: Usuario[];
  tarjetas: Tarjeta[]; // todas las cuentas: crédito, débito y efectivo
  estado: EstadoCuenta[]; // números calculados de cada cuenta
  gastosNube: Gasto[];
  gastos: Gasto[]; // nube + archivo local, sin repetir
  archivoLocal: Gasto[];
  resumen: ResumenPersona[];
  resumenPasado: ResumenPersona[];
  cierres: Cierre[];
  repartos: Reparto[];
  ahorro: AhorroPersona[];
  metas: Meta[];
  msi: MsiActivo[]; // msi activos de las tarjetas, de la app y anteriores
  deudas: Deuda[]; // pagos a plazos directos, como la moto eda
  miAportacion: MiAportacion | null; // mi aportación de este mes (null = aún no la pone)
  estadoPush: EstadoPush | 'pendiente';
  cargando: boolean;
  error: string | null;
  refrescar: () => Promise<void>;
  nombreDe: (uid: string | null) => string;
  miEfectivo: Tarjeta | null;
}

const DatosContext = createContext<DatosValor | null>(null);

const num = (v: unknown) => Number(v);
const numONull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function DatosProvider({ children }: { children: React.ReactNode }) {
  const { sesion } = useAuth();
  const uid = sesion?.user.id ?? null;
  const mes = inicioMes(hoyISO());
  const mesPasado = sumarMeses(mes, -1);

  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [familia, setFamilia] = useState<Familia | null>(null);
  const [miembros, setMiembros] = useState<Usuario[]>([]);
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [estado, setEstado] = useState<EstadoCuenta[]>([]);
  const [gastosNube, setGastosNube] = useState<Gasto[]>([]);
  const [archivoLocal, setArchivoLocal] = useState<Gasto[]>([]);
  const [resumen, setResumen] = useState<ResumenPersona[]>([]);
  const [resumenPasado, setResumenPasado] = useState<ResumenPersona[]>([]);
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [repartos, setRepartos] = useState<Reparto[]>([]);
  const [ahorro, setAhorro] = useState<AhorroPersona[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [msi, setMsi] = useState<MsiActivo[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [miAportacion, setMiAportacion] = useState<MiAportacion | null>(null);
  const [estadoPush, setEstadoPush] = useState<EstadoPush | 'pendiente'>('pendiente');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    if (!uid) return;
    try {
      setError(null);
      // primero se crean los gastos automáticos que ya tocan, para que salgan en todo lo demás
      await generarMisRecurrentes().catch(() => undefined);

            const [p, f, m, t, e, g, r, rp, c, rep, a, me, ap, arch, ms, de] = await Promise.all([
        verPerfil(),
        verFamilia(),
        verMiembros({ orden: { campo: 'creada_el' } }),
        verTarjetas({ orden: { campo: 'id' } }),
        verEstadoTarjetas(),
        verTodosLosGastos(),
        verResumen(aFecha(mes)),
        verResumen(aFecha(mesPasado)),
        verCierres({ orden: { campo: 'mes', asc: false } }),
        verRepartos(),
        verAhorro(),
        verMetas(),
        verAportaciones({
          filtros: [
            { campo: 'usuario_id', op: 'eq', valor: uid },
            { campo: 'mes', op: 'eq', valor: mes },
          ],
        }),
        leerArchivo().catch(() => [] as Gasto[]),
        verMsi(),
        verDeudas({ orden: { campo: 'id' } }),
      ]);

      const numerosResumen = (x: ResumenPersona): ResumenPersona => ({
        ...x,
        aportacion: num(x.aportacion),
        arrastre: num(x.arrastre),
        limite: num(x.limite),
        gastado: num(x.gastado),
        disponible: num(x.disponible),
        disponible_familia: num(x.disponible_familia),
        disponible_real: num(x.disponible_real),
      });

      setPerfil({ ...p, salario: numONull(p.salario) });
      setFamilia({
        ...f,
        pct_obligatorio: num(f.pct_obligatorio),
        pct_necesario: num(f.pct_necesario),
        pct_chucheria: num(f.pct_chucheria),
      });
      setMiembros((m as Usuario[]).map((u) => ({ ...u, salario: numONull(u.salario) })));
      setTarjetas(
        (t as Tarjeta[]).map((x) => ({
          ...x,
          saldo: num(x.saldo),
          limite_credito: numONull(x.limite_credito),
          deuda_inicial: num(x.deuda_inicial),
        })),
      );
      setEstado(
        (e as EstadoCuenta[]).map((x) => ({
          ...x,
          saldo: num(x.saldo),
          limite_credito: numONull(x.limite_credito),
          usado: numONull(x.usado),
          disponible_credito: numONull(x.disponible_credito),
          a_pagar: numONull(x.a_pagar),
          apartado: numONull(x.apartado),
          apartado_en_cuenta: numONull(x.apartado_en_cuenta),
          libre: numONull(x.libre),
        })),
      );
      setGastosNube((g as Gasto[]).map((x) => ({ ...x, monto: num(x.monto) })));
      setArchivoLocal(arch);
      setResumen((r as ResumenPersona[]).map(numerosResumen));
      setResumenPasado((rp as ResumenPersona[]).map(numerosResumen));
      setCierres(
        (c as Cierre[]).map((x) => ({ ...x, limite: num(x.limite), gastado: num(x.gastado), sobrante: num(x.sobrante) })),
      );
      setRepartos((rep as Reparto[]).map((x) => ({ ...x, monto: num(x.monto) })));
      setAhorro((a as AhorroPersona[]).map((x) => ({ ...x, ahorro: num(x.ahorro) })));
      setMetas((me as Meta[]).map((x) => ({ ...x, objetivo: num(x.objetivo), ahorrado: num(x.ahorrado) })));
      const propia = (ap as { id: number; aportacion: unknown }[])[0];
      setMsi((ms as MsiActivo[]).map((x) => ({ ...x, mensualidad: num(x.mensualidad), pendiente: num(x.pendiente) })));
      setDeudas(
        (de as Deuda[]).map((x) => ({ ...x, falta: num(x.falta), total: numONull(x.total), abono: numONull(x.abono) })),
      );
      setMiAportacion(propia ? { id: propia.id, aportacion: num(propia.aportacion) } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos');
    } finally {
      setCargando(false);
    }
  }, [uid, mes, mesPasado]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  // avisos push (cuando tu pareja gasta): se registra este celular una vez por sesión
  useEffect(() => {
    if (!uid) return;
    configurarNotificaciones();
    registrarPush().then(setEstadoPush);
  }, [uid]);

  // avisos locales de pago de tarjetas: se reprograman con los números más recientes
  useEffect(() => {
    if (tarjetas.length === 0 || estado.length === 0) return;
    cargarConfigAvisos().then((config) => programarAvisosDePago(config, tarjetas, estado));
  }, [tarjetas, estado]);

  const nombreDe = useCallback(
    (id: string | null) => miembros.find((m) => m.id === id)?.nombre ?? 'Alguien',
    [miembros],
  );

  const categorias = useMemo(() => categoriasDe(familia), [familia]);
  const gastos = useMemo(() => unirGastos(gastosNube, archivoLocal), [gastosNube, archivoLocal]);
  const miEfectivo = useMemo(
    () => tarjetas.find((t) => t.tipo_pago === 'efectivo' && t.titular_id === uid) ?? null,
    [tarjetas, uid],
  );

  const valor = useMemo(
    () => ({
      mes, mesPasado, perfil, familia, categorias, miembros, tarjetas, estado, gastosNube, gastos, archivoLocal,
      resumen, resumenPasado, cierres, repartos, ahorro, metas, msi, deudas, miAportacion, estadoPush, cargando, error,
      refrescar, nombreDe, miEfectivo,
    }),
    [
      mes, mesPasado, perfil, familia, categorias, miembros, tarjetas, estado, gastosNube, gastos, archivoLocal,
      resumen, resumenPasado, cierres, repartos, ahorro, metas, msi, deudas, miAportacion, estadoPush, cargando, error,
      refrescar, nombreDe, miEfectivo,
    ],
  );

  return <DatosContext.Provider value={valor}>{children}</DatosContext.Provider>;
}

export function useDatos(): DatosValor {
  const v = useContext(DatosContext);
  if (!v) throw new Error('useDatos debe usarse dentro de <DatosProvider>');
  return v;
}
