import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pantalla } from './Pantalla';
import { useDatos } from '../context/DatosContext';
import { Caja } from '../components/Tarjeta';
import { Boton } from '../components/Boton';
import { BarraProgreso } from '../components/BarraProgreso';
import { PagarModal, SaldoModal, TarjetaModal, TransferirModal } from '../components/ModalesCuentas';
import { formatoMXN } from '../utils/dinero';
import { diasEntre, fechaCorta, hoyISO } from '../utils/fechas';
import { colores } from '../theme';
import type { Tarjeta, TipoCuenta } from '../types';

// Cuentas: cuánto dinero hay (libre y asignado), tarjetas de débito/efectivo y tarjetas de crédito.
export function CuentasScreen() {
  const { tarjetas, estado, perfil, nombreDe, miembros } = useDatos();
  const [saldo, setSaldo] = useState<Tarjeta | null>(null);
  const [pagar, setPagar] = useState<Tarjeta | null>(null);
  const [tarjetaForm, setTarjetaForm] = useState<{ visible: boolean; tarjeta: Tarjeta | null; tipo?: TipoCuenta }>({ visible: false, tarjeta: null });
  const [transf, setTransf] = useState<{ visible: boolean; desde: number | null }>({ visible: false, desde: null });
  const nueva = (tipo: TipoCuenta) => setTarjetaForm({ visible: true, tarjeta: null, tipo });
  const cuentas = tarjetas.filter((t) => t.tipo_pago !== 'credito');
  const creditos = tarjetas.filter((t) => t.tipo_pago === 'credito');
  const est = (id: number) => estado.find((e) => e.tarjeta_id === id);

  const total = cuentas.reduce((s, c) => s + c.saldo, 0);
  const asignado = cuentas.reduce((s, c) => s + (est(c.id)?.apartado_en_cuenta ?? 0), 0);
  const libre = total - asignado;
  const deudaTotal = creditos.reduce((s, c) => s + (est(c.id)?.usado ?? 0), 0);
  const hoy = hoyISO();

  return (
    <Pantalla titulo="Cuentas" subtitulo="Tu dinero y tus tarjetas">
      <Caja titulo="Dinero entre todas las cuentas">
        <Text style={estilos.grande}>{formatoMXN(total)}</Text>
        <View style={estilos.leyenda}>
          <View style={[estilos.punto, { backgroundColor: colores.ok }]} />
          <Text style={estilos.texto}>Libre para gastar: <Text style={estilos.negrita}>{formatoMXN(libre)}</Text></Text>
        </View>
        <View style={estilos.leyenda}>
          <View style={[estilos.punto, { backgroundColor: colores.alerta }]} />
          <Text style={estilos.texto}>Asignado a pagar tarjetas: <Text style={estilos.negrita}>{formatoMXN(asignado)}</Text></Text>
        </View>
        <View style={{ height: 8 }} />
        <BarraProgreso proporcion={total > 0 ? asignado / total : asignado > 0 ? 2 : 0} color={colores.alerta} />
        <Text style={estilos.suave}>
          {asignado > total ? 'Tienes más apartado de lo que hay en tus cuentas.' : 'Lo amarillo ya está comprometido para pagar tus tarjetas de crédito.'}
        </Text>
        {miembros.length > 1 ? (
          <View style={estilos.personas}>
            {miembros.map((m) => (
              <View key={m.id} style={estilos.filaDos}>
                <Text style={estilos.texto}>{m.nombre}</Text>
                <Text style={estilos.texto}>{formatoMXN(cuentas.filter((c) => c.titular_id === m.id).reduce((s, c) => s + c.saldo, 0))}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {deudaTotal > 0 ? <Text style={[estilos.suave, { marginTop: 8 }]}>Deuda total en tarjetas de crédito: {formatoMXN(deudaTotal)}</Text> : null}
      </Caja>

      <Caja titulo="Débito y efectivo">
        <View style={estilos.agregar}>
          <Boton chico variante="texto" titulo="+ Agregar débito" onPress={() => nueva('debito')} />
        </View>
        {cuentas.map((c, i) => {
          const e = est(c.id);
          const mia = c.titular_id === perfil?.id;
          return (
            <View key={c.id} style={[estilos.cuenta, i > 0 && estilos.separador]}>
              <View style={estilos.filaDos}>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.nombre}>{c.nombre}</Text>
                  <Text style={estilos.suave}>{c.tipo_pago === 'efectivo' ? 'Efectivo' : 'Débito'} · de {mia ? 'ti' : nombreDe(c.titular_id)}</Text>
                </View>
                <Text style={[estilos.monto, c.saldo < 0 && { color: colores.peligro }]}>{formatoMXN(c.saldo)}</Text>
              </View>
              {(e?.apartado_en_cuenta ?? 0) > 0 ? (
                <>
                  <View style={{ height: 6 }} />
                  <BarraProgreso proporcion={c.saldo > 0 ? (e?.apartado_en_cuenta ?? 0) / c.saldo : 2} color={colores.alerta} />
                  <Text style={estilos.suave}>
                    Libre {formatoMXN(e?.libre ?? c.saldo)} · Asignado {formatoMXN(e?.apartado_en_cuenta ?? 0)}
                  </Text>
                </>
              ) : null}
              {mia ? (
                <View style={estilos.botones}>
                  <Boton chico variante="secundario" titulo="Editar saldo" onPress={() => setSaldo(c)} />
                  <Boton chico variante="secundario" titulo="Transferir" onPress={() => setTransf({ visible: true, desde: c.id })} />
                  {c.tipo_pago === 'debito' ? <Boton chico variante="texto" titulo="Editar" onPress={() => setTarjetaForm({ visible: true, tarjeta: c })} /> : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </Caja>

      <Caja titulo="Tarjetas de crédito">
        <View style={estilos.agregar}>
          <Boton chico variante="texto" titulo="+ Agregar crédito" onPress={() => nueva('credito')} />
        </View>
        {creditos.length === 0 ? <Text style={estilos.suave}>Aún no hay tarjetas de crédito.</Text> : null}
        {creditos.map((c, i) => {
          const e = est(c.id);
          const mia = c.titular_id === perfil?.id;
          const usado = e?.usado ?? 0;
          const cuentaPago = tarjetas.find((x) => x.id === c.cuenta_pago_id);
          const dias = e?.fecha_limite_pago ? diasEntre(hoy, e.fecha_limite_pago) : null;
          return (
            <View key={c.id} style={[estilos.cuenta, i > 0 && estilos.separador]}>
              <View style={estilos.filaDos}>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.nombre}>{c.nombre}</Text>
                  <Text style={estilos.suave}>
                    Crédito · de {mia ? 'ti' : nombreDe(c.titular_id)} · corte día {c.dia_corte} · pago día {c.dia_pago}
                  </Text>
                </View>
              </View>

              {c.limite_credito !== null ? (
                <>
                  <View style={{ height: 8 }} />
                  <BarraProgreso proporcion={c.limite_credito > 0 ? usado / c.limite_credito : 0} color={colores.primario} />
                  <View style={estilos.filaDos}>
                    <Text style={estilos.suave}>Usado {formatoMXN(usado)}</Text>
                    <Text style={[estilos.texto, estilos.negrita, (e?.disponible_credito ?? 0) < 0 && { color: colores.peligro }]}>
                      Disponible {formatoMXN(e?.disponible_credito ?? c.limite_credito)}
                    </Text>
                  </View>
                  <Text style={estilos.suave}>Límite {formatoMXN(c.limite_credito)}</Text>
                </>
              ) : (
                <Text style={[estilos.suave, { marginTop: 6 }]}>Deuda actual {formatoMXN(usado)} · sin límite definido</Text>
              )}

              <View style={estilos.caja}>
                <View style={estilos.filaDos}>
                  <Text style={estilos.texto}>Por pagar ya facturado</Text>
                  <Text style={[estilos.texto, estilos.negrita]}>{formatoMXN(e?.a_pagar ?? 0)}</Text>
                </View>
                {e?.fecha_limite_pago ? (
                  <Text style={[estilos.suave, dias !== null && dias <= 2 && { color: colores.peligro }]}>
                    Pagar antes del {fechaCorta(e.fecha_limite_pago)}
                    {dias !== null ? (dias < 0 ? ` (venció hace ${-dias} d)` : dias === 0 ? ' (hoy)' : ` (en ${dias} d)`) : ''}
                  </Text>
                ) : null}
                <View style={estilos.filaDos}>
                  <Text style={estilos.texto}>Apartado (incluye próximo corte)</Text>
                  <Text style={[estilos.texto, estilos.negrita]}>{formatoMXN(e?.apartado ?? 0)}</Text>
                </View>
                {e?.prox_corte ? <Text style={estilos.suave}>Próximo corte {fechaCorta(e.prox_corte)}{e.prox_pago ? ` · pago ${fechaCorta(e.prox_pago)}` : ''}</Text> : null}
                <Text style={estilos.suave}>
                  {cuentaPago ? `Se paga con ${cuentaPago.nombre}` : 'Sin cuenta asignada para pagarla (edítala para apartar dinero)'}
                </Text>
              </View>

              <View style={estilos.botones}>
                <Boton chico titulo="Ya pagué" onPress={() => setPagar(c)} />
                {mia ? <Boton chico variante="secundario" titulo="Editar" onPress={() => setTarjetaForm({ visible: true, tarjeta: c })} /> : null}
              </View>
            </View>
          );
        })}
      </Caja>

      <SaldoModal cuenta={saldo} onCerrar={() => setSaldo(null)} />
      <PagarModal tarjeta={pagar} onCerrar={() => setPagar(null)} />
      <TarjetaModal visible={tarjetaForm.visible} tarjeta={tarjetaForm.tarjeta} tipoInicial={tarjetaForm.tipo} onCerrar={() => setTarjetaForm({ visible: false, tarjeta: null })} />
      <TransferirModal visible={transf.visible} desdeId={transf.desde} onCerrar={() => setTransf({ visible: false, desde: null })} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  grande: { fontSize: 34, fontWeight: '800', color: colores.texto, marginBottom: 8 },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  texto: { fontSize: 14, color: colores.texto },
  negrita: { fontWeight: '700' },
  suave: { fontSize: 12, color: colores.suave },
  personas: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colores.borde },
  filaDos: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  cuenta: { paddingVertical: 4 },
  separador: { borderTopWidth: 1, borderTopColor: colores.borde, marginTop: 12, paddingTop: 14 },
  nombre: { fontSize: 16, fontWeight: '700', color: colores.texto },
  monto: { fontSize: 18, fontWeight: '800', color: colores.texto },
  botones: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  caja: { backgroundColor: colores.fondo, borderRadius: 12, padding: 10, marginTop: 10 },
  agregar: { alignItems: 'flex-end', marginBottom: 4 },
});
