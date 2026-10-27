import React, { useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { useDatos } from '../../context/DatosContext';
import { Caja } from '../../components/Tarjeta';
import { Campo } from '../../components/Campo';
import { Boton } from '../../components/Boton';
import { Mensaje } from '../../components/Mensaje';
import { editarFamilia, expulsarMiembro, regenerarCodigo, salirFamilia, unirseFamilia } from '../../services/familiasService';
import { colores } from '../../theme';

// Familia = el grupo (tú y tu pareja) que comparte tarjetas, gastos y límites.
export function FamiliaSeccion() {
  const { familia, miembros, perfil, refrescar } = useDatos();
  const [codigo, setCodigo] = useState('');
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const soyAdmin = perfil?.rol === 'admin';
  const estoySolo = miembros.length <= 1;

  // Envuelve cualquier acción: muestra errores del servidor y recarga los datos.
  const ejecutar = async (accion: () => Promise<unknown>) => {
    setError(null);
    setTrabajando(true);
    try {
      await accion();
      await refrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setTrabajando(false);
    }
  };

  const confirmar = (titulo: string, mensaje: string, accion: () => Promise<unknown>) =>
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', style: 'destructive', onPress: () => ejecutar(accion) },
    ]);

  return (
    <Caja titulo="Familia">
      <Text style={estilos.nombreFamilia}>{familia?.nombre}</Text>
      {soyAdmin ? (
        <View style={{ marginBottom: 8 }}>
          <Campo etiqueta="Cambiar nombre de la familia" value={nombreNuevo} onChangeText={setNombreNuevo} placeholder={familia?.nombre} />
          <Boton chico variante="secundario" titulo="Guardar nombre" deshabilitado={trabajando || !nombreNuevo.trim()} onPress={() => ejecutar(async () => { await editarFamilia({ nombre: nombreNuevo.trim() }); setNombreNuevo(''); })} />
        </View>
      ) : null}
      <Text style={estilos.suave}>Código para invitar a tu pareja</Text>
      <Text style={estilos.codigo} selectable>{familia?.codigo_invitacion}</Text>
      <View style={estilos.botones}>
        <View style={{ flex: 1 }}>
          <Boton chico variante="secundario" titulo="Compartir código" onPress={() => Share.share({ message: `Únete a mi familia en Gastos en pareja con el código: ${familia?.codigo_invitacion}` })} />
        </View>
        {soyAdmin ? (
          <View style={{ flex: 1 }}>
            <Boton chico variante="secundario" titulo="Nuevo código" onPress={() => ejecutar(regenerarCodigo)} deshabilitado={trabajando} />
          </View>
        ) : null}
      </View>

      <Text style={[estilos.subtitulo, { marginTop: 16 }]}>Integrantes</Text>
      {miembros.map((m) => (
        <View key={m.id} style={estilos.fila}>
          <Text style={estilos.nombre}>{m.nombre}{m.id === perfil?.id ? ' (tú)' : ''}</Text>
          <Text style={estilos.suave}>{m.rol}</Text>
          {soyAdmin && m.id !== perfil?.id ? (
            <Boton chico variante="texto" titulo="Expulsar" onPress={() => confirmar('Expulsar', `¿Sacar a ${m.nombre} de la familia?`, () => expulsarMiembro(m.id))} />
          ) : null}
        </View>
      ))}

      <Mensaje texto={error} />

      {estoySolo ? (
        <View style={estilos.bloque}>
          <Text style={estilos.subtitulo}>¿Tu pareja ya creó la familia?</Text>
          <Campo etiqueta="Código de invitación" value={codigo} onChangeText={setCodigo} autoCapitalize="characters" placeholder="ABC123" />
          <Boton
            variante="secundario"
            titulo="Unirme a su familia"
            deshabilitado={trabajando || !codigo.trim()}
            onPress={() => confirmar('Unirte a otra familia', 'Tus gastos, tarjetas y límites pasarán a esa familia.', () => unirseFamilia(codigo))}
          />
        </View>
      ) : (
        <View style={estilos.bloque}>
          <Boton variante="peligro" titulo="Salir de esta familia" deshabilitado={trabajando} onPress={() => confirmar('Salir de la familia', 'Volverás a tener tu propia familia. Tus tarjetas se van contigo; los gastos quedan como historial.', salirFamilia)} />
        </View>
      )}
    </Caja>
  );
}

const estilos = StyleSheet.create({
  nombreFamilia: { fontSize: 18, fontWeight: '700', color: colores.texto, marginBottom: 8 },
  suave: { fontSize: 12, color: colores.suave },
  codigo: { fontSize: 30, fontWeight: '800', letterSpacing: 4, color: colores.primario, marginVertical: 8 },
  botones: { flexDirection: 'row', gap: 10 },
  subtitulo: { fontSize: 14, fontWeight: '700', color: colores.texto, marginBottom: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  nombre: { fontSize: 15, color: colores.texto, flex: 1 },
  bloque: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colores.borde },
});
