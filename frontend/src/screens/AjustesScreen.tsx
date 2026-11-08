import React from 'react';
import { Alert, View } from 'react-native';
import { Pantalla } from './Pantalla';
import { Boton } from '../components/Boton';
import { Caja } from '../components/Tarjeta';
import { AportacionSeccion } from './ajustes/AportacionSeccion';
import { PorcentajesSeccion } from './ajustes/PorcentajesSeccion';
import { PerfilSeccion } from './ajustes/PerfilSeccion';
import { RecurrentesSeccion } from './ajustes/RecurrentesSeccion';
import { AvisosSeccion } from './ajustes/AvisosSeccion';
import { RespaldoSeccion } from './ajustes/RespaldoSeccion';
import { FamiliaSeccion } from './ajustes/FamiliaSeccion';
import { cerrarSesion } from '../services/authService';
import { borrarCuenta } from '../services/usuariosService';
import { quitarPush } from '../services/notificacionesService';

// El "menú": límite del mes, porcentajes, perfil, gastos automáticos, avisos, respaldo, familia y sesión.
export function AjustesScreen() {
  const salir = async () => {
    try {
      await quitarPush(); // este teléfono deja de recibir avisos de esta cuenta
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
            await quitarPush();
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
      <PorcentajesSeccion />
      <RecurrentesSeccion />
      <AvisosSeccion />
      <RespaldoSeccion />
      <PerfilSeccion />
      <FamiliaSeccion />
      <Caja>
        <Boton variante="secundario" titulo="Cerrar sesión" onPress={salir} />
        <View style={{ height: 10 }} />
        <Boton variante="peligro" titulo="Borrar mi cuenta" onPress={borrar} />
      </Caja>
    </Pantalla>
  );
}
