import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colores, radio } from '../theme';

export interface Opcion<T extends string | number> {
  id: T;
  etiqueta: string;
  color?: string;
  deshabilitada?: boolean;
}

interface Props<T extends string | number> {
  etiqueta?: string;
  opciones: Opcion<T>[];
  valor: T | null;
  onCambio: (id: T) => void;
  vacio?: string; // texto si no hay opciones
}

// Selector de una sola opción hecho con "pastillas". En el celular se toca más rápido que un desplegable.
export function Chips<T extends string | number>({ etiqueta, opciones, valor, onCambio, vacio }: Props<T>) {
  return (
    <View style={estilos.contenedor}>
      {etiqueta ? <Text style={estilos.etiqueta}>{etiqueta}</Text> : null}
      {opciones.length === 0 && vacio ? <Text style={estilos.vacio}>{vacio}</Text> : null}
      <View style={estilos.fila}>
        {opciones.map((o) => {
          const activa = o.id === valor;
          const color = o.color ?? colores.primario;
          return (
            <Pressable
              key={String(o.id)}
              disabled={o.deshabilitada}
              onPress={() => onCambio(o.id)}
              style={[
                estilos.chip,
                activa && { backgroundColor: color, borderColor: color },
                o.deshabilitada && { opacity: 0.4 },
              ]}
            >
              <Text style={[estilos.texto, activa && { color: '#fff' }]}>{o.etiqueta}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { marginBottom: 12 },
  etiqueta: { fontSize: 13, fontWeight: '600', color: colores.suave, marginBottom: 6 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radio.pill,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: '#fff',
  },
  texto: { fontSize: 14, color: colores.texto, fontWeight: '500' },
  vacio: { fontSize: 13, color: colores.alerta, marginBottom: 6 },
});
