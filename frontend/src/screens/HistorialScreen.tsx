import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Pantalla } from './Pantalla';
import { useDatos } from '../context/DatosContext';
import { Caja } from '../components/Tarjeta';
import { SelectorMes } from '../components/SelectorMes';
import { Chips } from '../components/Chips';
import { FilaGasto } from '../components/FilaGasto';
import { FormularioGasto } from '../components/FormularioGasto';
import { GraficasGastos } from '../components/GraficasGastos';
import { Hoja } from '../components/Hoja';
import { Boton } from '../components/Boton';
import { CategoriaId, categoriaDeGasto } from '../utils/categorias';
import { montoEnMes, ultimoMesDeCobro } from '../utils/cargos';
import { formatoMXN, redondear } from '../utils/dinero';
import { borrarGasto } from '../services/gastosService';
import { inicioMes } from '../utils/fechas';
import { colores } from '../theme';
import type { Gasto } from '../types';

type Filtro = CategoriaId | 'todas';
type Vista = 'gastos' | 'graficas';

// Historial: todos los gastos de la familia (nube + archivo local). Se muestran los que le pegan
// al mes elegido: un MSI aparece en cada mes que dura, también en los meses que todavía no llegan.
// Toca un gasto para verlo, editarlo o borrarlo.
export function HistorialScreen() {
  const { gastos, mes: mesActual, perfil, refrescar, categorias } = useDatos();
  const [mes, setMes] = useState(mesActual);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [vista, setVista] = useState<Vista>('gastos');
  const [abierto, setAbierto] = useState<Gasto | null>(null);

  // hasta qué mes futuro se puede navegar: el último mes en que algún MSI todavía cobra
  const ultimoMes = useMemo(
    () => gastos.reduce((max, g) => { const u = ultimoMesDeCobro(g); return u > max ? u : max; }, mesActual),
    [gastos, mesActual],
  );

  const delMes = useMemo(
    () => gastos.filter((g) => montoEnMes(g, mes) > 0 && (filtro === 'todas' || categoriaDeGasto(g) === filtro)),
    [gastos, mes, filtro],
  );
  const total = redondear(delMes.reduce((s, g) => s + montoEnMes(g, mes), 0));
  const esFuturo = mes > mesActual;
  const esMio = (g: Gasto) => g.usuario_id === perfil?.id && !g.archivado;

  const confirmarBorrado = (g: Gasto) =>
    Alert.alert('Borrar gasto', '¿Seguro que quieres borrarlo? Si fue con débito o efectivo, el dinero regresa a la cuenta.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await borrarGasto(g.id);
            setAbierto(null);
            await refrescar();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo borrar.');
          }
        },
      },
    ]);

  return (
    <Pantalla titulo="Historial">
      <Chips
        valor={vista}
        onCambio={setVista}
        opciones={[{ id: 'gastos', etiqueta: 'Gastos' }, { id: 'graficas', etiqueta: 'Gráficas' }]}
      />
      <SelectorMes mes={mes} onCambio={(m) => setMes(inicioMes(m))} maximo={ultimoMes} />
      {esFuturo ? <Text style={estilos.futuro}>Mes futuro: esto es lo que ya cobrarán tus compras a meses sin intereses.</Text> : null}

      {vista === 'graficas' ? (
        <GraficasGastos mes={mes} />
      ) : (
        <>
          <Chips
            valor={filtro}
            onCambio={setFiltro}
            opciones={[
              { id: 'todas', etiqueta: 'Todos' },
              ...categorias.map((c) => ({ id: c.id as Filtro, etiqueta: c.nombre, color: c.color })),
            ]}
          />
          <Caja>
            <View style={estilos.totalFila}>
              <Text style={estilos.suave}>{esFuturo ? 'Cargos previstos' : 'Cargos del mes'}</Text>
              <Text style={estilos.total}>-{formatoMXN(total)}</Text>
            </View>
            {delMes.length === 0 ? <Text style={estilos.vacio}>No hay gastos en este mes.</Text> : null}
            {delMes.map((g, i) => (
              <View key={g.id} style={i > 0 && estilos.linea}>
                <FilaGasto gasto={g} mes={mes} onPress={() => setAbierto(g)} />
              </View>
            ))}
          </Caja>
          {delMes.length > 0 ? <Text style={estilos.pista}>Toca un gasto para verlo o editarlo.</Text> : null}
        </>
      )}

      <Hoja visible={!!abierto} titulo={abierto && esMio(abierto) ? 'Editar gasto' : 'Detalle del gasto'} onCerrar={() => setAbierto(null)}>
        {abierto && esMio(abierto) ? (
          <>
            <FormularioGasto gasto={abierto} onListo={() => setAbierto(null)} />
            <View style={{ marginTop: 10 }}>
              <Boton variante="peligro" titulo="Borrar gasto" onPress={() => confirmarBorrado(abierto)} />
            </View>
          </>
        ) : abierto ? (
          <>
            <FilaGasto gasto={abierto} mes={abierto.fecha_compra.slice(0, 7) + '-01'} />
            <Text style={estilos.pista}>
              {abierto.archivado ? 'Este gasto está en tu archivo local y no se puede editar.' : 'Solo quien registró el gasto puede editarlo.'}
            </Text>
          </>
        ) : null}
      </Hoja>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 },
  suave: { fontSize: 13, color: colores.suave },
  total: { fontSize: 20, fontWeight: '800', color: colores.peligro },
  vacio: { textAlign: 'center', color: colores.suave, paddingVertical: 24 },
  linea: { borderTopWidth: 1, borderTopColor: colores.borde },
  pista: { fontSize: 12, color: colores.suave, textAlign: 'center', marginTop: 4 },
  futuro: { fontSize: 12, color: colores.alerta, marginBottom: 10 },
});
