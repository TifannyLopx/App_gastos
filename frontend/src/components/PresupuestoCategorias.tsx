import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDatos } from '../context/DatosContext';
import { Caja } from './Tarjeta';
import { BarraProgreso } from './BarraProgreso';
import { CATEGORIAS, PORCENTAJE_LIBRE, categoriaDeGasto } from '../utils/categorias';
import { montoEnMes } from '../utils/cargos';
import { colores } from '../theme';
import { formatoMXN, redondear } from '../utils/dinero';

// "¿A dónde va el dinero?": cuánto se lleva cada categoría contra su tope (35 / 20 / 15 %).
export function PresupuestoCategorias() {
  const { gastos, resumen, mes } = useDatos();

  const { porCategoria, sinCategoria, limiteTotal } = useMemo(() => {
    const acumulado: Record<string, number> = {};
    let sin = 0;
    for (const g of gastos) {
      const monto = montoEnMes(g, mes);
      if (monto === 0) continue;
      const cat = categoriaDeGasto(g);
      if (cat) acumulado[cat] = (acumulado[cat] ?? 0) + monto;
      else sin += monto;
    }
    return {
      porCategoria: acumulado,
      sinCategoria: redondear(sin),
      limiteTotal: resumen.reduce((s, r) => s + r.limite, 0),
    };
  }, [gastos, resumen, mes]);

  return (
    <Caja titulo="¿A dónde va el dinero?">
      {CATEGORIAS.map((c) => {
        const gastado = redondear(porCategoria[c.id] ?? 0);
        const tope = limiteTotal * c.porcentaje;
        return (
          <View key={c.id} style={estilos.bloque}>
            <View style={estilos.fila}>
              <Text style={[estilos.nombre, { color: c.color }]}>
                {c.nombre} · {Math.round(c.porcentaje * 100)}%
              </Text>
              <Text style={estilos.monto}>
                {formatoMXN(gastado)}
                <Text style={estilos.suave}> / {formatoMXN(tope)}</Text>
              </Text>
            </View>
            <BarraProgreso proporcion={tope > 0 ? gastado / tope : gastado > 0 ? 2 : 0} color={c.color} />
          </View>
        );
      })}
      <Text style={estilos.suave}>
        El {Math.round(PORCENTAJE_LIBRE * 100)}% restante queda libre para ahorro.
        {sinCategoria > 0 ? `  Sin categoría: ${formatoMXN(sinCategoria)}.` : ''}
      </Text>
    </Caja>
  );
}

const estilos = StyleSheet.create({
  bloque: { marginBottom: 12 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  nombre: { fontSize: 14, fontWeight: '700' },
  monto: { fontSize: 14, fontWeight: '600', color: colores.texto },
  suave: { fontSize: 12, color: colores.suave, fontWeight: '400' },
});
