import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Hoja } from './Hoja';
import { Campo } from './Campo';
import { Chips } from './Chips';
import { Boton } from './Boton';
import { Mensaje } from './Mensaje';
import { useAccion } from './ModalesCuentas';
import { useDatos } from '../context/DatosContext';
import { borrarMsiAnterior, crearMsiAnterior, editarMsiAnterior } from '../services/tarjetasService';
import { abonarDeuda, borrarDeuda, crearDeuda, editarDeuda } from '../services/deudasService';
import { formatoMXN, leerMonto } from '../utils/dinero';
import { colores } from '../theme';
import type { Deuda, MsiActivo } from '../types';

// número entero entre min y max, o null si no es válido
const enteroEntre = (t: string, min: number, max: number): number | null => {
  const n = Number(t);
  return t.trim() !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null;
};

// fecha de hoy + n días en formato AAAA-MM-DD
const fechaEn = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// agregar o editar un pago a plazos: msi con tarjeta o deuda directa
export function PlazoModal({ visible, msi, deuda, onCerrar }: { visible: boolean; msi: MsiActivo | null; deuda: Deuda | null; onCerrar: () => void }) {
  const { tarjetas, perfil } = useDatos();
  const misCreditos = tarjetas.filter((t) => t.tipo_pago === 'credito' && t.titular_id === perfil?.id);
  const misCuentas = tarjetas.filter((t) => t.titular_id === perfil?.id);
  const editando = !!msi || !!deuda;

  const [modo, setModo] = useState<'tarjeta' | 'directo'>('tarjeta');
  const [nombre, setNombre] = useState('');
  // con tarjeta
  const [tarjeta, setTarjeta] = useState<number | null>(null);
  const [mensualidad, setMensualidad] = useState('');
  const [faltan, setFaltan] = useState('');
  const [deMeses, setDeMeses] = useState('');
  // directo
  const [falta, setFalta] = useState('');
  const [total, setTotal] = useState('');
  const [abono, setAbono] = useState('');
  const [cadaDias, setCadaDias] = useState('');
  const [automatico, setAutomatico] = useState<'si' | 'no'>('no');
  const [enDias, setEnDias] = useState('');
  const [cuenta, setCuenta] = useState<number | null>(null);
  const { cargando, error, setError, ejecutar } = useAccion(onCerrar);

  // al abrir, llena con lo que ya tiene o deja en blanco
  useEffect(() => {
    if (!visible) return;
    setError(null);
    setModo(deuda ? 'directo' : 'tarjeta');
    setNombre(msi?.motivo ?? deuda?.nombre ?? '');
    setTarjeta(msi?.tarjeta_id ?? misCreditos[0]?.id ?? null);
    setMensualidad(msi ? String(msi.mensualidad) : '');
    setFaltan(msi ? String(msi.quedan) : '');
    setDeMeses(msi?.de_meses ? String(msi.de_meses) : '');
    setFalta(deuda ? String(deuda.falta) : '');
    setTotal(deuda?.total ? String(deuda.total) : '');
    setAbono(deuda?.abono ? String(deuda.abono) : '');
    setCadaDias(deuda?.cada_dias ? String(deuda.cada_dias) : '');
    setAutomatico('no');
    setEnDias('');
    setCuenta(misCuentas.find((t) => t.tipo_pago === 'efectivo')?.id ?? null);
  }, [visible]); // eslint-disable-line

  const guardarTarjeta = () => {
    const men = leerMonto(mensualidad);
    const fal = enteroEntre(faltan, 1, 48);
    const de = deMeses.trim() === '' ? null : enteroEntre(deMeses, 2, 48);
    if (!tarjeta) return setError('Elige la tarjeta');
    if (men === null || men <= 0) return setError('Escribe cuánto pagas al mes');
    if (fal === null) return setError('Escribe cuántas mensualidades te faltan (1 a 48)');
    if (deMeses.trim() !== '' && (de === null || de < fal)) return setError('Los meses totales no pueden ser menos de los que faltan');

    const datos = { motivo: nombre.trim(), mensualidad: men, faltan: fal, de_meses: de };
    ejecutar(async () => {
      if (msi) return editarMsiAnterior(msi.id, datos);
      await crearMsiAnterior({ ...datos, tarjeta_id: tarjeta });
      Alert.alert('Ojo', 'Si esta compra ya estaba en la "deuda que ya traías" de la tarjeta, réstala de ahí para no contarla doble');
    });
  };

  const guardarDirecto = () => {
    const fal = leerMonto(falta);
    const tot = total.trim() === '' ? null : leerMonto(total);
    const abo = abono.trim() === '' ? null : leerMonto(abono);
    const cad = cadaDias.trim() === '' ? null : enteroEntre(cadaDias, 1, 365);
    if (fal === null || fal <= 0) return setError('Escribe cuánto te falta por pagar');
    if (total.trim() !== '' && (tot === null || tot < fal)) return setError('El total no puede ser menos de lo que falta');
    if (abono.trim() !== '' && (abo === null || abo <= 0)) return setError('Abono inválido');
    if (cadaDias.trim() !== '' && cad === null) return setError('Cada cuántos días: de 1 a 365');

    const datos = { nombre: nombre.trim(), falta: fal, total: tot, abono: abo, cada_dias: cad };
    if (deuda) return ejecutar(() => editarDeuda(deuda.id, datos));
    if (automatico === 'no') return ejecutar(() => crearDeuda(datos));

    // descontarlo solo: hace falta abono, cada cuántos días y cuándo toca el siguiente
    const en = enteroEntre(enDias, 0, 365);
    if (abo === null || cad === null) return setError('Para descontarlo solo pon el abono y cada cuántos días');
    if (en === null) return setError('Escribe en cuántos días toca el siguiente abono (0 si es hoy)');
    ejecutar(() => crearDeuda(datos, { proximaFecha: fechaEn(en), tarjetaId: cuenta }));
  };

  const guardar = () => {
    if (!nombre.trim()) return setError('Ponle un nombre');
    if (modo === 'tarjeta') guardarTarjeta();
    else guardarDirecto();
  };

  const borrar = () =>
    Alert.alert('Borrar', `¿Borrar "${nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => ejecutar(() => (msi ? borrarMsiAnterior(msi.id) : borrarDeuda(deuda!.id))),
      },
    ]);

  return (
    <Hoja visible={visible} titulo={editando ? `Editar ${nombre}` : 'Agregar pago a plazos'} onCerrar={onCerrar}>
      {!editando ? (
        <Chips
          etiqueta="¿Cómo lo pagas?"
          valor={modo}
          onCambio={setModo}
          opciones={[{ id: 'tarjeta', etiqueta: 'Con tarjeta de crédito' }, { id: 'directo', etiqueta: 'Directo' }]}
        />
      ) : null}
      <Campo etiqueta="¿Qué es?" placeholder={modo === 'tarjeta' ? 'Refri, celular...' : 'Moto, préstamo...'} value={nombre} onChangeText={setNombre} />

      {modo === 'tarjeta' ? (
        <>
          {!editando ? (
            misCreditos.length > 0 ? (
              <Chips etiqueta="Tarjeta" valor={tarjeta} onCambio={setTarjeta} opciones={misCreditos.map((t) => ({ id: t.id, etiqueta: t.nombre }))} />
            ) : (
              <Text style={estilos.nota}>Primero agrega tu tarjeta de crédito</Text>
            )
          ) : null}
          <Campo etiqueta="¿Cuánto pagas al mes?" placeholder="Ej. 1000" keyboardType="decimal-pad" value={mensualidad} onChangeText={setMensualidad} />
          <Campo etiqueta="¿Cuántas mensualidades te faltan?" placeholder="Ej. 7" keyboardType="number-pad" value={faltan} onChangeText={setFaltan} ayuda="Viene en tu estado de cuenta o en la app del banco" />
          <Campo etiqueta="¿De cuántos meses era? (opcional)" placeholder="Ej. 12" keyboardType="number-pad" value={deMeses} onChangeText={setDeMeses} />
        </>
      ) : (
        <>
          <Campo etiqueta="¿Cuánto te falta por pagar hoy?" placeholder="Ej. 18000" keyboardType="decimal-pad" value={falta} onChangeText={setFalta} />
          <Campo etiqueta="¿Cuánto costaba en total? (opcional)" placeholder="Ej. 30000" keyboardType="decimal-pad" value={total} onChangeText={setTotal} ayuda="Solo para ver cuánto llevas" />
          <Campo etiqueta="Abono normal (opcional)" placeholder="Ej. 500" keyboardType="decimal-pad" value={abono} onChangeText={setAbono} />
          <Campo etiqueta="¿Cada cuántos días? (opcional)" placeholder="Ej. 15" keyboardType="number-pad" value={cadaDias} onChangeText={setCadaDias} />
          {!editando ? (
            <>
              <Chips
                etiqueta="¿Descontarlo solo?"
                valor={automatico}
                onCambio={setAutomatico}
                opciones={[{ id: 'no', etiqueta: 'No, yo abono' }, { id: 'si', etiqueta: 'Sí, cada vez que toque' }]}
              />
              {automatico === 'si' ? (
                <>
                  <Campo etiqueta="¿En cuántos días toca el siguiente?" placeholder="0 si es hoy" keyboardType="number-pad" value={enDias} onChangeText={setEnDias} />
                  <Chips etiqueta="¿De qué cuenta sale?" valor={cuenta} onCambio={setCuenta} opciones={misCuentas.map((t) => ({ id: t.id, etiqueta: t.nombre }))} />
                </>
              ) : null}
            </>
          ) : null}
        </>
      )}

      <Mensaje texto={error} />
      <Boton titulo={editando ? 'Guardar cambios' : 'Agregar'} onPress={guardar} cargando={cargando} />
      {editando ? (
        <View style={{ marginTop: 10 }}>
          <Boton variante="peligro" titulo="Borrar" onPress={borrar} deshabilitado={cargando} />
        </View>
      ) : null}
    </Hoja>
  );
}

// abonar lo que quieras a una deuda directa
export function AbonarModal({ deuda, onCerrar }: { deuda: Deuda | null; onCerrar: () => void }) {
  const { tarjetas, perfil, miEfectivo } = useDatos();
  const misCuentas = tarjetas.filter((t) => t.titular_id === perfil?.id);
  const [monto, setMonto] = useState('');
  const [cuenta, setCuenta] = useState<number | null>(null);
  const { cargando, error, setError, ejecutar } = useAccion(onCerrar);

  // al abrir, propone el abono normal y el efectivo
  useEffect(() => {
    if (!deuda) return;
    setError(null);
    setMonto(deuda.abono ? String(deuda.abono) : '');
    setCuenta(miEfectivo?.id ?? null);
  }, [deuda]); // eslint-disable-line

  const abonar = () => {
    const v = leerMonto(monto);
    if (!deuda) return;
    if (v === null || v <= 0) return setError('Escribe cuánto abonas');
    ejecutar(() => abonarDeuda(deuda.id, deuda.nombre, v, cuenta));
  };

  return (
    <Hoja visible={!!deuda} titulo={`Abonar a ${deuda?.nombre ?? ''}`} onCerrar={onCerrar}>
      <Text style={estilos.nota}>Te falta {formatoMXN(Math.max(deuda?.falta ?? 0, 0))}, puedes abonar más de lo normal</Text>
      <Campo etiqueta="¿Cuánto abonas?" placeholder="0.00" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} />
      <Chips etiqueta="¿De dónde sale?" valor={cuenta} onCambio={setCuenta} opciones={misCuentas.map((t) => ({ id: t.id, etiqueta: t.nombre }))} />
      <Mensaje texto={error} />
      <Boton titulo="Abonar" onPress={abonar} cargando={cargando} />
    </Hoja>
  );
}

const estilos = StyleSheet.create({
  nota: { fontSize: 13, color: colores.suave, marginBottom: 10 },
});