import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDatos } from '../../context/DatosContext';
import { Caja } from '../../components/Tarjeta';
import { Campo } from '../../components/Campo';
import { Boton } from '../../components/Boton';
import { Mensaje } from '../../components/Mensaje';
import { editarPorcentajes } from '../../services/familiasService';
import { leerMonto } from '../../utils/dinero';
import { colores } from '../../theme';

// Porcentajes del presupuesto (Obligatorios / Necesarios / Chucherías). Los dos de la familia ven los mismos.
export function PorcentajesSeccion() {
  const { familia, categorias, refrescar } = useDatos();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    setValores(Object.fromEntries(categorias.map((c) => [c.id, String(Math.round(c.porcentaje * 100))])));
  }, [familia?.pct_obligatorio, familia?.pct_necesario, familia?.pct_chucheria]); // eslint-disable-line

  const num = (id: string) => leerMonto(valores[id] ?? '') ?? 0;
  const suma = categorias.reduce((s, c) => s + num(c.id), 0);

  const guardar = async () => {
    setError(null); setOk(null);
    if (categorias.some((c) => num(c.id) < 0)) return setError('Los porcentajes no pueden ser negativos.');
    if (suma > 100) return setError('Los porcentajes no pueden sumar más de 100.');
    setCargando(true);
    try {
      await editarPorcentajes(num('obligatorio'), num('necesario'), num('chucheria'));
      await refrescar();
      setOk('Porcentajes actualizados para toda la familia.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Caja titulo="Porcentajes del presupuesto">
      <Text style={estilos.suave}>Qué parte de tu límite del mes le toca a cada categoría. Cambia para los dos.</Text>
      <View style={{ height: 10 }} />
      {categorias.map((c) => (
        <Campo
          key={c.id}
          etiqueta={`${c.nombre} (%)`}
          keyboardType="decimal-pad"
          value={valores[c.id] ?? ''}
          onChangeText={(t) => setValores({ ...valores, [c.id]: t })}
        />
      ))}
      <Text style={[estilos.suma, suma > 100 && { color: colores.peligro }]}>
        Suman {suma}% · libre para ahorro {Math.max(0, 100 - suma)}%
      </Text>
      <Mensaje texto={error} />
      <Mensaje texto={ok} tipo="info" />
      <Boton variante="secundario" titulo="Guardar porcentajes" onPress={guardar} cargando={cargando} />
    </Caja>
  );
}

const estilos = StyleSheet.create({
  suave: { fontSize: 12, color: colores.suave },
  suma: { fontSize: 13, fontWeight: '600', color: colores.texto, marginBottom: 12 },
});
