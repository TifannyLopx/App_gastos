import React from 'react';
import { Alert, View } from 'react-native';
import { Pantalla } from './Pantalla';
import { Boton } from '../components/Boton';
import { Caja } from '../components/Tarjeta';
import { AportacionSeccion } from './ajustes/AportacionSeccion';
import { PerfilSeccion } from './ajustes/PerfilSeccion';
import { TarjetasSeccion } from './ajustes/TarjetasSeccion';
import { FamiliaSeccion } from './ajustes/FamiliaSeccion';
import { cerrarSesion } from '../services/authService';
import { borrarCuenta } from '../services/usuariosService';

// El "menú": límite del mes, perfil, tarjetas, familia y cerrar sesión.
export function AjustesScreen() {
  const salir = async () => {
    try {
      await cerrarSesion();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo cerrar la sesión.');
    }
  };

  const borrar = () =>
    Alert.alert('Borrar cuenta', 'Se borrará tu cuenta y tus datos. Esto no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar para siempre',
        style: 'destructive',
        onPress: async () => {
          try {
            await borrarCuenta(); // también cierra la sesión
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo borrar la cuenta.');
          }
        },
      },
    ]);

  return (
    <Pantalla titulo="Ajustes">
      <AportacionSeccion />
      <PerfilSeccion />
      <TarjetasSeccion />
      <FamiliaSeccion />
      <Caja>
        <Boton variante="secundario" titulo="Cerrar sesión" onPress={salir} />
        <View style={{ height: 10 }} />
        <Boton variante="peligro" titulo="Borrar mi cuenta" onPress={borrar} />
      </Caja>
    </Pantalla>
  );
}
