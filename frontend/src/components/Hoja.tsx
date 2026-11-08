import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores } from '../theme';

interface Props {
  visible: boolean;
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}

// Ventana que sube desde abajo. La usan todos los formularios emergentes (editar, transferir, pagar...).
export function Hoja({ visible, titulo, onCerrar, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={estilos.fondo}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={estilos.hoja}>
            <View style={estilos.encabezado}>
              <Text style={estilos.titulo} numberOfLines={1}>{titulo}</Text>
              <Pressable hitSlop={12} onPress={onCerrar}>
                <Ionicons name="close" size={24} color={colores.suave} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  hoja: { backgroundColor: colores.fondo, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '92%' },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  titulo: { fontSize: 18, fontWeight: '800', color: colores.texto, flex: 1, marginRight: 12 },
});
