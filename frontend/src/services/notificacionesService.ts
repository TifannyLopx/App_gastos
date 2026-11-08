import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { llamarFuncion } from './crudService'
import type { EstadoCuenta, Tarjeta } from '../types'
import { formatoMXN } from '../utils/dinero'
import { aFecha, diasEntre, hoyISO, sumarDias } from '../utils/fechas'

// ---------- configuración que guarda cada celular ----------
export interface ConfigAvisos {
  pagos: boolean // avisar antes de pagar tarjetas
  diasAntes: number // cuántos días antes
  hora: number // a qué hora del día (0-23)
}

export const AVISOS_POR_DEFECTO: ConfigAvisos = { pagos: true, diasAntes: 3, hora: 9 }
const CLAVE = 'avisos:config'

export async function cargarConfigAvisos(): Promise<ConfigAvisos> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE)
    return crudo ? { ...AVISOS_POR_DEFECTO, ...JSON.parse(crudo) } : AVISOS_POR_DEFECTO
  } catch {
    return AVISOS_POR_DEFECTO
  }
}

export const guardarConfigAvisos = (c: ConfigAvisos) => AsyncStorage.setItem(CLAVE, JSON.stringify(c))

// ---------- cómo se ven las notificaciones con la app abierta ----------
export function configurarNotificaciones() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Avisos',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {})
  }
}

// ---------- push: avisos cuando tu pareja registra un gasto ----------
export type EstadoPush = 'activo' | 'sin-permiso' | 'no-disponible'

// pide permiso, saca el token de este celular y se lo manda a Supabase
export async function registrarPush(): Promise<EstadoPush> {
  try {
    if (!Device.isDevice) return 'no-disponible' // emuladores no reciben push
    let permiso = await Notifications.getPermissionsAsync()
    if (!permiso.granted) permiso = await Notifications.requestPermissionsAsync()
    if (!permiso.granted) return 'sin-permiso'

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
    await llamarFuncion('registrar_dispositivo', { p_token: token, p_plataforma: Platform.OS })
    await AsyncStorage.setItem('push:token', token)
    return 'activo'
  } catch (e) {
    if (__DEV__) console.warn('push no disponible', e)
    return 'no-disponible'
  }
}

// al cerrar sesión este celular deja de recibir los avisos de esa cuenta
export async function quitarPush() {
  try {
    const token = await AsyncStorage.getItem('push:token')
    if (token) await llamarFuncion('borrar_dispositivo', { p_token: token })
    await AsyncStorage.removeItem('push:token')
  } catch {
    /* no pasa nada si falla */
  }
}

// ---------- avisos locales: pagar tarjetas ----------
const PREFIJO = 'pago-tarjeta-'

// Programa un aviso por cada tarjeta de crédito, N días antes de su fecha de pago.
// Se vuelve a programar cada vez que se abre la app, con los números más recientes.
export async function programarAvisosDePago(
  config: ConfigAvisos,
  tarjetas: Tarjeta[],
  estados: EstadoCuenta[],
): Promise<number> {
  try {
    const programadas = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      programadas
        .filter((n) => n.identifier.startsWith(PREFIJO))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    )
    if (!config.pagos) return 0

    const permiso = await Notifications.getPermissionsAsync()
    if (!permiso.granted) return 0

    const hoy = hoyISO()
    let total = 0
    for (const t of tarjetas.filter((x) => x.tipo_pago === 'credito')) {
      const e = estados.find((x) => x.tarjeta_id === t.id)
      if (!e) continue

      // fechas de pago que siguen: la pendiente (si hay) y la del próximo corte
      const fechas: { fecha: string; monto: number }[] = []
      if (e.fecha_limite_pago && (e.a_pagar ?? 0) > 0) fechas.push({ fecha: e.fecha_limite_pago, monto: e.a_pagar ?? 0 })
      if (e.prox_pago) fechas.push({ fecha: e.prox_pago, monto: e.apartado ?? 0 })

      for (const { fecha, monto } of fechas) {
        const aviso = sumarDias(fecha, -config.diasAntes)
        const cuando = aFecha(aviso)
        cuando.setHours(config.hora, 0, 0, 0)
        if (cuando.getTime() <= Date.now()) continue // ya pasó

        const cuenta = tarjetas.find((x) => x.id === t.cuenta_pago_id)
        const estadoCuenta = estados.find((x) => x.tarjeta_id === t.cuenta_pago_id)
        const faltan = diasEntre(hoy, fecha)
        let sugerencia = ''
        if (cuenta && estadoCuenta) {
          const libre = (estadoCuenta.saldo ?? 0)
          sugerencia =
            libre >= monto
              ? ` Tu cuenta ${cuenta.nombre} tiene ${formatoMXN(libre)}: te alcanza.`
              : ` Tu cuenta ${cuenta.nombre} tiene ${formatoMXN(libre)}: te faltarían ${formatoMXN(monto - libre)}.`
        }
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIJO}${t.id}-${fecha}`,
          content: {
            title: `Pagar ${t.nombre}`,
            body: `Vence el ${fecha.slice(8, 10)}/${fecha.slice(5, 7)} (en ${faltan} días). Pago aproximado: ${formatoMXN(monto)}.${sugerencia}`,
            data: { tipo: 'pago', tarjeta_id: t.id },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: cuando },
        })
        total++
      }
    }
    return total
  } catch (e) {
    if (__DEV__) console.warn('no se pudieron programar avisos', e)
    return 0
  }
}
