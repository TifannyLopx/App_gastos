import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDatos } from '../context/DatosContext';
import { Caja } from './Tarjeta';
import { BarraProgreso } from './BarraProgreso';
import { colores } from '../theme';
import { formatoMXN } from '../utils/dinero';

// Pantalla principal: límite general de la familia y límite de cada persona.
// Todos los números ya vienen calculados del servidor (ver_resumen).
export function ResumenLimites() {
  const { resumen } = useDatos();

  if (resumen.length === 0) {
    return (
      <Caja titulo="Límite del mes">
        <Text style={estilos.suave}>Todavía no hay datos de este mes.</Text>
      </Caja>
    );
  }

  const limiteTotal = resumen.reduce((s, r) => s + r.limite, 0);
  const gastadoTotal = resumen.reduce((s, r) => s + r.gastado, 0);
  const disponibleFamilia = resumen[0].disponible_familia;
  const sinAportaciones = limiteTotal === 0;

  return (
    <>
      <Caja titulo="Límite mensual general">
        <Text style={[estilos.grande, disponibleFamilia < 0 && { color: colores.peligro }]}>
          {formatoMXN(disponibleFamilia)}
        </Text>
        <Text style={estilos.suave}>disponible de {formatoMXN(limiteTotal)}</Text>
        <View style={{ height: 10 }} />
        <BarraProgreso proporcion={limiteTotal > 0 ? gastadoTotal / limiteTotal : 0} />
        <Text style={[estilos.suave, { marginTop: 6 }]}>Gastado: {formatoMXN(gastadoTotal)}</Text>
        {sinAportaciones ? (
          <Text style={estilos.aviso}>Aún no hay aportaciones este mes. Defínelas en Ajustes → Límite del mes.</Text>
        ) : null}
      </Caja>

      <Caja titulo="Límite de cada quien">
        {resumen.map((r, i) => (
          <View key={r.usuario_id} style={[estilos.persona, i > 0 && estilos.separador]}>
            <View style={estilos.filaNombre}>
              <Text style={estilos.nombre}>{r.nombre}</Text>
              <Text style={[estilos.monto, r.disponible < 0 && { color: colores.peligro }]}>{formatoMXN(r.disponible)}</Text>
            </View>
            <BarraProgreso proporcion={r.limite > 0 ? r.gastado / r.limite : r.gastado > 0 ? 2 : 0} />
            <Text style={estilos.suave}>
              Gastado {formatoMXN(r.gastado)} de {formatoMXN(r.limite)}
              {r.arrastre !== 0 ? `  ·  arrastre ${formatoMXN(r.arrastre)}` : ''}
            </Text>
            {r.disponible_real < r.disponible ? (
              <Text style={estilos.aviso}>Por el tope familiar solo puedes gastar {formatoMXN(r.disponible_real)}.</Text>
            ) : null}
            {r.sin_limite ? <Text style={estilos.alerta}>⚠ Ya no tiene límite disponible este mes</Text> : null}
          </View>
        ))}
      </Caja>
    </>
  );
}

const estilos = StyleSheet.create({
  grande: { fontSize: 32, fontWeight: '800', color: colores.texto },
  suave: { fontSize: 13, color: colores.suave },
  aviso: { fontSize: 12, color: colores.alerta, marginTop: 6 },
  alerta: { fontSize: 13, color: colores.peligro, fontWeight: '600', marginTop: 6 },
  persona: { paddingVertical: 4 },
  separador: { borderTopWidth: 1, borderTopColor: colores.borde, marginTop: 10, paddingTop: 12 },
  filaNombre: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  nombre: { fontSize: 16, fontWeight: '600', color: colores.texto },
  monto: { fontSize: 16, fontWeight: '700', color: colores.texto },
});
