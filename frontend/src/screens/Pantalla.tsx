import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDatos } from '../context/DatosContext';
import { Mensaje } from '../components/Mensaje';
import { colores } from '../theme';

interface Props {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}

// Marco común de las pestañas: título, jalar-para-refrescar, teclado y errores de carga.
export function Pantalla({ titulo, subtitulo, children }: Props) {
  const { cargando, refrescar, error } = useDatos();
  const [recargando, setRecargando] = React.useState(false);

  const alJalar = async () => {
    setRecargando(true);
    await refrescar();
    setRecargando(false);
  };

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={estilos.contenido}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={recargando} onRefresh={alJalar} />}
        >
          <Text style={estilos.titulo}>{titulo}</Text>
          {subtitulo ? <Text style={estilos.subtitulo}>{subtitulo}</Text> : null}
          <Mensaje texto={error} />
          {cargando ? <Text style={estilos.cargando}>Cargando...</Text> : <View>{children}</View>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16, paddingBottom: 40 },
  titulo: { fontSize: 26, fontWeight: '800', color: colores.texto },
  subtitulo: { fontSize: 14, color: colores.suave, marginBottom: 16, textTransform: 'capitalize' },
  cargando: { textAlign: 'center', color: colores.suave, marginTop: 40 },
});
