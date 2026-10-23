/*import { supabase } from './src/lib/supabase'

// prueba tiff db tocar solo si quieres morir :D
supabase.from('usuarios').select('id').limit(1)
  .then(({ error }) => console.log('error:', error))
*/
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
