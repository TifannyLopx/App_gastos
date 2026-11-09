import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Hoja } from './Hoja';
import { Campo } from './Campo';
import { Chips } from './Chips';
import { Boton } from './Boton';
import { Mensaje } from './Mensaje';
import { useDatos } from '../context/DatosContext';
import {
  borrarTarjeta, crearTarjeta, deshacerPago, editarTarjeta, pagarTarjeta, transferir, verPagos,
} from '../services/tarjetasService';
import { formatoMXN, leerMonto } from '../utils/dinero';
import { fechaCorta } from '../utils/fechas';
import { colores } from '../theme';
import type { Tarjeta, TipoCuenta } from '../types';

// Todas las ventanas emergentes de la pestaña Cuentas. Cada una guarda y luego recarga los datos.
function useAccion(onListo: () => void) {
  const { refrescar } = useDatos();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ejecutar = async (accion: () => Promise<unknown>) => {
    setError(null);
    setCargando(true);
    try {
      await accion();
      await refrescar();
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setCargando(false);
    }
  };
  return { cargando, error, setError, ejecutar };
}

const entero = (t: string): number | null => {
  const n = Number(t);
  return t.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
};

// ---------- cambiar cuánto dinero hay en una cuenta ----------
export function SaldoModal({ cuenta, onCerrar }: { cuenta: Tarjeta | null; onCerrar: () => void }) {
  const [texto, setTexto] = useState('');
  const { cargando, error, setError, ejecutar } = useAccion(onCerrar);
  useEffect(() => { if (cuenta) { setTexto(String(cuenta.saldo)); setError(null); } }, [cuenta]); // eslint-disable-line

  const guardar = () => {
    const v = leerMonto(texto);
    if (v === null) return setError('Escribe un monto válido.');
    if (cuenta) ejecutar(() => editarTarjeta(cuenta.id, { saldo: v }));
  };

  return (
    <Hoja visible={!!cuenta} titulo={`Dinero en ${cuenta?.nombre ?? ''}`} onCerrar={onCerrar}>
      <Text style={estilos.nota}>Escribe cuánto dinero hay AHORA. Reemplaza el saldo actual ({formatoMXN(cuenta?.saldo ?? 0)}).</Text>
      <Campo etiqueta="Dinero actual" keyboardType="numbers-and-punctuation" value={texto} onChangeText={setTexto} />
      <Mensaje texto={error} />
      <Boton titulo="Guardar" onPress={guardar} cargando={cargando} />
    </Hoja>
  );
}

// ---------- pasar dinero de una cuenta a otra ----------
export function TransferirModal({ visible, desdeId, onCerrar }: { visible: boolean; desdeId: number | null; onCerrar: () => void }) {
  const { tarjetas, perfil } = useDatos();
  const cuentas = tarjetas.filter((t) => t.tipo_pago !== 'credito');
  const mias = cuentas.filter((t) => t.titular_id === perfil?.id);
  const [origen, setOrigen] = useState<number | null>(null);
  const [destino, setDestino] = useState<number | null>(null);
  const [monto, setMonto] = useState('');
  const { cargando, error, setError, ejecutar } = useAccion(onCerrar);

  useEffect(() => {
    if (visible) { setOrigen(desdeId ?? mias[0]?.id ?? null); setDestino(null); setMonto(''); setError(null); }
  }, [visible]); // eslint-disable-line

  const nombre = (t: Tarjeta) => (t.titular_id === perfil?.id ? t.nombre : `${t.nombre} (pareja)`);

  const enviar = () => {
    const v = leerMonto(monto);
    if (!origen || !destino) return setError('Elige de dónde a dónde.');
    if (v === null || v <= 0) return setError('Escribe un monto mayor a 0.');
    ejecutar(() => transferir(origen, destino, v));
  };

  return (
    <Hoja visible={visible} titulo="Transferir dinero" onCerrar={onCerrar}>
      <Chips etiqueta="De (tus cuentas)" valor={origen} onCambio={setOrigen} opciones={mias.map((t) => ({ id: t.id, etiqueta: `${t.nombre} · ${formatoMXN(t.saldo)}` }))} />
      <Chips etiqueta="A" valor={destino} onCambio={setDestino} opciones={cuentas.filter((t) => t.id !== origen).map((t) => ({ id: t.id, etiqueta: nombre(t) }))} />
      <Campo etiqueta="Monto" placeholder="0.00" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} />
      <Mensaje texto={error} />
      <Boton titulo="Transferir" onPress={enviar} cargando={cargando} />
    </Hoja>
  );
}

// ---------- "Ya pagué" una tarjeta de crédito ----------
interface PagoFila { id: number; monto: number; fecha: string; usuario_id: string | null }

export function PagarModal({ tarjeta, onCerrar }: { tarjeta: Tarjeta | null; onCerrar: () => void }) {
  const { tarjetas, estado, perfil, nombreDe } = useDatos();
  const e = estado.find((x) => x.tarjeta_id === tarjeta?.id);
  const mias = tarjetas.filter((t) => t.tipo_pago !== 'credito' && t.titular_id === perfil?.id);
  const [monto, setMonto] = useState('');
  const [cuenta, setCuenta] = useState<number | null>(null);
  const [recientes, setRecientes] = useState<PagoFila[]>([]);
  const { cargando, error, setError, ejecutar } = useAccion(onCerrar);

  useEffect(() => {
    if (!tarjeta) return;
    setError(null);
    setMonto(e?.a_pagar ? String(e.a_pagar) : '');
    const propia = mias.find((m) => m.id === tarjeta.cuenta_pago_id);
    setCuenta(propia?.id ?? mias[0]?.id ?? null);
    verPagos({ filtros: [{ campo: 'tarjeta_id', op: 'eq', valor: tarjeta.id }], orden: { campo: 'id', asc: false }, limite: 5 })
      .then((r) => setRecientes((r as PagoFila[]).map((p) => ({ ...p, monto: Number(p.monto) }))))
      .catch(() => setRecientes([]));
  }, [tarjeta]); // eslint-disable-line

  const pagar = () => {
    const v = leerMonto(monto);
    if (!tarjeta) return;
    if (v === null || v <= 0) return setError('Escribe cuánto pagaste.');
    ejecutar(() => pagarTarjeta(tarjeta.id, { monto: v, cuentaId: cuenta ?? undefined }));
  };

  const deshacer = (id: number) =>
    Alert.alert('Deshacer pago', 'El dinero regresa a la cuenta con la que pagaste.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Deshacer', style: 'destructive', onPress: () => ejecutar(() => deshacerPago(id)) },
    ]);

  return (
    <Hoja visible={!!tarjeta} titulo={`Pagar ${tarjeta?.nombre ?? ''}`} onCerrar={onCerrar}>
      <View style={estilos.resumen}>
        <Text style={estilos.nota}>Por pagar ya facturado: <Text style={estilos.negrita}>{formatoMXN(e?.a_pagar ?? 0)}</Text></Text>
        <Text style={estilos.nota}>Con lo que se factura en el próximo corte: <Text style={estilos.negrita}>{formatoMXN(e?.apartado ?? 0)}</Text></Text>
      </View>
      <Campo etiqueta="¿Cuánto pagaste?" placeholder="0.00" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} ayuda="Puedes pagar menos, más o el total. Libera tu límite de crédito." />
      <Chips
        etiqueta="Pagaste con"
        valor={cuenta}
        onCambio={setCuenta}
        opciones={mias.map((t) => ({ id: t.id, etiqueta: `${t.nombre} · ${formatoMXN(t.saldo)}` }))}
      />
      <Mensaje texto={error} />
      <Boton titulo="Ya pagué" onPress={pagar} cargando={cargando} />

      {recientes.length > 0 ? (
        <View style={{ marginTop: 18 }}>
          <Text style={estilos.subtitulo}>Pagos recientes</Text>
          {recientes.map((p) => (
            <View key={p.id} style={estilos.pago}>
              <Text style={estilos.nota}>{fechaCorta(p.fecha)} · {nombreDe(p.usuario_id)} · {formatoMXN(p.monto)}</Text>
              {p.usuario_id === perfil?.id ? <Boton chico variante="texto" titulo="Deshacer" onPress={() => deshacer(p.id)} /> : null}
            </View>
          ))}
        </View>
      ) : null}
    </Hoja>
  );
}

// ---------- crear o editar una tarjeta ----------
export function TarjetaModal({ visible, tarjeta, tipoInicial, onCerrar }: { visible: boolean; tarjeta: Tarjeta | null; tipoInicial?: TipoCuenta; onCerrar: () => void }) {
  const { tarjetas, perfil } = useDatos();
  const editando = !!tarjeta;
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoCuenta>('credito');
  const [saldo, setSaldo] = useState('');
  const [limite, setLimite] = useState('');
  const [corte, setCorte] = useState('');
  const [pago, setPago] = useState('');
  const [deuda, setDeuda] = useState('');
  const [cuentaPago, setCuentaPago] = useState<number | null>(null);
  const { cargando, error, setError, ejecutar } = useAccion(onCerrar);

  const mias = tarjetas.filter((t) => t.tipo_pago !== 'credito' && t.titular_id === perfil?.id);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setNombre(tarjeta?.nombre ?? '');
    setTipo(tarjeta?.tipo_pago ?? tipoInicial ?? 'credito');
    setSaldo(tarjeta ? String(tarjeta.saldo) : '');
    setLimite(tarjeta?.limite_credito != null ? String(tarjeta.limite_credito) : '');
    setCorte(tarjeta?.dia_corte ? String(tarjeta.dia_corte) : '');
    setPago(tarjeta?.dia_pago ? String(tarjeta.dia_pago) : '');
    setDeuda(tarjeta && tarjeta.deuda_inicial ? String(tarjeta.deuda_inicial) : '');
    setCuentaPago(tarjeta?.cuenta_pago_id ?? null);
  }, [visible, tarjeta]); // eslint-disable-line

  const guardar = () => {
    if (!nombre.trim()) return setError('Ponle un nombre.');
    const esCredito = tipo === 'credito';
    const lim = limite.trim() === '' ? null : leerMonto(limite);
    if (esCredito && (entero(corte) === null || entero(pago) === null)) return setError('Escribe el día de corte y el día de pago (1 a 31).');
    if (esCredito && limite.trim() !== '' && (lim === null || lim < 0)) return setError('Límite de crédito inválido.');
    const sal = saldo.trim() === '' ? 0 : leerMonto(saldo);
    if (!esCredito && sal === null) return setError('Saldo inválido.');
    const deu = deuda.trim() === '' ? 0 : leerMonto(deuda);
    if (esCredito && deu === null) return setError('Deuda inválida.');

    const datos = esCredito
      ? { nombre: nombre.trim(), dia_corte: entero(corte), dia_pago: entero(pago), limite_credito: lim, cuenta_pago_id: cuentaPago, deuda_inicial: deu ?? 0 }
      : { nombre: nombre.trim(), ...(editando ? {} : { saldo: sal ?? 0 }) };

    ejecutar(() => (tarjeta ? editarTarjeta(tarjeta.id, datos) : crearTarjeta({ ...datos, tipo_pago: tipo })));
  };

  const borrar = () =>
    Alert.alert('Borrar tarjeta', `¿Borrar "${tarjeta?.nombre}"? Sus gastos se conservan pero ya no tendrán tarjeta.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => tarjeta && ejecutar(() => borrarTarjeta(tarjeta.id)) },
    ]);

  return (
    <Hoja visible={visible} titulo={editando ? `Editar ${tarjeta?.nombre}` : 'Agregar tarjeta'} onCerrar={onCerrar}>
      <Campo etiqueta="Nombre" placeholder="BBVA, Nu, Liverpool..." value={nombre} onChangeText={setNombre} />
      {!editando ? (
        <Chips etiqueta="Tipo" valor={tipo} onCambio={setTipo} opciones={[{ id: 'credito', etiqueta: 'Crédito' }, { id: 'debito', etiqueta: 'Débito' }]} />
      ) : null}

      {tipo === 'credito' ? (
        <>
          <Campo etiqueta="Límite de crédito (opcional)" placeholder="Ej. 20000" keyboardType="decimal-pad" value={limite} onChangeText={setLimite} ayuda="Cada gasto con esta tarjeta lo va restando. Un MSI resta el monto completo hasta que lo vayas pagando." />
          <Campo etiqueta="Día de corte" placeholder="Ej. 15" keyboardType="number-pad" value={corte} onChangeText={setCorte} />
          <Campo etiqueta="Día de pago" placeholder="Ej. 5" keyboardType="number-pad" value={pago} onChangeText={setPago} />
          <Chips
            etiqueta="¿Con qué cuenta la pagas? (se aparta ahí el dinero)"
            valor={cuentaPago}
            onCambio={(id) => setCuentaPago(id === cuentaPago ? null : id)}
            opciones={mias.map((t) => ({ id: t.id, etiqueta: t.nombre }))}
          />
          <Campo etiqueta="Deuda que ya traías (opcional)" placeholder="0.00" keyboardType="decimal-pad" value={deuda} onChangeText={setDeuda} ayuda="Lo que ya debías de esta tarjeta ANTES de registrar sus gastos en la app. Cuenta en lo que falta por pagar." />
        </>
      ) : !editando ? (
        <Campo etiqueta="Dinero que tiene ahora" placeholder="0.00" keyboardType="decimal-pad" value={saldo} onChangeText={setSaldo} />
      ) : (
        <Text style={estilos.nota}>Para cambiar el dinero que tiene usa el botón "Editar saldo".</Text>
      )}

      <Mensaje texto={error} />
      <Boton titulo={editando ? 'Guardar cambios' : 'Agregar'} onPress={guardar} cargando={cargando} />
      {editando && tarjeta?.tipo_pago !== 'efectivo' ? (
        <View style={{ marginTop: 10 }}>
          <Boton variante="peligro" titulo="Borrar tarjeta" onPress={borrar} deshabilitado={cargando} />
        </View>
      ) : null}
    </Hoja>
  );
}

const estilos = StyleSheet.create({
  nota: { fontSize: 13, color: colores.suave, marginBottom: 10 },
  negrita: { fontWeight: '700', color: colores.texto },
  resumen: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 14 },
  subtitulo: { fontSize: 14, fontWeight: '700', color: colores.texto, marginBottom: 6 },
  pago: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
