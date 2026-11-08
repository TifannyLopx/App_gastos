import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores } from '../theme';
import { nombreMes, sumarMeses } from '../utils/fechas';

interface Props {
  mes: string; // 'YYYY-MM-01'
  onCambio: (mes: string) => void;
  maximo?: string; // no deja avanzar más allá de este mes
}

export function SelectorMes({ mes, onCambio, maximo }: Props) {
  const puedeAvanzar = !maximo || mes < maximo;
  return (
    <View style={estilos.fila}>
      <Pressable hitSlop={12} onPress={() => onCambio(sumarMeses(mes, -1))}>
        <Ionicons name="chevron-back" size={22} color={colores.primario} />
      </Pressable>
      <Text style={estilos.texto}>{nombreMes(mes)}</Text>
      <Pressable hitSlop={12} disabled={!puedeAvanzar} onPress={() => onCambio(sumarMeses(mes, 1))}>
        <Ionicons name="chevron-forward" size={22} color={puedeAvanzar ? colores.primario : colores.borde} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  texto: { fontSize: 17, fontWeight: '700', color: colores.texto, textTransform: 'capitalize' },
});
