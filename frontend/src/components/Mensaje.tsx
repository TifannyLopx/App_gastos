import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colores, radio } from '../theme';

interface Props {
  texto: string | null;
  tipo?: 'error' | 'info';
}

export function Mensaje({ texto, tipo = 'error' }: Props) {
  if (!texto) return null;
  const error = tipo === 'error';
  return (
    <View style={[estilos.caja, { backgroundColor: error ? colores.peligroSuave : colores.primarioSuave }]}>
      <Text style={{ color: error ? colores.peligro : colores.primario, fontSize: 13 }}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { padding: 12, borderRadius: radio.m, marginBottom: 12 },
});
