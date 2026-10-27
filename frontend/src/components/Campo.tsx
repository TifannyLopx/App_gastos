import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colores, radio } from '../theme';

interface Props extends TextInputProps {
  etiqueta: string;
  ayuda?: string;
}

export function Campo({ etiqueta, ayuda, style, ...resto }: Props) {
  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput placeholderTextColor="#9CA3AF" style={[estilos.input, style]} {...resto} />
      {ayuda ? <Text style={estilos.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { marginBottom: 12 },
  etiqueta: { fontSize: 13, fontWeight: '600', color: colores.suave, marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.m,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colores.texto,
  },
  ayuda: { fontSize: 12, color: colores.suave, marginTop: 4 },
});
