import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Pantalla } from './Pantalla';
import { useDatos } from '../context/DatosContext';
import { Caja } from '../components/Tarjeta';
import { Campo } from '../components/Campo';
import { Boton } from '../components/Boton';
import { BarraProgreso } from '../components/BarraProgreso';
import { Mensaje } from '../components/Mensaje';
import { EditarMetaModal, MoverMetaModal, RepartoMes } from '../components/AhorroPartes';
import { crearMeta } from '../services/metasService';
import { borrarMetasLocales, cargarMetas } from '../services/metas';
import { formatoMXN, leerMonto } from '../utils/dinero';
import { nombreMes } from '../utils/fechas';
import { colores } from '../theme';
import type { Meta, MetaLocal, TipoReparto } from '../types';

const NOMBRE_TIPO: Record<TipoReparto, string> = {
  siguiente_mes: 'al mes siguiente',
  ahorro: 'a ahorro libre',
  meta: 'a una meta',
};

// Ahorro: ahorro libre, reparto del sobrante, metas (editables, con entradas y salidas) y cierres.
export function AhorroScreen() {
  const { ahorro, cierres, repartos, metas, familia, metas: lista, nombreDe, refrescar } = useDatos();
  const [nombre, setNombre] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mover, setMover] = useState<{ meta: Meta | null; modo: 'meter' | 'sacar' }>({ meta: null, modo: 'meter' });
  const [editar, setEditar] = useState<Meta | null>(null);
  const [locales, setLocales] = useState<MetaLocal[]>([]);

  // metas que antes se guardaban solo en este teléfono
  useEffect(() => {
    if (familia) cargarMetas(familia.id).then(setLocales);
  }, [familia]);

  const totalLibre = ahorro.reduce((s, a) => s + a.ahorro, 0);
  const totalMetas = lista.reduce((s, m) => s + m.ahorrado, 0);

  const agregar = async () => {
    const v = leerMonto(objetivo);
    if (!nombre.trim() || v === null || v <= 0) return setError('Escribe el nombre y un objetivo mayor a 0.');
    setError(null);
    try {
      await crearMeta({ nombre: nombre.trim(), objetivo: v });
      setNombre(''); setObjetivo('');
      await refrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la meta.');
    }
  };

  const importarLocales = async () => {
    if (!familia) return;
    try {
      for (const m of locales) await crearMeta({ nombre: m.nombre, objetivo: m.objetivo });
      await borrarMetasLocales(familia.id);
      setLocales([]);
      await refrescar();
      Alert.alert('Listo', 'Tus metas ya están en la nube y las ve tu pareja.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron pasar las metas.');
    }
  };

  return (
    <Pantalla titulo="Ahorro y metas">
      <Mensaje texto={error} />

      <Caja titulo="Ahorro">
        <Text style={estilos.grande}>{formatoMXN(totalLibre + totalMetas)}</Text>
        <Text style={estilos.suave}>En total entre ahorro libre y metas</Text>
        <View style={estilos.fila}><Text style={estilos.texto}>Ahorro libre (sin meta)</Text><Text style={estilos.texto}>{formatoMXN(totalLibre)}</Text></View>
        {ahorro.map((a) => (
          <View key={a.usuario_id} style={estilos.fila}>
            <Text style={estilos.suave}>   {a.nombre}</Text>
            <Text style={estilos.suave}>{formatoMXN(a.ahorro)}</Text>
          </View>
        ))}
        <View style={estilos.fila}><Text style={estilos.texto}>En metas</Text><Text style={estilos.texto}>{formatoMXN(totalMetas)}</Text></View>
      </Caja>

      <RepartoMes />

      {locales.length > 0 ? (
        <Caja titulo="Metas guardadas en este teléfono">
          <Text style={[estilos.suave, { marginBottom: 10 }]}>
            Antes las metas se guardaban solo aquí ({locales.map((m) => m.nombre).join(', ')}). Pásalas a la nube para editarlas y que tu pareja también las vea.
          </Text>
          <Boton variante="secundario" titulo="Pasarlas a la nube" onPress={importarLocales} />
        </Caja>
      ) : null}

      <Caja titulo="Metas de ahorro">
        {metas.length === 0 ? <Text style={estilos.suave}>Aún no hay metas. Crea la primera abajo.</Text> : null}
        {metas.map((m) => (
          <View key={m.id} style={{ marginBottom: 16 }}>
            <View style={estilos.fila}>
              <Text style={estilos.nombre}>{m.nombre}</Text>
              <Text style={estilos.texto}>{formatoMXN(m.ahorrado)} / {formatoMXN(m.objetivo)}</Text>
            </View>
            <BarraProgreso proporcion={m.ahorrado / m.objetivo} color={colores.ok} />
            <View style={estilos.botones}>
              <Boton chico titulo="Agregar" onPress={() => setMover({ meta: m, modo: 'meter' })} />
              <Boton chico variante="secundario" titulo="Sacar" onPress={() => setMover({ meta: m, modo: 'sacar' })} />
              <Boton chico variante="texto" titulo="Editar" onPress={() => setEditar(m)} />
            </View>
          </View>
        ))}
        <View style={estilos.nueva}>
          <Campo etiqueta="Nueva meta" placeholder="Viaje, fondo de emergencia..." value={nombre} onChangeText={setNombre} />
          <Campo etiqueta="Objetivo" placeholder="0.00" keyboardType="decimal-pad" value={objetivo} onChangeText={setObjetivo} />
          <Boton variante="secundario" titulo="Crear meta" onPress={agregar} />
        </View>
      </Caja>

      <Caja titulo="Cierres anteriores">
        {cierres.length === 0 ? <Text style={estilos.suave}>Todavía no hay meses cerrados.</Text> : null}
        {cierres.slice(0, 12).map((c) => {
          const partes = repartos.filter((r) => r.cierre_id === c.id);
          return (
            <View key={c.id} style={estilos.fila}>
              <View style={{ flex: 1 }}>
                <Text style={[estilos.texto, { textTransform: 'capitalize' }]}>{nombreMes(c.mes)} · {nombreDe(c.usuario_id)}</Text>
                <Text style={estilos.suave}>
                  {partes.length === 0 ? 'Sin sobrante' : partes.map((p) => `${formatoMXN(p.monto)} ${NOMBRE_TIPO[p.tipo]}`).join(' · ')}
                </Text>
              </View>
              <Text style={estilos.texto}>{formatoMXN(c.sobrante)}</Text>
            </View>
          );
        })}
      </Caja>

      <MoverMetaModal meta={mover.meta} modo={mover.modo} onCerrar={() => setMover({ meta: null, modo: mover.modo })} />
      <EditarMetaModal meta={editar} onCerrar={() => setEditar(null)} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  grande: { fontSize: 30, fontWeight: '800', color: colores.texto },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  texto: { fontSize: 14, color: colores.texto },
  nombre: { fontSize: 15, fontWeight: '700', color: colores.texto },
  suave: { fontSize: 12, color: colores.suave },
  botones: { flexDirection: 'row', gap: 8, marginTop: 8 },
  nueva: { marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: colores.borde },
});
