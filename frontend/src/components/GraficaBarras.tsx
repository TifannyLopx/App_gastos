import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colores } from '../theme';

export interface Barra {
  etiqueta: string;
  valor: number;
  color?: string;
  tenue?: boolean; // meses futuros
}

interface Props {
  datos: Barra[];
  alto?: number;
  formato: (n: number) => string;
}

// Gráfica de barras hecha solo con Views (sin librerías extra, así no pesa ni se rompe).
export function GraficaBarras({ datos, alto = 130, formato }: Props) {
  const max = Math.max(...datos.map((d) => d.valor), 1);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={estilos.fila}>
        {datos.map((d, i) => (
          <View key={`${d.etiqueta}-${i}`} style={estilos.columna}>
            <Text style={estilos.valor} numberOfLines={1}>{d.valor > 0 ? formato(d.valor) : ''}</Text>
            <View style={{ height: alto, justifyContent: 'flex-end' }}>
              <View
                style={{
                  height: Math.max(d.valor > 0 ? 4 : 0, (d.valor / max) * alto),
                  backgroundColor: d.color ?? colores.primario,
                  opacity: d.tenue ? 0.35 : 1,
                  borderRadius: 6,
                }}
              />
            </View>
            <Text style={estilos.etiqueta}>{d.etiqueta}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  columna: { width: 52, alignItems: 'stretch' },
  valor: { fontSize: 10, color: colores.suave, textAlign: 'center', marginBottom: 4 },
  etiqueta: { fontSize: 11, color: colores.suave, textAlign: 'center', marginTop: 6, textTransform: 'capitalize' },
});
