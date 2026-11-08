import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDatos } from '../context/DatosContext';
import { Caja } from './Tarjeta';
import { GraficaBarras, Barra } from './GraficaBarras';
import { BarraProgreso } from './BarraProgreso';
import { categoriaDeGasto, leerMotivo } from '../utils/categorias';
import { montoEnMes, responsableDe } from '../utils/cargos';
import { formatoMXN, redondear } from '../utils/dinero';
import { colores } from '../theme';
import { sumarMeses } from '../utils/fechas';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corto = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const compacto = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n)));

// Análisis con TODOS los gastos: los de la nube y los del archivo local de meses viejos.
export function GraficasGastos({ mes }: { mes: string }) {
  const { gastos, tarjetas, categorias, nombreDe, mes: mesActual } = useDatos();

  const datos = useMemo(() => {
    // 6 meses hacia atrás desde el mes elegido y 3 hacia adelante (los MSI siguen cobrando)
    const meses = Array.from({ length: 10 }, (_, i) => sumarMeses(mes, i - 6));
    const barras: Barra[] = meses.map((m) => ({
      etiqueta: corto(m),
      valor: redondear(gastos.reduce((s, g) => s + montoEnMes(g, m), 0)),
      color: m === mes ? colores.primario : '#A5B4FC',
      tenue: m > mesActual,
    }));

    const delMes = gastos.filter((g) => montoEnMes(g, mes) > 0);
    const total = delMes.reduce((s, g) => s + montoEnMes(g, mes), 0);

    const porCat: Record<string, number> = {};
    const porPersona: Record<string, number> = {};
    for (const g of delMes) {
      const c = categoriaDeGasto(g) ?? 'sin';
      const monto = montoEnMes(g, mes);
      porCat[c] = (porCat[c] ?? 0) + monto;
      const quien = g.archivado ? g.archivado.usuario : nombreDe(responsableDe(g, tarjetas));
      porPersona[quien] = (porPersona[quien] ?? 0) + monto;
    }
    const top = [...delMes]
      .sort((a, b) => montoEnMes(b, mes) - montoEnMes(a, mes))
      .slice(0, 5);
    return { barras, total, porCat, porPersona, top };
  }, [gastos, mes, mesActual, tarjetas, nombreDe]);

  return (
    <>
      <Caja titulo="Gasto por mes">
        <GraficaBarras datos={datos.barras} formato={compacto} />
        <Text style={estilos.suave}>Los meses más claros son futuros: lo que ya cobran tus MSI.</Text>
      </Caja>

      <Caja titulo={`Por categoría · ${formatoMXN(datos.total)}`}>
        {[...categorias.map((c) => ({ id: c.id as string, nombre: c.nombre, color: c.color })), { id: 'sin', nombre: 'Sin categoría', color: '#9CA3AF' }].map((c) => {
          const v = redondear(datos.porCat[c.id] ?? 0);
          if (c.id === 'sin' && v === 0) return null;
          return (
            <View key={c.id} style={{ marginBottom: 10 }}>
              <View style={estilos.fila}>
                <Text style={[estilos.nombre, { color: c.color }]}>{c.nombre}</Text>
                <Text style={estilos.nombre}>{formatoMXN(v)} · {datos.total > 0 ? Math.round((v / datos.total) * 100) : 0}%</Text>
              </View>
              <BarraProgreso proporcion={datos.total > 0 ? v / datos.total : 0} color={c.color} />
            </View>
          );
        })}
      </Caja>

      <Caja titulo="Por persona">
        {Object.entries(datos.porPersona).length === 0 ? <Text style={estilos.suave}>Sin gastos este mes.</Text> : null}
        {Object.entries(datos.porPersona).map(([quien, v]) => (
          <View key={quien} style={{ marginBottom: 10 }}>
            <View style={estilos.fila}>
              <Text style={estilos.nombre}>{quien}</Text>
              <Text style={estilos.nombre}>{formatoMXN(redondear(v))}</Text>
            </View>
            <BarraProgreso proporcion={datos.total > 0 ? v / datos.total : 0} />
          </View>
        ))}
      </Caja>

      <Caja titulo="Los 5 cargos más grandes">
        {datos.top.length === 0 ? <Text style={estilos.suave}>Sin gastos este mes.</Text> : null}
        {datos.top.map((g) => (
          <View key={g.id} style={estilos.fila}>
            <Text style={[estilos.nombre, { flex: 1, fontWeight: '500' }]}>{leerMotivo(g.motivo).texto}</Text>
            <Text style={estilos.nombre}>{formatoMXN(montoEnMes(g, mes))}</Text>
          </View>
        ))}
      </Caja>
    </>
  );
}

const estilos = StyleSheet.create({
  suave: { fontSize: 12, color: colores.suave, marginTop: 8 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 3 },
  nombre: { fontSize: 14, fontWeight: '700', color: colores.texto },
});
