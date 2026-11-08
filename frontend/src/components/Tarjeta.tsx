import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colores, radio } from '../theme';

interface Props {
  titulo?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

// Caja blanca con sombra suave. La usan todas las pantallas para agrupar contenido.
export function Caja({ titulo, children, style }: Props) {
  return (
    <View style={[estilos.caja, style]}>
      {titulo ? <Text style={estilos.titulo}>{titulo}</Text> : null}
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: {
    backgroundColor: colores.tarjeta,
    borderRadius: radio.l,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  titulo: { fontSize: 16, fontWeight: '700', color: colores.texto, marginBottom: 12 },
});
