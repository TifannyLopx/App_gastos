import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Gasto } from '../types';
import { useDatos } from '../context/DatosContext';
import { categoriaPorId, ETIQUETAS, leerMotivo } from '../utils/categorias';
import { cuotaEnMes, formaPagoDe, montoEnMes, NOMBRE_FORMA_PAGO } from '../utils/cargos';
import { fechaCorta } from '../utils/fechas';
import { formatoMXN, redondear } from '../utils/dinero';
import { colores } from '../theme';

interface Props {
  gasto: Gasto;
  mes: string; // mes que se está mirando (para saber qué cuota de MSI toca)
  onPress?: () => void;
}

// Un renglón del historial. El nombre se muestra COMPLETO (se parte en varias líneas si es largo).
// En un MSI el número grande es lo que cuesta ESE mes (la cuota); el total va chico abajo.
export function FilaGasto({ gasto, mes, onPress }: Props) {
  const { tarjetas, nombreDe, mes: mesActual } = useDatos();
  const { texto, categoria, etiqueta } = leerMotivo(gasto.motivo);
  const cat = categoriaPorId(categoria);
  const tarjeta = tarjetas.find((t) => t.id === gasto.tarjeta_id);
  const forma = formaPagoDe(gasto, tarjetas);
  const cuota = cuotaEnMes(gasto, mes);
  const esMsi = !!gasto.msi && gasto.msi > 1;
  const cargo = montoEnMes(gasto, mes);
  const nombreEtiqueta = ETIQUETAS.find((e) => e.id === etiqueta)?.nombre;
  const quien = gasto.archivado?.usuario ?? nombreDe(gasto.usuario_id);
  const cuenta = gasto.archivado ? gasto.archivado.tarjeta ?? 'Efectivo' : tarjeta?.nombre ?? 'Efectivo';

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={estilos.fila}>
      <View style={[estilos.punto, { backgroundColor: cat?.color ?? colores.borde }]} />
      <View style={{ flex: 1 }}>
        <Text style={estilos.titulo}>{texto}</Text>
        <Text style={estilos.suave}>
          {quien} · {cuenta} · {fechaCorta(gasto.fecha_compra)}
        </Text>
        <Text style={estilos.suave}>
          {cat?.nombre ?? 'Sin categoría'}
          {nombreEtiqueta ? ` · ${nombreEtiqueta}` : ''} · {NOMBRE_FORMA_PAGO[forma]}
          {gasto.archivado ? ' · archivo' : ''}
          {mes > mesActual ? ' · próximo' : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', maxWidth: 120 }}>
        <Text style={estilos.monto}>-{formatoMXN(esMsi ? cargo : gasto.monto)}</Text>
        {esMsi ? (
          <Text style={estilos.suave}>
            {cuota ? `cuota ${cuota}/${gasto.msi}` : `${gasto.msi} MSI`}
          </Text>
        ) : null}
        {esMsi ? <Text style={estilos.suave}>total {formatoMXN(redondear(gasto.monto))}</Text> : null}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, gap: 12 },
  punto: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  titulo: { fontSize: 15, fontWeight: '600', color: colores.texto, flexShrink: 1 },
  suave: { fontSize: 12, color: colores.suave },
  monto: { fontSize: 15, fontWeight: '700', color: colores.peligro },
});
