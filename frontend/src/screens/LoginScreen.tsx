import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Campo } from '../components/Campo';
import { Boton } from '../components/Boton';
import { Mensaje } from '../components/Mensaje';
import { iniciarSesion, registrarse, validarContrasena, verSesion } from '../services/authService';
import { colores } from '../theme';

// Iniciar sesión / crear cuenta en la misma pantalla.
export function LoginScreen() {
  const [modoRegistro, setModoRegistro] = useState(false);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const enviar = async () => {
    setError(null);
    setInfo(null);
    if (!correo.trim() || !contrasena) return setError('Escribe tu correo y contraseña.');
    if (modoRegistro && !nombre.trim()) return setError('Escribe tu nombre.');
    const faltante = modoRegistro ? validarContrasena(contrasena) : null;
    if (faltante) return setError(faltante);
    setCargando(true);
    try {
      if (modoRegistro) {
        await registrarse(nombre.trim(), correo.trim(), contrasena);
        // si Supabase pide confirmar el correo, todavía no hay sesión
        if (!(await verSesion())) setInfo('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.');
      } else {
        await iniciarSesion(correo.trim(), contrasena); // AuthContext detecta la sesión y cambia de pantalla solo
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={estilos.pantalla}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
          <Text style={estilos.logo}>💸</Text>
          <Text style={estilos.titulo}>Gastos en pareja</Text>
          <Text style={estilos.subtitulo}>Sabe a dónde va el dinero, mes a mes.</Text>

          <View style={estilos.formulario}>
            {modoRegistro ? <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Nain" autoCapitalize="words" /> : null}
            <Campo etiqueta="Correo" value={correo} onChangeText={setCorreo} placeholder="correo@ejemplo.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <Campo etiqueta="Contraseña" value={contrasena} onChangeText={setContrasena} placeholder="8+ caracteres, mayúscula, minúscula y número" secureTextEntry autoCapitalize="none" />
            <Mensaje texto={error} />
            <Mensaje texto={info} tipo="info" />
            <Boton titulo={modoRegistro ? 'Crear cuenta' : 'Iniciar sesión'} onPress={enviar} cargando={cargando} />
            <View style={{ height: 8 }} />
            <Boton
              variante="texto"
              titulo={modoRegistro ? 'Ya tengo cuenta' : 'No tengo cuenta, registrarme'}
              onPress={() => { setModoRegistro(!modoRegistro); setError(null); setInfo(null); }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 56, textAlign: 'center' },
  titulo: { fontSize: 28, fontWeight: '800', textAlign: 'center', color: colores.texto },
  subtitulo: { fontSize: 14, textAlign: 'center', color: colores.suave, marginBottom: 28, marginTop: 4 },
  formulario: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
});
