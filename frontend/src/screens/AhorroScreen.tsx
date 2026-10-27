import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pantalla } from './Pantalla';
import { useDatos } from '../context/DatosContext';
import { Caja } from '../components/Tarjeta';
import { Campo } from '../components/Campo';
import { Boton } from '../components/Boton';
import { BarraProgreso } from '../components/BarraProgreso';
import { Mensaje } from '../components/Mensaje';
import { cerrarMes, editarCierre } from '../services/cierresService';
import { cargarMetas, guardarMetas } from '../services/metas';
import { formatoMXN, leerMonto } from '../utils/dinero';
import { aFecha, nombreMes, sumarMeses } from '../utils/fechas';
import { colores } from '../theme';
import type { DestinoCierre, Meta } from '../types';

const NOMBRE_DESTINO: Record<DestinoCierre, string> = {
  siguiente_mes: 'Pasó al mes siguiente',
  ahorro: 'Se fue a ahorro',
};

// Ahorro acumulado, cierre del mes pasado (sobrante) y metas de ahorro.
export function AhorroScreen() {
  const { ahorro, cierres, perfil, familia, mes, refrescar, nombreDe } = useDatos();
  const [metas, setMetas] = useState<Meta[]>([]);
  const [nombreMeta, setNombreMeta] = useState('');
  const [objetivoMeta, setObjetivoMeta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    if (familia) cargarMetas(familia.id).then(setMetas);
  }, [familia]);

  const mesPasado = sumarMeses(mes, -1);
  const miCierre = cierres.find((c) => c.usuario_id === perfil?.id && c.mes === mesPasado);
  const totalAhorro = ahorro.reduce((s, a) => s + a.ahorro, 0);

  const mandar = async (destino: DestinoCierre) => {
    setError(null);
    setTrabajando(true);
    try {
      if (miCierre) await editarCierre(aFecha(mesPasado), destino);
      else await cerrarMes(destino, aFecha(mesPasado));
      await refrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setTrabajando(false);
    }
  };

  const agregarMeta = async () => {
    const objetivo = leerMonto(objetivoMeta);
    if (!familia) return;
    if (!nombreMeta.trim() || objetivo === null || objetivo <= 0) return setError('Escribe el nombre y un objetivo mayor a 0.');
    setError(null);
    const nuevas = [...metas, { id: String(Date.now()), nombre: nombreMeta.trim(), objetivo }];
    setMetas(nuevas);
    await guardarMetas(familia.id, nuevas);
    setNombreMeta('');
    setObjetivoMeta('');
  };

  const borrarMeta = (id: string) =>
    Alert.alert('Borrar meta', '¿Quitar esta meta de la lista?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          if (!familia) return;
          const nuevas = metas.filter((m) => m.id !== id);
          setMetas(nuevas);
          await guardarMetas(familia.id, nuevas);
        },
      },
    ]);

  // El ahorro se reparte en orden: llena la primera meta, luego la siguiente...
  let restante = totalAhorro;
  const metasConAvance = metas.map((m) => {
    const aplicado = Math.min(restante, m.objetivo);
    restante -= aplicado;
    return { ...m, aplicado };
  });

  return (
    <Pantalla titulo="Ahorro y metas">
      <Mensaje texto={error} />

      <Caja titulo="Ahorro acumulado">
        <Text style={estilos.grande}>{formatoMXN(totalAhorro)}</Text>
        {ahorro.map((a) => (
          <View key={a.usuario_id} style={estilos.fila}>
            <Text style={estilos.texto}>{a.nombre}</Text>
            <Text style={estilos.texto}>{formatoMXN(a.ahorro)}</Text>
          </View>
        ))}
      </Caja>

      <Caja titulo={`Sobrante de ${nombreMes(mesPasado)}`}>
        {miCierre ? (
          <>
            <Text style={estilos.grande}>{formatoMXN(miCierre.sobrante)}</Text>
            <Text style={estilos.suave}>
              Límite {formatoMXN(miCierre.limite)} · gastado {formatoMXN(miCierre.gastado)}
            </Text>
            <Text style={[estilos.texto, { marginVertical: 8 }]}>{NOMBRE_DESTINO[miCierre.destino]}</Text>
            <Text style={estilos.suave}>Puedes cambiar a dónde va este mes pasado:</Text>
          </>
        ) : (
          <Text style={[estilos.suave, { marginBottom: 8 }]}>
            Aún no cierras el mes pasado. Si te sobró dinero, elige a dónde va (si te pasaste, se descuenta del mes siguiente).
          </Text>
        )}
        <View style={estilos.botones}>
          <View style={{ flex: 1 }}>
            <Boton chico variante={miCierre?.destino === 'siguiente_mes' ? 'primario' : 'secundario'} titulo="Al mes siguiente" onPress={() => mandar('siguiente_mes')} deshabilitado={trabajando} />
          </View>
          <View style={{ flex: 1 }}>
            <Boton chico variante={miCierre?.destino === 'ahorro' ? 'primario' : 'secundario'} titulo="A ahorro" onPress={() => mandar('ahorro')} deshabilitado={trabajando} />
          </View>
        </View>
      </Caja>

      <Caja titulo="Metas de ahorro">
        {metasConAvance.length === 0 ? <Text style={estilos.suave}>Aún no tienes metas. Crea la primera abajo.</Text> : null}
        {metasConAvance.map((m) => (
          <Pressable key={m.id} onLongPress={() => borrarMeta(m.id)} style={{ marginBottom: 14 }}>
            <View style={estilos.fila}>
              <Text style={estilos.nombre}>{m.nombre}</Text>
              <Text style={estilos.texto}>{formatoMXN(m.aplicado)} / {formatoMXN(m.objetivo)}</Text>
            </View>
            <BarraProgreso proporcion={m.aplicado / m.objetivo} color={colores.ok} />
          </Pressable>
        ))}
        {metasConAvance.length > 0 ? <Text style={[estilos.suave, { marginBottom: 12 }]}>El ahorro llena las metas en orden. Mantén presionada una meta para borrarla.</Text> : null}
        <Campo etiqueta="Nueva meta" placeholder="Viaje, fondo de emergencia..." value={nombreMeta} onChangeText={setNombreMeta} />
        <Campo etiqueta="Objetivo" placeholder="0.00" keyboardType="decimal-pad" value={objetivoMeta} onChangeText={setObjetivoMeta} />
        <Boton variante="secundario" titulo="Agregar meta" onPress={agregarMeta} />
        <Text style={[estilos.suave, { marginTop: 8 }]}>Las metas se guardan en este teléfono.</Text>
      </Caja>

      <Caja titulo="Cierres anteriores">
        {cierres.length === 0 ? <Text style={estilos.suave}>Todavía no hay meses cerrados.</Text> : null}
        {cierres.slice(0, 12).map((c) => (
          <View key={c.id} style={estilos.fila}>
            <View style={{ flex: 1 }}>
              <Text style={[estilos.texto, { textTransform: 'capitalize' }]}>{nombreMes(c.mes)} · {nombreDe(c.usuario_id)}</Text>
              <Text style={estilos.suave}>{NOMBRE_DESTINO[c.destino]}</Text>
            </View>
            <Text style={estilos.texto}>{formatoMXN(c.sobrante)}</Text>
          </View>
        ))}
      </Caja>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  grande: { fontSize: 30, fontWeight: '800', color: colores.texto, marginBottom: 6 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  texto: { fontSize: 14, color: colores.texto },
  nombre: { fontSize: 15, fontWeight: '600', color: colores.texto },
  suave: { fontSize: 12, color: colores.suave },
  botones: { flexDirection: 'row', gap: 10 },
});
