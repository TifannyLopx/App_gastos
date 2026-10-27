import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Pantalla } from './Pantalla';
import { useDatos } from '../context/DatosContext';
import { Caja } from '../components/Tarjeta';
import { SelectorMes } from '../components/SelectorMes';
import { Chips } from '../components/Chips';
import { FilaGasto } from '../components/FilaGasto';
import { CATEGORIAS, CategoriaId, categoriaDeGasto } from '../utils/categorias';
import { montoEnMes } from '../utils/cargos';
import { formatoMXN, redondear } from '../utils/dinero';
import { borrarGasto } from '../services/gastosService';
import { inicioMes } from '../utils/fechas';
import { colores } from '../theme';

type Filtro = CategoriaId | 'todas';

// Historial: todos los gastos de la familia. Se muestran los que le pegan al mes elegido
// (un MSI aparece en cada mes que dura). Mantén presionado un gasto tuyo para borrarlo.
export function HistorialScreen() {
  const { gastos, mes: mesActual, perfil, refrescar } = useDatos();
  const [mes, setMes] = useState(mesActual);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const delMes = useMemo(
    () =>
      gastos.filter(
        (g) => montoEnMes(g, mes) > 0 && (filtro === 'todas' || categoriaDeGasto(g) === filtro),
      ),
    [gastos, mes, filtro],
  );
  const total = redondear(delMes.reduce((s, g) => s + montoEnMes(g, mes), 0));

  const confirmarBorrado = (id: number, de: string | null) => {
    if (de !== perfil?.id) return Alert.alert('No se puede', 'Solo puedes borrar los gastos que registraste tú.');
    Alert.alert('Borrar gasto', '¿Seguro que quieres borrarlo? No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await borrarGasto(id);
            await refrescar();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo borrar.');
          }
        },
      },
    ]);
  };

  return (
    <Pantalla titulo="Historial de gastos">
      <SelectorMes mes={mes} onCambio={(m) => setMes(inicioMes(m))} maximo={mesActual} />
      <Chips
        valor={filtro}
        onCambio={setFiltro}
        opciones={[
          { id: 'todas', etiqueta: 'Todos' },
          ...CATEGORIAS.map((c) => ({ id: c.id as Filtro, etiqueta: c.nombre, color: c.color })),
        ]}
      />
      <Caja>
        <View style={estilos.totalFila}>
          <Text style={estilos.suave}>Cargos del mes</Text>
          <Text style={estilos.total}>-{formatoMXN(total)}</Text>
        </View>
        {delMes.length === 0 ? <Text style={estilos.vacio}>No hay gastos en este mes.</Text> : null}
        {delMes.map((g, i) => (
          <View key={g.id} style={i > 0 && estilos.linea}>
            <FilaGasto gasto={g} mes={mes} onLargo={() => confirmarBorrado(g.id, g.usuario_id)} />
          </View>
        ))}
      </Caja>
      {delMes.length > 0 ? <Text style={estilos.pista}>Mantén presionado un gasto tuyo para borrarlo.</Text> : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 },
  suave: { fontSize: 13, color: colores.suave },
  total: { fontSize: 20, fontWeight: '800', color: colores.peligro },
  vacio: { textAlign: 'center', color: colores.suave, paddingVertical: 24 },
  linea: { borderTopWidth: 1, borderTopColor: colores.borde },
  pista: { fontSize: 12, color: colores.suave, textAlign: 'center' },
});
