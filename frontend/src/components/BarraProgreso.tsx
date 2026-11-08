import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colores } from '../theme';

interface Props {
  proporcion: number; // 0 a 1 (si pasa de 1 se pone roja)
  color?: string;
}

export function BarraProgreso({ proporcion, color = colores.primario }: Props) {
  const p = Number.isFinite(proporcion) ? Math.max(0, proporcion) : 0;
  return (
    <View style={estilos.fondo}>
      <View style={[estilos.relleno, { width: `${Math.min(p, 1) * 100}%`, backgroundColor: p > 1 ? colores.peligro : color }]} />
    </View>
  );
}

const estilos = StyleSheet.create({
  fondo: { height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  relleno: { height: 8, borderRadius: 4 },
});
