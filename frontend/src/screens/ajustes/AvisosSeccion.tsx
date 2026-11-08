import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useDatos } from '../../context/DatosContext';
import { Caja } from '../../components/Tarjeta';
import { Chips } from '../../components/Chips';
import { Boton } from '../../components/Boton';
import { Mensaje } from '../../components/Mensaje';
import {
  AVISOS_POR_DEFECTO, cargarConfigAvisos, ConfigAvisos, guardarConfigAvisos, programarAvisosDePago, registrarPush,
} from '../../services/notificacionesService';
import { colores } from '../../theme';

const DIAS = [0, 1, 2, 3, 5, 7, 10];
const HORAS = [8, 9, 12, 18, 20];

// Avisos: (1) cuando tu pareja registra un gasto (push) y (2) días antes de pagar cada tarjeta.
export function AvisosSeccion() {
  const { estadoPush, tarjetas, estado } = useDatos();
  const [config, setConfig] = useState<ConfigAvisos>(AVISOS_POR_DEFECTO);
  const [push, setPush] = useState(estadoPush);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => { cargarConfigAvisos().then(setConfig); }, []);
  useEffect(() => { setPush(estadoPush); }, [estadoPush]);

  const guardar = async (nueva: ConfigAvisos) => {
    setConfig(nueva);
    await guardarConfigAvisos(nueva);
    if (nueva.pagos) await registrarPush().then(setPush); // pide permiso si falta
    const n = await programarAvisosDePago(nueva, tarjetas, estado);
    setInfo(nueva.pagos ? `Listo: ${n} aviso${n === 1 ? '' : 's'} de pago programado${n === 1 ? '' : 's'}.` : 'Avisos de pago desactivados.');
  };

  const probar = async () => {
    const permiso = await Notifications.requestPermissionsAsync();
    if (!permiso.granted) return setInfo('Activa los permisos de notificaciones del teléfono para esta app.');
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Prueba de aviso', body: 'Así se verán tus avisos de pago y de gastos.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
    });
    setInfo('Te llegará una notificación de prueba en 3 segundos.');
  };

  const textoPush =
    push === 'activo' ? 'Activados: te avisamos cuando tu pareja registre un gasto.'
    : push === 'sin-permiso' ? 'Sin permiso: activa las notificaciones de esta app en los ajustes del teléfono.'
    : push === 'pendiente' ? 'Revisando...'
    : 'No disponible en este dispositivo (en la versión instalada con APK sí funciona).';

  return (
    <Caja titulo="Avisos">
      <Text style={estilos.subtitulo}>Gastos de tu pareja</Text>
      <Text style={[estilos.suave, { marginBottom: 14 }]}>{textoPush}</Text>

      <Text style={estilos.subtitulo}>Pagar tarjetas de crédito</Text>
      <Chips
        valor={config.pagos ? 'si' : 'no'}
        onCambio={(v) => guardar({ ...config, pagos: v === 'si' })}
        opciones={[{ id: 'si', etiqueta: 'Avisarme' }, { id: 'no', etiqueta: 'No avisar' }]}
      />
      {config.pagos ? (
        <>
          <Chips
            etiqueta="¿Cuántos días antes del pago?"
            valor={config.diasAntes}
            onCambio={(d) => guardar({ ...config, diasAntes: d })}
            opciones={DIAS.map((d) => ({ id: d, etiqueta: d === 0 ? 'Ese día' : `${d}` }))}
          />
          <Chips
            etiqueta="¿A qué hora?"
            valor={config.hora}
            onCambio={(h) => guardar({ ...config, hora: h })}
            opciones={HORAS.map((h) => ({ id: h, etiqueta: `${h}:00` }))}
          />
          <Text style={estilos.suave}>El aviso incluye cuánto pagar y si la cuenta con la que la pagas alcanza.</Text>
        </>
      ) : null}
      <View style={{ height: 12 }} />
      <Mensaje texto={info} tipo="info" />
      <Boton chico variante="secundario" titulo="Enviarme una notificación de prueba" onPress={probar} />
    </Caja>
  );
}

const estilos = StyleSheet.create({
  subtitulo: { fontSize: 14, fontWeight: '700', color: colores.texto, marginBottom: 6 },
  suave: { fontSize: 12, color: colores.suave },
});
