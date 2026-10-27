import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Gasto } from '../types';
import { useDatos } from '../context/DatosContext';
import { categoriaPorId, ETIQUETAS, leerMotivo } from '../utils/categorias';
import { cuotaEnMes, formaPagoDe, NOMBRE_FORMA_PAGO } from '../utils/cargos';
import { fechaCorta } from '../utils/fechas';
import { formatoMXN, redondear } from '../utils/dinero';
import { colores } from '../theme';

interface Props {
  gasto: Gasto;
  mes: string; // mes que se está mirando (para saber qué cuota de MSI toca)
  onLargo?: () => void; // mantener presionado = opciones (borrar)
}

export function FilaGasto({ gasto, mes, onLargo }: Props) {
  const { tarjetas, nombreDe } = useDatos();
  const { texto, categoria, etiqueta } = leerMotivo(gasto.motivo);
  const cat = categoriaPorId(categoria);
  const tarjeta = tarjetas.find((t) => t.id === gasto.tarjeta_id);
  const forma = formaPagoDe(gasto, tarjetas);
  const cuota = cuotaEnMes(gasto, mes);
  const nombreEtiqueta = ETIQUETAS.find((e) => e.id === etiqueta)?.nombre;

  return (
    <Pressable onLongPress={onLargo} style={estilos.fila}>
      <View style={[estilos.punto, { backgroundColor: cat?.color ?? colores.borde }]} />
      <View style={{ flex: 1 }}>
        <Text style={estilos.titulo} numberOfLines={1}>{texto}</Text>
        <Text style={estilos.suave} numberOfLines={1}>
          {nombreDe(gasto.usuario_id)} · {tarjeta?.nombre ?? 'Efectivo'} · {fechaCorta(gasto.fecha_compra)}
        </Text>
        <Text style={estilos.suave} numberOfLines={1}>
          {cat?.nombre ?? 'Sin categoría'}
          {nombreEtiqueta ? ` · ${nombreEtiqueta}` : ''} · {NOMBRE_FORMA_PAGO[forma]}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={estilos.monto}>-{formatoMXN(gasto.monto)}</Text>
        {gasto.msi && gasto.msi > 1 ? (
          <Text style={estilos.suave}>
            {cuota ? `${cuota}/${gasto.msi} · ` : `${gasto.msi} MSI · `}
            {formatoMXN(redondear(gasto.monto / gasto.msi))}/mes
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  titulo: { fontSize: 15, fontWeight: '600', color: colores.texto },
  suave: { fontSize: 12, color: colores.suave },
  monto: { fontSize: 15, fontWeight: '700', color: colores.peligro },
});
