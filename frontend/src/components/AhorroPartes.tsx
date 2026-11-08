import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Hoja } from './Hoja';
import { Campo } from './Campo';
import { Chips } from './Chips';
import { Boton } from './Boton';
import { Mensaje } from './Mensaje';
import { Caja } from './Tarjeta';
import { useDatos } from '../context/DatosContext';
import { guardarReparto } from '../services/cierresService';
import { borrarMeta, borrarMovimientoMeta, editarMeta, moverMeta, verMovimientosMeta } from '../services/metasService';
import { formatoMXN, leerMonto, redondear } from '../utils/dinero';
import { aFecha, fechaCorta, nombreMes } from '../utils/fechas';
import { colores } from '../theme';
import type { ItemReparto, Meta, MovimientoMeta } from '../types';

// ---------- repartir el sobrante del mes pasado ----------
export function RepartoMes() {
  const { cierres, repartos, resumenPasado, metas, perfil, mesPasado, refrescar } = useDatos();
  const miCierre = cierres.find((c) => c.usuario_id === perfil?.id && c.mes === mesPasado);
  const miResumen = resumenPasado.find((r) => r.usuario_id === perfil?.id);
  // si el mes aún no se cierra, el sobrante es lo que quedó disponible
  const sobrante = redondear(miCierre ? miCierre.sobrante : Math.max(0, miResumen?.disponible ?? 0));

  const [ahorro, setAhorro] = useState('');
  const [porMeta, setPorMeta] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // se llena con el reparto que ya estaba guardado
  useEffect(() => {
    const mios = repartos.filter((r) => miCierre && r.cierre_id === miCierre.id);
    const a = mios.filter((r) => r.tipo === 'ahorro').reduce((s, r) => s + r.monto, 0);
    setAhorro(a > 0 ? String(a) : '');
    const m: Record<number, string> = {};
    mios.filter((r) => r.tipo === 'meta' && r.meta_id).forEach((r) => { m[r.meta_id as number] = String((Number(m[r.meta_id as number] ?? 0)) + r.monto); });
    setPorMeta(m);
  }, [repartos, miCierre?.id]); // eslint-disable-line

  const asignado = useMemo(
    () => (leerMonto(ahorro) ?? 0) + Object.values(porMeta).reduce((s, t) => s + (leerMonto(t) ?? 0), 0),
    [ahorro, porMeta],
  );
  const alSiguiente = redondear(sobrante - asignado);

  if (sobrante <= 0) {
    return (
      <Caja titulo={`Sobrante de ${nombreMes(mesPasado)}`}>
        <Text style={estilos.suave}>No sobró dinero el mes pasado, así que no hay nada que repartir.</Text>
      </Caja>
    );
  }

  const guardar = async () => {
    setError(null); setOk(null);
    if (alSiguiente < 0) return setError(`Repartiste ${formatoMXN(asignado)} pero solo sobraron ${formatoMXN(sobrante)}.`);
    const items: ItemReparto[] = [];
    const a = leerMonto(ahorro) ?? 0;
    if (a > 0) items.push({ tipo: 'ahorro', monto: a });
    Object.entries(porMeta).forEach(([id, t]) => {
      const v = leerMonto(t) ?? 0;
      if (v > 0) items.push({ tipo: 'meta', meta_id: Number(id), monto: v });
    });
    setCargando(true);
    try {
      await guardarReparto(aFecha(mesPasado), items);
      await refrescar();
      setOk('Reparto guardado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Caja titulo={`Sobrante de ${nombreMes(mesPasado)}`}>
      <Text style={estilos.grande}>{formatoMXN(sobrante)}</Text>
      <Text style={[estilos.suave, { marginBottom: 12 }]}>Elige cuánto va a cada lugar. Lo que no repartas se suma al límite de este mes.</Text>

      <Campo etiqueta="A ahorro libre" placeholder="0.00" keyboardType="decimal-pad" value={ahorro} onChangeText={setAhorro} />
      {metas.map((m) => (
        <Campo
          key={m.id}
          etiqueta={`A la meta "${m.nombre}"`}
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={porMeta[m.id] ?? ''}
          onChangeText={(t) => setPorMeta({ ...porMeta, [m.id]: t })}
        />
      ))}

      <View style={[estilos.resto, alSiguiente < 0 && { backgroundColor: colores.peligroSuave }]}>
        <Text style={estilos.texto}>Al mes siguiente (límite de este mes)</Text>
        <Text style={[estilos.texto, estilos.negrita, alSiguiente < 0 && { color: colores.peligro }]}>{formatoMXN(alSiguiente)}</Text>
      </View>

      <Mensaje texto={error} />
      <Mensaje texto={ok} tipo="info" />
      <Boton titulo="Guardar reparto" onPress={guardar} cargando={cargando} />
      <Text style={[estilos.suave, { marginTop: 8 }]}>Solo se puede cambiar el reparto del mes pasado.</Text>
    </Caja>
  );
}

// ---------- meter o sacar dinero de una meta ----------
export function MoverMetaModal({ meta, modo, onCerrar }: { meta: Meta | null; modo: 'meter' | 'sacar'; onCerrar: () => void }) {
  const { refrescar, ahorro, perfil } = useDatos();
  const libre = ahorro.find((a) => a.usuario_id === perfil?.id)?.ahorro ?? 0;
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [desdeAhorro, setDesdeAhorro] = useState<'si' | 'no'>('si');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (meta) { setMonto(''); setNota(''); setDesdeAhorro('si'); setError(null); } }, [meta]);

  const guardar = async () => {
    const v = leerMonto(monto);
    if (!meta) return;
    if (v === null || v <= 0) return setError('Escribe un monto mayor a 0.');
    setCargando(true); setError(null);
    try {
      await moverMeta(meta.id, modo === 'meter' ? v : -v, desdeAhorro === 'si', nota.trim() || undefined);
      await refrescar();
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Hoja visible={!!meta} titulo={`${modo === 'meter' ? 'Agregar a' : 'Sacar de'} ${meta?.nombre ?? ''}`} onCerrar={onCerrar}>
      <Text style={estilos.suave}>Lleva {formatoMXN(meta?.ahorrado ?? 0)} de {formatoMXN(meta?.objetivo ?? 0)}</Text>
      <View style={{ height: 10 }} />
      <Campo etiqueta="Monto" placeholder="0.00" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} />
      <Chips
        etiqueta={modo === 'meter' ? `¿De dónde sale? (tu ahorro libre: ${formatoMXN(libre)})` : '¿A dónde va el dinero que sacas?'}
        valor={desdeAhorro}
        onCambio={setDesdeAhorro}
        opciones={[
          { id: 'si', etiqueta: modo === 'meter' ? 'De mi ahorro libre' : 'Regresa a mi ahorro libre' },
          { id: 'no', etiqueta: modo === 'meter' ? 'De otro lado (no toca mi ahorro)' : 'Lo gasté / sale de la app' },
        ]}
      />
      <Campo etiqueta="Nota (opcional)" placeholder="Aguinaldo, regalo..." value={nota} onChangeText={setNota} />
      <Mensaje texto={error} />
      <Boton titulo={modo === 'meter' ? 'Agregar dinero' : 'Sacar dinero'} onPress={guardar} cargando={cargando} />
    </Hoja>
  );
}

// ---------- editar una meta (nombre, objetivo, movimientos) o borrarla ----------
export function EditarMetaModal({ meta, onCerrar }: { meta: Meta | null; onCerrar: () => void }) {
  const { refrescar, nombreDe, perfil } = useDatos();
  const [nombre, setNombre] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [movs, setMovs] = useState<MovimientoMeta[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarMovs = (m: Meta) =>
    verMovimientosMeta({ filtros: [{ campo: 'meta_id', op: 'eq', valor: m.id }], orden: { campo: 'id', asc: false }, limite: 8 })
      .then((r) => setMovs((r as MovimientoMeta[]).map((x) => ({ ...x, monto: Number(x.monto) }))))
      .catch(() => setMovs([]));

  useEffect(() => {
    if (!meta) return;
    setNombre(meta.nombre); setObjetivo(String(meta.objetivo)); setError(null);
    cargarMovs(meta);
  }, [meta]); // eslint-disable-line

  const guardar = async () => {
    const v = leerMonto(objetivo);
    if (!meta) return;
    if (!nombre.trim()) return setError('Ponle un nombre.');
    if (v === null || v <= 0) return setError('El objetivo debe ser mayor a 0.');
    setCargando(true); setError(null);
    try {
      await editarMeta(meta.id, { nombre: nombre.trim(), objetivo: v });
      await refrescar();
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setCargando(false);
    }
  };

  const borrar = () =>
    Alert.alert('Borrar meta', `¿Borrar "${meta?.nombre}"? El dinero que tenía deja de contar en la app.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => {
        if (!meta) return;
        try { await borrarMeta(meta.id); await refrescar(); onCerrar(); }
        catch (e) { setError(e instanceof Error ? e.message : 'No se pudo borrar.'); }
      } },
    ]);

  const deshacer = (m: MovimientoMeta) =>
    Alert.alert('Deshacer movimiento', 'Se quita este movimiento de la meta.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Deshacer', style: 'destructive', onPress: async () => {
        try { await borrarMovimientoMeta(m.id); await refrescar(); if (meta) cargarMovs(meta); }
        catch (e) { setError(e instanceof Error ? e.message : 'No se pudo deshacer.'); }
      } },
    ]);

  return (
    <Hoja visible={!!meta} titulo="Editar meta" onCerrar={onCerrar}>
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} />
      <Campo etiqueta="Objetivo" keyboardType="decimal-pad" value={objetivo} onChangeText={setObjetivo} />
      <Mensaje texto={error} />
      <Boton titulo="Guardar cambios" onPress={guardar} cargando={cargando} />

      {movs.length > 0 ? (
        <View style={{ marginTop: 18 }}>
          <Text style={estilos.subtitulo}>Últimos movimientos</Text>
          {movs.map((m) => (
            <View key={m.id} style={estilos.mov}>
              <View style={{ flex: 1 }}>
                <Text style={[estilos.texto, { color: m.monto > 0 ? colores.ok : colores.peligro }]}>
                  {m.monto > 0 ? '+' : ''}{formatoMXN(m.monto)}
                </Text>
                <Text style={estilos.suave}>{fechaCorta(m.creada_el.slice(0, 10))} · {nombreDe(m.usuario_id)}{m.nota ? ` · ${m.nota}` : ''}</Text>
              </View>
              {m.usuario_id === perfil?.id ? <Boton chico variante="texto" titulo="Deshacer" onPress={() => deshacer(m)} /> : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: 18 }}>
        <Boton variante="peligro" titulo="Borrar meta" onPress={borrar} deshabilitado={cargando} />
      </View>
    </Hoja>
  );
}

const estilos = StyleSheet.create({
  grande: { fontSize: 30, fontWeight: '800', color: colores.texto, marginBottom: 4 },
  suave: { fontSize: 12, color: colores.suave },
  texto: { fontSize: 14, color: colores.texto },
  negrita: { fontWeight: '800' },
  subtitulo: { fontSize: 14, fontWeight: '700', color: colores.texto, marginBottom: 6 },
  resto: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colores.primarioSuave, padding: 12, borderRadius: 12, marginBottom: 12 },
  mov: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
});
