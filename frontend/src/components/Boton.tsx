import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colores, radio } from '../theme';

type Variante = 'primario' | 'secundario' | 'peligro' | 'texto';

interface Props {
  titulo: string;
  onPress: () => void;
  variante?: Variante;
  cargando?: boolean;
  deshabilitado?: boolean;
  chico?: boolean;
}

const fondo: Record<Variante, string> = {
  primario: colores.primario,
  secundario: colores.primarioSuave,
  peligro: colores.peligro,
  texto: 'transparent',
};
const letra: Record<Variante, string> = {
  primario: '#fff',
  secundario: colores.primario,
  peligro: '#fff',
  texto: colores.primario,
};

export function Boton({ titulo, onPress, variante = 'primario', cargando, deshabilitado, chico }: Props) {
  const inactivo = deshabilitado || cargando;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      style={({ pressed }) => [
        estilos.base,
        chico && estilos.chico,
        { backgroundColor: fondo[variante] },
        (pressed || inactivo) && { opacity: inactivo ? 0.5 : 0.8 },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={letra[variante]} />
      ) : (
        <Text style={[estilos.letra, { color: letra[variante] }, chico && { fontSize: 13 }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: radio.m, alignItems: 'center', justifyContent: 'center' },
  chico: { paddingVertical: 8, paddingHorizontal: 12 },
  letra: { fontSize: 16, fontWeight: '600' },
});
