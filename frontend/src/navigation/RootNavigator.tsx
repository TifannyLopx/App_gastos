import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { DatosProvider } from '../context/DatosContext';
import { LoginScreen } from '../screens/LoginScreen';
import { InicioScreen } from '../screens/InicioScreen';
import { HistorialScreen } from '../screens/HistorialScreen';
import { AhorroScreen } from '../screens/AhorroScreen';
import { AjustesScreen } from '../screens/AjustesScreen';
import { colores } from '../theme';

const Tab = createBottomTabNavigator();

type NombreIcono = React.ComponentProps<typeof Ionicons>['name'];
const ICONOS: Record<string, [NombreIcono, NombreIcono]> = {
  Inicio: ['home', 'home-outline'],
  Historial: ['receipt', 'receipt-outline'],
  Ahorro: ['wallet', 'wallet-outline'],
  Ajustes: ['settings', 'settings-outline'],
};

function Pestanas() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colores.primario,
        tabBarInactiveTintColor: colores.suave,
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={ICONOS[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Inicio" component={InicioScreen} />
      <Tab.Screen name="Historial" component={HistorialScreen} />
      <Tab.Screen name="Ahorro" component={AhorroScreen} />
      <Tab.Screen name="Ajustes" component={AjustesScreen} />
    </Tab.Navigator>
  );
}

// Sin sesión -> Login. Con sesión -> las 4 pestañas (con los datos ya cargándose).
export function RootNavigator() {
  const { sesion, cargando } = useAuth();

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo }}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  if (!sesion) return <LoginScreen />;

  return (
    <NavigationContainer>
      <DatosProvider>
        <Pestanas />
      </DatosProvider>
    </NavigationContainer>
  );
}
