import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDatos } from '../../context/DatosContext';
import { Caja } from '../../components/Tarjeta';
import { Campo } from '../../components/Campo';
import { Chips } from '../../components/Chips';
import { Boton } from '../../components/Boton';
import { Mensaje } from '../../components/Mensaje';
import { borrarTarjeta, crearTarjeta } from '../../services/tarjetasService';
import { colores } from '../../theme';
import type { TipoPagoTarjeta } from '../../types';

const dia = (t: string): number | null => {
  const n = Number(t);
  return t.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
};

export function TarjetasSeccion() {
  const { tarjetas, perfil, nombreDe, refrescar } = useDatos();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoPagoTarjeta>('credito');
  const [corte, setCorte] = useState('');
  const [pago, setPago] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const agregar = async () => {
    setError(null);
    if (!nombre.trim()) return setError('Ponle un nombre a la tarjeta.');
    if (tipo === 'credito' && (dia(corte) === null || dia(pago) === null)) return setError('Escribe el día de corte y el día de pago (1 a 31).');
    setGuardando(true);
    try {
      await crearTarjeta({
        nombre: nombre.trim(),
        tipo_pago: tipo,
        dia_corte: tipo === 'credito' ? dia(corte) : null,
        dia_pago: tipo === 'credito' ? dia(pago) : null,
      });
      setNombre(''); setCorte(''); setPago('');
      await refrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar la tarjeta.');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = (id: number, nombreTarjeta: string) =>
    Alert.alert('Borrar tarjeta', `¿Borrar "${nombreTarjeta}"? Sus gastos quedarán como efectivo.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await borrarTarjeta(id);
            await refrescar();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo borrar.');
          }
        },
      },
    ]);

  return (
    <Caja titulo="Tarjetas">
      {tarjetas.length === 0 ? <Text style={estilos.suave}>No hay tarjetas registradas.</Text> : null}
      {tarjetas.map((t) => (
        <View key={t.id} style={estilos.fila}>
          <Ionicons name="card-outline" size={22} color={colores.primario} />
          <View style={{ flex: 1 }}>
            <Text style={estilos.nombre}>{t.nombre}</Text>
            <Text style={estilos.suave}>
              {t.tipo_pago === 'credito' ? `Crédito · corte ${t.dia_corte ?? '-'} · pago ${t.dia_pago ?? '-'}` : 'Débito'} · de {nombreDe(t.titular_id)}
            </Text>
          </View>
          {t.titular_id === perfil?.id ? (
            <Pressable hitSlop={10} onPress={() => borrar(t.id, t.nombre)}>
              <Ionicons name="trash-outline" size={20} color={colores.peligro} />
            </Pressable>
          ) : null}
        </View>
      ))}

      <View style={estilos.nueva}>
        <Text style={estilos.subtitulo}>Agregar tarjeta mía</Text>
        <Campo etiqueta="Nombre" placeholder="BBVA, Nu, Liverpool..." value={nombre} onChangeText={setNombre} />
        <Chips
          etiqueta="Tipo"
          valor={tipo}
          onCambio={setTipo}
          opciones={[{ id: 'credito', etiqueta: 'Crédito' }, { id: 'debito', etiqueta: 'Débito' }]}
        />
        {tipo === 'credito' ? (
          <>
            <Campo etiqueta="Día de corte" placeholder="Ej. 15" keyboardType="number-pad" value={corte} onChangeText={setCorte} />
            <Campo etiqueta="Día de pago" placeholder="Ej. 5" keyboardType="number-pad" value={pago} onChangeText={setPago} />
          </>
        ) : null}
        <Mensaje texto={error} />
        <Boton variante="secundario" titulo="Agregar tarjeta" onPress={agregar} cargando={guardando} />
      </View>
    </Caja>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  nombre: { fontSize: 15, fontWeight: '600', color: colores.texto },
  suave: { fontSize: 12, color: colores.suave },
  nueva: { marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: colores.borde },
  subtitulo: { fontSize: 14, fontWeight: '700', color: colores.texto, marginBottom: 10 },
});
