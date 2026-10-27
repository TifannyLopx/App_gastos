import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDatos } from '../../context/DatosContext';
import { Caja } from '../../components/Tarjeta';
import { Campo } from '../../components/Campo';
import { Boton } from '../../components/Boton';
import { Mensaje } from '../../components/Mensaje';
import { crearAportacion, editarAportacion } from '../../services/limitesService';
import { CATEGORIAS, PORCENTAJE_LIBRE } from '../../utils/categorias';
import { formatoMXN, leerMonto } from '../../utils/dinero';
import { nombreMes } from '../../utils/fechas';
import { colores } from '../../theme';

// "Cambiar el límite de gastos": cuánto aporta cada quien al límite de este mes.
export function AportacionSeccion() {
  const { perfil, mes, miAportacion, refrescar } = useDatos();
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    setTexto(miAportacion ? String(miAportacion.aportacion) : '');
  }, [miAportacion]);

  const valor = leerMonto(texto);

  const guardar = async () => {
    setError(null);
    setOk(null);
    if (!perfil) return;
    if (valor === null || valor < 0) return setError('Escribe un monto válido (0 o más).');
    setGuardando(true);
    try {
      if (miAportacion) await editarAportacion(miAportacion.id, { aportacion: valor });
      else await crearAportacion({ mes, aportacion: valor });
      await refrescar();
      setOk('Límite actualizado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Caja titulo={`Mi límite de ${nombreMes(mes)}`}>
      <Campo
        etiqueta="Lo que pongo al límite este mes"
        keyboardType="decimal-pad"
        placeholder="0.00"
        value={texto}
        onChangeText={setTexto}
      />
      {perfil?.salario ? (
        <Boton chico variante="texto" titulo={`Usar mi salario (${formatoMXN(perfil.salario)})`} onPress={() => setTexto(String(perfil.salario))} />
      ) : null}

      {valor !== null && valor > 0 ? (
        <View style={estilos.reparto}>
          {CATEGORIAS.map((c) => (
            <View key={c.id} style={estilos.fila}>
              <Text style={[estilos.texto, { color: c.color }]}>{c.nombre} {Math.round(c.porcentaje * 100)}%</Text>
              <Text style={estilos.texto}>{formatoMXN(valor * c.porcentaje)}</Text>
            </View>
          ))}
          <View style={estilos.fila}>
            <Text style={estilos.suave}>Libre / ahorro {Math.round(PORCENTAJE_LIBRE * 100)}%</Text>
            <Text style={estilos.suave}>{formatoMXN(valor * PORCENTAJE_LIBRE)}</Text>
          </View>
        </View>
      ) : null}

      <Mensaje texto={error} />
      <Mensaje texto={ok} tipo="info" />
      <Boton titulo="Guardar límite" onPress={guardar} cargando={guardando} />
    </Caja>
  );
}

const estilos = StyleSheet.create({
  reparto: { marginVertical: 12, padding: 12, backgroundColor: colores.fondo, borderRadius: 12 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  texto: { fontSize: 14, fontWeight: '600', color: colores.texto },
  suave: { fontSize: 13, color: colores.suave },
});
