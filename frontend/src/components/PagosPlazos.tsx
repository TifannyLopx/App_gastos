import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDatos } from '../context/DatosContext';
import { Caja } from './Tarjeta';
import { Boton } from './Boton';
import { BarraProgreso } from './BarraProgreso';
import { AbonarModal, PlazoModal } from './ModalesPlazos';
import { formatoMXN } from '../utils/dinero';
import { fechaCorta } from '../utils/fechas';
import { colores } from '../theme';
import type { Deuda, MsiActivo } from '../types';

// pagos a plazos: msi de tarjeta y deudas directas en una sola lista
export function PagosPlazos() {
  const { msi, deudas, tarjetas, perfil, nombreDe } = useDatos();
  const [form, setForm] = useState<{ visible: boolean; msi: MsiActivo | null; deuda: Deuda | null }>({ visible: false, msi: null, deuda: null });
  const [abonar, setAbonar] = useState<Deuda | null>(null);

  const tarjetaDe = (id: number) => tarjetas.find((t) => t.id === id);
  const activas = deudas.filter((d) => d.falta > 0);   // las ya pagadas no se muestran

  return (
    <Caja titulo="Pagos a plazos">
      <View style={estilos.agregar}>
        <Boton chico variante="texto" titulo="+ Agregar" onPress={() => setForm({ visible: true, msi: null, deuda: null })} />
      </View>
      {msi.length === 0 && activas.length === 0 ? (
        <Text style={estilos.suave}>Aquí van tus MSI y lo que pagas en abonos, como una moto o un préstamo</Text>
      ) : null}

      {/* msi: los anteriores se editan aquí, los de la app desde Historial */}
      {msi.map((m, i) => {
        const t = tarjetaDe(m.tarjeta_id);
        const editable = m.origen === 'anterior' && t?.titular_id === perfil?.id;
        const avance = m.de_meses ? `van ${m.de_meses - m.quedan} de ${m.de_meses}` : `quedan ${m.quedan}`;
        return (
          <Pressable
            key={`${m.origen}${m.id}`}
            disabled={!editable}
            onPress={() => setForm({ visible: true, msi: m, deuda: null })}
            style={[estilos.fila, i > 0 && estilos.separador]}
          >
            <View style={estilos.filaDos}>
              <Text style={estilos.nombre}>{m.motivo}</Text>
              <Text style={estilos.monto}>{formatoMXN(m.pendiente)}</Text>
            </View>
            <Text style={estilos.suave}>
              {t?.nombre ?? 'Tarjeta'} · {avance} · {formatoMXN(m.mensualidad)}/mes · termina {fechaCorta(m.termina)}
            </Text>
          </Pressable>
        );
      })}

      {/* deudas directas */}
      {activas.map((d, i) => {
        const mia = d.usuario_id === perfil?.id;
        const llevas = d.total ? (d.total - d.falta) / d.total : null;
        return (
          <View key={`d${d.id}`} style={[estilos.fila, (msi.length > 0 || i > 0) && estilos.separador]}>
            <View style={estilos.filaDos}>
              <Text style={estilos.nombre}>{d.nombre}</Text>
              <Text style={estilos.monto}>{formatoMXN(d.falta)}</Text>
            </View>
            <Text style={estilos.suave}>
              Directo · de {mia ? 'ti' : nombreDe(d.usuario_id)}
              {d.abono ? ` · ${formatoMXN(d.abono)}${d.cada_dias ? ` cada ${d.cada_dias} días` : ''}` : ''}
            </Text>
            {llevas !== null ? (
              <>
                <View style={{ height: 6 }} />
                <BarraProgreso proporcion={llevas} color={colores.ok} />
                <Text style={estilos.suave}>Llevas {Math.round(llevas * 100)}%</Text>
              </>
            ) : null}
            <View style={estilos.botones}>
              <Boton chico titulo="Abonar" onPress={() => setAbonar(d)} />
              {mia ? <Boton chico variante="secundario" titulo="Editar" onPress={() => setForm({ visible: true, msi: null, deuda: d })} /> : null}
            </View>
          </View>
        );
      })}

      <PlazoModal visible={form.visible} msi={form.msi} deuda={form.deuda} onCerrar={() => setForm({ visible: false, msi: null, deuda: null })} />
      <AbonarModal deuda={abonar} onCerrar={() => setAbonar(null)} />
    </Caja>
  );
}

const estilos = StyleSheet.create({
  agregar: { alignItems: 'flex-end', marginBottom: 4 },
  fila: { paddingVertical: 4 },
  separador: { borderTopWidth: 1, borderTopColor: colores.borde, marginTop: 12, paddingTop: 14 },
  filaDos: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  nombre: { fontSize: 16, fontWeight: '700', color: colores.texto, flex: 1 },
  monto: { fontSize: 16, fontWeight: '800', color: colores.texto },
  suave: { fontSize: 12, color: colores.suave },
  botones: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
});