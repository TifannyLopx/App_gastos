import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDatos } from '../context/DatosContext';
import { crearGasto } from '../services/gastosService';
import { Caja } from './Tarjeta';
import { Campo } from './Campo';
import { Chips, Opcion } from './Chips';
import { Boton } from './Boton';
import { Mensaje } from './Mensaje';
import { CATEGORIAS, ETIQUETAS, codificarMotivo, CategoriaId, EtiquetaId } from '../utils/categorias';
import { formatoMXN, leerMonto, redondear } from '../utils/dinero';
import { fechaCorta, hoyISO, sumarDias } from '../utils/fechas';
import { colores } from '../theme';
import type { FormaPago } from '../types';

const MESES_MSI = [3, 6, 9, 12, 18, 24];

// Formulario de la pantalla principal: monto, qué se gastó, categoría, forma de pago y fuente.
export function FormularioGasto() {
  const { perfil, tarjetas, refrescar } = useDatos();

  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [categoria, setCategoria] = useState<CategoriaId | null>(null);
  const [etiqueta, setEtiqueta] = useState<EtiquetaId | null>(null);
  const [forma, setForma] = useState<FormaPago>('contado');
  const [meses, setMeses] = useState<number>(6);
  const [fuente, setFuente] = useState<number | 'efectivo'>('efectivo');
  const [fecha, setFecha] = useState(hoyISO());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Contado: efectivo o débito. Crédito y MSI: solo tarjetas de crédito.
  const opcionesFuente = useMemo<Opcion<number | 'efectivo'>[]>(() => {
    const lista: Opcion<number | 'efectivo'>[] = [];
    if (forma === 'contado') lista.push({ id: 'efectivo', etiqueta: 'Efectivo' });
    const permitidas = tarjetas.filter((t) => (forma === 'contado' ? t.tipo_pago === 'debito' : t.tipo_pago === 'credito'));
    permitidas.forEach((t) => lista.push({ id: t.id, etiqueta: t.nombre }));
    return lista;
  }, [forma, tarjetas]);

  const cambiarForma = (f: FormaPago) => {
    setForma(f);
    setFuente(f === 'contado' ? 'efectivo' : (tarjetas.find((t) => t.tipo_pago === 'credito')?.id ?? 'efectivo'));
  };

  const tarjetaElegida = typeof fuente === 'number' ? tarjetas.find((t) => t.id === fuente) : undefined;
  const montoNum = leerMonto(monto);
  const cuota = forma === 'msi' && montoNum ? redondear(montoNum / meses) : null;

  const registrar = async () => {
    setError(null);
    setExito(null);
    if (montoNum === null || montoNum <= 0) return setError('Escribe un monto mayor a 0.');
    if (!motivo.trim()) return setError('Escribe en qué se gastó.');
    if (!categoria) return setError('Elige una categoría.');
    if (forma !== 'contado' && typeof fuente !== 'number') return setError('Elige la tarjeta de crédito.');

    setEnviando(true);
    try {
      await crearGasto({
        tarjeta_id: typeof fuente === 'number' ? fuente : null,
        monto: montoNum,
        motivo: codificarMotivo(motivo, categoria, etiqueta),
        fecha_compra: fecha,
        msi: forma === 'msi' ? meses : null,
      });
      setExito(`Registrado: -${formatoMXN(montoNum)} ${motivo.trim()}`);
      setMonto('');
      setMotivo('');
      setEtiqueta(null);
      setFecha(hoyISO());
      await refrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el gasto.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Caja titulo="Registrar gasto">
      <Campo etiqueta="¿Cuánto se gastó?" placeholder="0.00" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} />
      <Campo etiqueta="¿En qué se gastó?" placeholder="Galletas, súper, camión..." value={motivo} onChangeText={setMotivo} />

      <View style={estilos.de}>
        <Text style={estilos.deEtiqueta}>¿De quién es el dinero?</Text>
        <Text style={estilos.deNombre}>
          {tarjetaElegida ? `Del titular de ${tarjetaElegida.nombre}` : perfil?.nombre ?? '...'}
        </Text>
      </View>

      <Chips
        etiqueta="Categoría"
        valor={categoria}
        onCambio={setCategoria}
        opciones={CATEGORIAS.map((c) => ({ id: c.id, etiqueta: `${c.nombre} ${Math.round(c.porcentaje * 100)}%`, color: c.color }))}
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
          {cuota ? <Text style={estilos.nota}>Se restará {formatoMXN(cuota)} del límite durante {meses} meses.</Text> : null}
        </>
      ) : null}

      <Chips
        etiqueta="Fuente del dinero"
        valor={fuente}
        onCambio={setFuente}
        opciones={opcionesFuente}
        vacio="Primero agrega una tarjeta de crédito en Ajustes → Tarjetas."
      />
      {forma !== 'contado' && tarjetaElegida?.dia_corte ? (
        <Text style={estilos.nota}>Esta tarjeta corta el día {tarjetaElegida.dia_corte} de cada mes.</Text>
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
      <Boton titulo="Registrar gasto" onPress={registrar} cargando={enviando} />
    </Caja>
  );
}

const estilos = StyleSheet.create({
  de: { marginBottom: 12 },
  deEtiqueta: { fontSize: 13, fontWeight: '600', color: colores.suave, marginBottom: 6 },
  deNombre: { fontSize: 16, color: colores.texto, fontWeight: '600' },
  nota: { fontSize: 12, color: colores.suave, marginBottom: 12, marginTop: -4 },
  fecha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  fechaTexto: { fontSize: 14, color: colores.texto, fontWeight: '500' },
});
