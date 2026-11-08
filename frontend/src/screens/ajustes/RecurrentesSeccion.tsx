import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDatos } from '../../context/DatosContext';
import { Caja } from '../../components/Tarjeta';
import { Campo } from '../../components/Campo';
import { Chips } from '../../components/Chips';
import { Boton } from '../../components/Boton';
import { Mensaje } from '../../components/Mensaje';
import { borrarRecurrente, crearRecurrente, editarRecurrente, verRecurrentes } from '../../services/recurrentesService';
import { codificarMotivo, CategoriaId, leerMotivo } from '../../utils/categorias';
import { formatoMXN, leerMonto } from '../../utils/dinero';
import { esFechaValida, fechaCorta, hoyISO } from '../../utils/fechas';
import { colores } from '../../theme';
import type { GastoRecurrente } from '../../types';

// Gastos automáticos: "cada 15 días se gastan $500". El servidor los registra solo cada día.
export function RecurrentesSeccion() {
  const { tarjetas, perfil, nombreDe, categorias, miEfectivo, refrescar } = useDatos();
  const [lista, setLista] = useState<GastoRecurrente[]>([]);
  const [motivo, setMotivo] = useState('');
  const [monto, setMonto] = useState('');
  const [cada, setCada] = useState('30');
  const [categoria, setCategoria] = useState<CategoriaId | null>(null);
  const [cuenta, setCuenta] = useState<number | null>(null);
  const [inicio, setInicio] = useState(hoyISO());
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = (await verRecurrentes({ orden: { campo: 'id' } })) as GastoRecurrente[];
      setLista(r.map((x) => ({ ...x, monto: Number(x.monto) })));
    } catch { setLista([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (cuenta === null && miEfectivo) setCuenta(miEfectivo.id); }, [miEfectivo]); // eslint-disable-line

  const misCuentas = tarjetas.filter((t) => t.titular_id === perfil?.id || t.tipo_pago === 'credito');

  const agregar = async () => {
    setError(null);
    const v = leerMonto(monto);
    const dias = Number(cada);
    if (!motivo.trim()) return setError('Escribe en qué es el gasto.');
    if (v === null || v <= 0) return setError('Escribe un monto mayor a 0.');
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) return setError('"Cada cuántos días" debe ser de 1 a 365.');
    if (!categoria) return setError('Elige una categoría.');
    if (!esFechaValida(inicio)) return setError('La fecha de inicio debe ser AAAA-MM-DD.');
    try {
      await crearRecurrente({
        tarjeta_id: cuenta, motivo: codificarMotivo(motivo, categoria, null), monto: v, cada_dias: dias, proxima_fecha: inicio,
      });
      setMotivo(''); setMonto('');
      await cargar();
      await refrescar(); // si empieza hoy, el gasto ya se creó
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear.');
    }
  };

  const alternar = async (r: GastoRecurrente) => {
    try { await editarRecurrente(r.id, { activo: !r.activo }); await cargar(); }
    catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo cambiar.'); }
  };

  const borrar = (r: GastoRecurrente) =>
    Alert.alert('Borrar gasto automático', 'Los gastos que ya se registraron se conservan.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => { try { await borrarRecurrente(r.id); await cargar(); } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo borrar.'); } } },
    ]);

  return (
    <Caja titulo="Gastos automáticos">
      {lista.length === 0 ? <Text style={estilos.suave}>Sin gastos automáticos. Sirven para rentas, suscripciones, mesadas...</Text> : null}
      {lista.map((r) => (
        <View key={r.id} style={[estilos.fila, !r.activo && { opacity: 0.5 }]}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.nombre}>{leerMotivo(r.motivo).texto}</Text>
            <Text style={estilos.suave}>
              {formatoMXN(r.monto)} cada {r.cada_dias} {r.cada_dias === 1 ? 'día' : 'días'} · {nombreDe(r.usuario_id)}
              {r.activo ? ` · próximo ${fechaCorta(r.proxima_fecha)}` : ' · en pausa'}
            </Text>
          </View>
          {r.usuario_id === perfil?.id ? (
            <>
              <Pressable hitSlop={8} onPress={() => alternar(r)}>
                <Ionicons name={r.activo ? 'pause-circle-outline' : 'play-circle-outline'} size={26} color={colores.primario} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => borrar(r)} style={{ marginLeft: 10 }}>
                <Ionicons name="trash-outline" size={22} color={colores.peligro} />
              </Pressable>
            </>
          ) : null}
        </View>
      ))}

      <View style={estilos.nueva}>
        <Text style={estilos.subtitulo}>Nuevo gasto automático</Text>
        <Campo etiqueta="¿En qué?" placeholder="Netflix, renta, mesada..." value={motivo} onChangeText={setMotivo} />
        <Campo etiqueta="Monto cada vez" placeholder="0.00" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} />
        <Campo etiqueta="Cada cuántos días" placeholder="30" keyboardType="number-pad" value={cada} onChangeText={setCada} ayuda="7 = cada semana · 15 = quincenal · 30 = mensual" />
        <Campo etiqueta="Primer cobro (AAAA-MM-DD)" value={inicio} onChangeText={setInicio} autoCapitalize="none" />
        <Chips etiqueta="Categoría" valor={categoria} onCambio={setCategoria} opciones={categorias.map((c) => ({ id: c.id, etiqueta: c.nombre, color: c.color }))} />
        <Chips etiqueta="Sale de" valor={cuenta} onCambio={setCuenta} opciones={misCuentas.map((t) => ({ id: t.id, etiqueta: t.nombre }))} />
        <Mensaje texto={error} />
        <Boton variante="secundario" titulo="Agregar" onPress={agregar} />
      </View>
    </Caja>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 6 },
  nombre: { fontSize: 15, fontWeight: '600', color: colores.texto },
  suave: { fontSize: 12, color: colores.suave },
  nueva: { marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: colores.borde },
  subtitulo: { fontSize: 14, fontWeight: '700', color: colores.texto, marginBottom: 10 },
});
