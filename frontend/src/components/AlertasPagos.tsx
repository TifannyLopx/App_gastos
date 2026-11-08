import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDatos } from '../context/DatosContext';
import { Caja } from './Tarjeta';
import { colores } from '../theme';
import { formatoMXN } from '../utils/dinero';
import { diasEntre, fechaCorta, hoyISO } from '../utils/fechas';

// Recordatorio en la pantalla principal: tarjetas con algo por pagar o con pago cerca (próximos 10 días).
export function AlertasPagos() {
  const { tarjetas, estado } = useDatos();
  const hoy = hoyISO();

  const avisos = tarjetas
    .filter((t) => t.tipo_pago === 'credito')
    .map((t) => {
      const e = estado.find((x) => x.tarjeta_id === t.id);
      if (!e) return null;
      if ((e.a_pagar ?? 0) > 0 && e.fecha_limite_pago) {
        return { id: t.id, nombre: t.nombre, monto: e.a_pagar ?? 0, fecha: e.fecha_limite_pago, pendiente: true };
      }
      if (e.prox_pago && (e.apartado ?? 0) > 0 && diasEntre(hoy, e.prox_pago) <= 10) {
        return { id: t.id, nombre: t.nombre, monto: e.apartado ?? 0, fecha: e.prox_pago, pendiente: false };
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (avisos.length === 0) return null;

  return (
    <Caja titulo="Pagos de tarjeta">
      {avisos.map((a) => {
        const dias = diasEntre(hoy, a.fecha);
        const texto = dias < 0 ? `venció hace ${-dias} d` : dias === 0 ? 'vence hoy' : `en ${dias} d`;
        return (
          <View key={a.id} style={estilos.fila}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.nombre}>{a.nombre}</Text>
              <Text style={[estilos.suave, dias <= 2 && { color: colores.peligro }]}>
                {a.pendiente ? 'Por pagar' : 'Se facturará'} · {fechaCorta(a.fecha)} ({texto})
              </Text>
            </View>
            <Text style={estilos.monto}>{formatoMXN(a.monto)}</Text>
          </View>
        );
      })}
      <Text style={estilos.suave}>Para marcar un pago ve a la pestaña Cuentas.</Text>
    </Caja>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  nombre: { fontSize: 15, fontWeight: '600', color: colores.texto },
  suave: { fontSize: 12, color: colores.suave },
  monto: { fontSize: 16, fontWeight: '700', color: colores.texto },
});
