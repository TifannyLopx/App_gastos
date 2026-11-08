import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDatos } from '../context/DatosContext';
import { crearGasto, editarGasto } from '../services/gastosService';
import { Caja } from './Tarjeta';
import { Campo } from './Campo';
import { Chips, Opcion } from './Chips';
import { Boton } from './Boton';
import { Mensaje } from './Mensaje';
import { ETIQUETAS, codificarMotivo, leerMotivo, CategoriaId, EtiquetaId } from '../utils/categorias';
import { formatoMXN, leerMonto, redondear } from '../utils/dinero';
import { fechaCorta, hoyISO, sumarDias } from '../utils/fechas';
import { colores } from '../theme';
import type { FormaPago, Gasto } from '../types';

const MESES_MSI = [3, 6, 9, 12, 18, 24];

const preguntar = (titulo: string, mensaje: string, boton: string) =>
  new Promise<boolean>((resolver) =>
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolver(false) },
      { text: boton, onPress: () => resolver(true) },
    ], { cancelable: true, onDismiss: () => resolver(false) }),
  );

interface Props {
  gasto?: Gasto; // si viene, el formulario EDITA ese gasto
  onListo?: () => void;
}

// Formulario de la pantalla principal (crea gastos) y del historial (los edita).
export function FormularioGasto({ gasto, onListo }: Props) {
  const { perfil, tarjetas, estado, categorias, miEfectivo, refrescar } = useDatos();
  const editando = !!gasto;

  // valores iniciales: vacíos al crear, los del gasto al editar
  const previo = gasto ? leerMotivo(gasto.motivo) : null;
  const tarjetaPrevia = gasto ? tarjetas.find((t) => t.id === gasto.tarjeta_id) : undefined;
  const formaPrevia: FormaPago = !gasto
    ? 'contado'
    : gasto.msi && gasto.msi > 1 ? 'msi' : tarjetaPrevia?.tipo_pago === 'credito' ? 'credito' : 'contado';

  const [monto, setMonto] = useState(gasto ? String(gasto.monto) : '');
  const [motivo, setMotivo] = useState(previo?.texto ?? '');
  const [categoria, setCategoria] = useState<CategoriaId | null>(previo?.categoria ?? null);
  const [etiqueta, setEtiqueta] = useState<EtiquetaId | null>(previo?.etiqueta ?? null);
  const [forma, setForma] = useState<FormaPago>(formaPrevia);
  const [meses, setMeses] = useState<number>(gasto?.msi && gasto.msi > 1 ? gasto.msi : 6);
  const [fuente, setFuente] = useState<number | null>(gasto ? (gasto.tarjeta_id ?? miEfectivo?.id ?? null) : (miEfectivo?.id ?? null));
  const [fecha, setFecha] = useState(gasto?.fecha_compra ?? hoyISO());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const nombreCuenta = (id: number) => {
    const t = tarjetas.find((x) => x.id === id);
    if (!t) return '';
    return t.titular_id === perfil?.id ? t.nombre : `${t.nombre} (de tu pareja)`;
  };

  // Contado: tu efectivo y tus débitos. Crédito y MSI: cualquier tarjeta de crédito de la familia.
  const opcionesFuente = useMemo<Opcion<number>[]>(() => {
    const mias = tarjetas.filter((t) => t.titular_id === perfil?.id);
    const lista = forma === 'contado'
      ? mias.filter((t) => t.tipo_pago === 'efectivo' || t.tipo_pago === 'debito')
      : tarjetas.filter((t) => t.tipo_pago === 'credito');
    return lista.map((t) => ({ id: t.id, etiqueta: nombreCuenta(t.id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forma, tarjetas, perfil]);

  const cambiarForma = (f: FormaPago) => {
    setForma(f);
    setFuente(f === 'contado' ? (miEfectivo?.id ?? null) : (tarjetas.find((t) => t.tipo_pago === 'credito')?.id ?? null));
  };

  const cuenta = tarjetas.find((t) => t.id === fuente);
  const estadoCuenta = estado.find((e) => e.tarjeta_id === fuente);
  const montoNum = leerMonto(monto);
  const cuota = forma === 'msi' && montoNum ? redondear(montoNum / meses) : null;

  const guardar = async () => {
    setError(null);
    setExito(null);
    if (!perfil) return;
    if (montoNum === null || montoNum <= 0) return setError('Escribe un monto mayor a 0.');
    if (!motivo.trim()) return setError('Escribe en qué se gastó.');
    if (!categoria) return setError('Elige una categoría.');
    if (forma !== 'contado' && !cuenta) return setError('Elige la tarjeta de crédito.');

    // aviso si se pasa del límite de la tarjeta (al editar, lo que ya tenía el gasto no cuenta)
    if (cuenta?.tipo_pago === 'credito' && estadoCuenta?.disponible_credito !== null && estadoCuenta?.disponible_credito !== undefined) {
      const yaContado = gasto && gasto.tarjeta_id === cuenta.id ? gasto.monto : 0;
      const disponible = estadoCuenta.disponible_credito + yaContado;
      if (montoNum > disponible) {
        const sigue = await preguntar(
          'Excede el límite de la tarjeta',
          `A ${cuenta.nombre} le quedan ${formatoMXN(disponible)} de límite y este gasto es de ${formatoMXN(montoNum)}. ¿Registrarlo de todos modos?`,
          'Registrar',
        );
        if (!sigue) return;
      }
    }

    setEnviando(true);
    try {
      const datos = {
        tarjeta_id: cuenta?.id ?? null,
        monto: montoNum,
        motivo: codificarMotivo(motivo, categoria, etiqueta),
        fecha_compra: fecha,
        msi: forma === 'msi' ? meses : null,
      };
      if (gasto) await editarGasto(gasto.id, datos);
      else await crearGasto(datos);

      await refrescar();
      if (gasto) {
        onListo?.();
      } else {
        setExito(`Registrado: -${formatoMXN(montoNum)} ${motivo.trim()}`);
        setMonto(''); setMotivo(''); setEtiqueta(null); setFecha(hoyISO());
        onListo?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el gasto.');
    } finally {
      setEnviando(false);
    }
  };

  const contenido = (
    <>
      <Campo etiqueta="¿Cuánto se gastó?" placeholder="0.00" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} />
      <Campo etiqueta="¿En qué se gastó?" placeholder="Galletas, súper, camión..." value={motivo} onChangeText={setMotivo} />

      <View style={estilos.de}>
        <Text style={estilos.deEtiqueta}>¿De quién es el dinero?</Text>
        <Text style={estilos.deNombre}>
          {cuenta && cuenta.titular_id !== perfil?.id ? 'Del titular de la tarjeta elegida' : perfil?.nombre ?? '...'}
        </Text>
      </View>

      <Chips
        etiqueta="Categoría"
        valor={categoria}
        onCambio={setCategoria}
        opciones={categorias.map((c) => ({ id: c.id, etiqueta: `${c.nombre} ${Math.round(c.porcentaje * 100)}%`, color: c.color }))}
      />
      <Chips
        etiqueta="Detalle (opcional)"
        valor={etiqueta}
        onCambio={(id) => setEtiqueta(id === etiqueta ? null : id)}
        opciones={ETIQUETAS.map((e) => ({ id: e.id, etiqueta: e.nombre }))}
      />

      <Chips
        etiqueta="Forma de pago"
        valor={forma}
        onCambio={cambiarForma}
        opciones={[
          { id: 'contado', etiqueta: 'Contado' },
          { id: 'credito', etiqueta: 'Crédito' },
          { id: 'msi', etiqueta: 'MSI' },
        ]}
      />
      {forma === 'msi' ? (
        <>
          <Chips etiqueta="Meses sin intereses" valor={meses} onCambio={setMeses} opciones={MESES_MSI.map((m) => ({ id: m, etiqueta: `${m}` }))} />
          {cuota ? <Text style={estilos.nota}>Se restará {formatoMXN(cuota)} del límite cada mes durante {meses} meses.</Text> : null}
        </>
      ) : null}

      <Chips
        etiqueta={forma === 'contado' ? 'Sale de' : 'Tarjeta'}
        valor={fuente}
        onCambio={setFuente}
        opciones={opcionesFuente}
        vacio="Primero agrega una tarjeta de crédito en la pestaña Cuentas."
      />
      {cuenta && cuenta.tipo_pago !== 'credito' ? (
        <Text style={estilos.nota}>Saldo actual de {cuenta.nombre}: {formatoMXN(cuenta.saldo)}. Este gasto lo descontará.</Text>
      ) : null}
      {cuenta?.tipo_pago === 'credito' ? (
        <Text style={estilos.nota}>
          {estadoCuenta?.disponible_credito !== null && estadoCuenta?.disponible_credito !== undefined
            ? `Límite disponible: ${formatoMXN(estadoCuenta.disponible_credito)}. `
            : ''}
          {cuenta.dia_corte ? `Corta el día ${cuenta.dia_corte}.` : ''}
        </Text>
      ) : null}

      <View style={estilos.fecha}>
        <Pressable hitSlop={10} onPress={() => setFecha(sumarDias(fecha, -1))}>
          <Ionicons name="chevron-back" size={20} color={colores.primario} />
        </Pressable>
        <Text style={estilos.fechaTexto}>
          {fecha === hoyISO() ? 'Hoy' : fechaCorta(fecha)} · fecha de compra
        </Text>
        <Pressable hitSlop={10} disabled={fecha >= hoyISO()} onPress={() => setFecha(sumarDias(fecha, 1))}>
          <Ionicons name="chevron-forward" size={20} color={fecha >= hoyISO() ? colores.borde : colores.primario} />
        </Pressable>
      </View>

      <Mensaje texto={error} />
      <Mensaje texto={exito} tipo="info" />
      <Boton titulo={editando ? 'Guardar cambios' : 'Registrar gasto'} onPress={guardar} cargando={enviando} />
    </>
  );

  return editando ? <View>{contenido}</View> : <Caja titulo="Registrar gasto">{contenido}</Caja>;
}

const estilos = StyleSheet.create({
  de: { marginBottom: 12 },
  deEtiqueta: { fontSize: 13, fontWeight: '600', color: colores.suave, marginBottom: 6 },
  deNombre: { fontSize: 16, color: colores.texto, fontWeight: '600' },
  nota: { fontSize: 12, color: colores.suave, marginBottom: 12, marginTop: -4 },
  fecha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  fechaTexto: { fontSize: 14, color: colores.texto, fontWeight: '500' },
});
