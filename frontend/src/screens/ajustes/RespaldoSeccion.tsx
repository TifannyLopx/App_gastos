import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useDatos } from '../../context/DatosContext';
import { Caja } from '../../components/Tarjeta';
import { Chips } from '../../components/Chips';
import { Boton } from '../../components/Boton';
import { Mensaje } from '../../components/Mensaje';
import { borrarMesesRespaldados, registrarRespaldo, verRespaldos } from '../../services/respaldoService';
import { contarArchivo, guardarEnArchivo } from '../../services/archivoLocal';
import { compartirArchivo, gastosACsv } from '../../services/exportar';
import { formaPagoDe, NOMBRE_FORMA_PAGO, terminoAntesDe } from '../../utils/cargos';
import { fechaLarga, nombreMes, sumarMeses } from '../../utils/fechas';
import { colores } from '../../theme';
import type { Respaldo } from '../../types';

const MESES_CONSERVAR = [2, 3, 6, 12];

// Respaldo y archivo: guarda los meses viejos en ESTE teléfono, y después los borra de Supabase
// para liberar espacio. Las gráficas y el historial siguen mostrándolos desde el archivo local.
export function RespaldoSeccion() {
  const { gastosNube, gastos, tarjetas, nombreDe, miembros, perfil, mes, refrescar } = useDatos();
  const [conservar, setConservar] = useState(3);
  const [respaldos, setRespaldos] = useState<Respaldo[]>([]);
  const [enArchivo, setEnArchivo] = useState(0);
  const [trabajando, setTrabajando] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // se conservan este mes y los N-1 anteriores; lo anterior se puede archivar
  const corte = sumarMeses(mes, -(conservar - 1));
  const candidatos = useMemo(
    () => gastosNube.filter((g) => g.fecha_compra < corte && terminoAntesDe(g, corte)),
    [gastosNube, corte],
  );

  const cargar = useCallback(async () => {
    try { setRespaldos((await verRespaldos()) as Respaldo[]); } catch { setRespaldos([]); }
    try { setEnArchivo(await contarArchivo()); } catch { setEnArchivo(0); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const hastaDe = (uid: string) => respaldos.find((r) => r.usuario_id === uid)?.hasta;
  const nombres = {
    usuario: (g: { usuario_id: string | null; archivado?: { usuario: string } }) => g.archivado?.usuario ?? nombreDe(g.usuario_id),
    tarjeta: (g: { tarjeta_id: number | null; archivado?: { tarjeta: string | null } }) =>
      g.archivado ? g.archivado.tarjeta ?? 'Efectivo' : tarjetas.find((t) => t.id === g.tarjeta_id)?.nombre ?? 'Efectivo',
  };

  const ejecutar = async (accion: () => Promise<string>) => {
    setError(null); setInfo(null); setTrabajando(true);
    try { setInfo(await accion()); await cargar(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar.'); }
    finally { setTrabajando(false); }
  };

  const exportar = () => ejecutar(async () => {
    const csv = gastosACsv(gastos, {
      usuario: nombres.usuario, tarjeta: nombres.tarjeta,
      forma: (g) => NOMBRE_FORMA_PAGO[formaPagoDe(g, tarjetas)],
    });
    await compartirArchivo(`gastos-${mes.slice(0, 7)}.csv`, csv, 'text/csv');
    return `Exportados ${gastos.length} gastos (nube + archivo local).`;
  });

  const guardarCopia = () => ejecutar(async () => {
    if (candidatos.length === 0) return 'No hay gastos viejos terminados que archivar con esos meses.';
    await guardarEnArchivo(candidatos, {
      usuario: (id) => nombreDe(id),
      tarjeta: (id) => tarjetas.find((t) => t.id === id)?.nombre ?? null,
      forma: (g) => formaPagoDe(g, tarjetas),
    });
    await registrarRespaldo(corte);
    return `Copia guardada en este teléfono: ${candidatos.length} gastos. Ya avisamos que tu copia está al día hasta ${nombreMes(corte)}.`;
  });

  const borrar = () =>
    Alert.alert(
      'Borrar de la nube',
      `Se borrarán de Supabase los ${candidatos.length} gastos terminados anteriores a ${nombreMes(corte)}. Seguirán en la copia local de cada teléfono que la haya guardado. No se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: () => ejecutar(async () => {
          const r = await borrarMesesRespaldados(corte);
          await refrescar();
          return `Borrados ${r.gastos} gastos y ${r.pagos} pagos antiguos de la nube.`;
        }) },
      ],
    );

  const kb = Math.round((gastosNube.length * 0.5) * 10) / 10;

  return (
    <Caja titulo="Respaldo y archivo">
      <Text style={estilos.suave}>
        Supabase (plan gratis) da 500 MB de base de datos. Cada gasto pesa menos de 1 KB, así que ustedes ocupan aprox. {kb} KB
        con {gastosNube.length} gastos: hay espacio para muchos años. Aun así puedes archivar los meses viejos en tu teléfono y borrarlos de la nube.
      </Text>

      <View style={{ height: 14 }} />
      <Chips
        etiqueta="Conservar en la nube los últimos (meses)"
        valor={conservar}
        onCambio={setConservar}
        opciones={MESES_CONSERVAR.map((m) => ({ id: m, etiqueta: `${m}` }))}
      />
      <Text style={estilos.texto}>
        Archivables: <Text style={estilos.negrita}>{candidatos.length}</Text> gastos anteriores a {nombreMes(corte)} (los MSI que siguen cobrando se quedan).
      </Text>
      <Text style={estilos.suave}>En el archivo de este teléfono: {enArchivo} gastos.</Text>

      <View style={estilos.estado}>
        <Text style={estilos.subtitulo}>Copias locales de la familia</Text>
        {miembros.map((m) => (
          <Text key={m.id} style={estilos.suave}>
            {m.id === perfil?.id ? 'Tú' : m.nombre}: {hastaDe(m.id) ? `al día hasta ${fechaLarga(hastaDe(m.id) as string)}` : 'sin copia guardada'}
          </Text>
        ))}
        <Text style={[estilos.suave, { marginTop: 4 }]}>
          Para borrar de la nube, TODOS deben guardar su copia (cada quien en su teléfono) hasta el mismo corte.
        </Text>
      </View>

      <Mensaje texto={error} />
      <Mensaje texto={info} tipo="info" />
      <View style={{ gap: 8 }}>
        <Boton variante="secundario" titulo="1. Guardar copia en este teléfono" onPress={guardarCopia} cargando={trabajando} />
        <Boton variante="secundario" titulo="Exportar todo a CSV (Excel)" onPress={exportar} deshabilitado={trabajando} />
        <Boton variante="peligro" titulo="2. Borrar de la nube lo ya respaldado" onPress={borrar} deshabilitado={trabajando || candidatos.length === 0} />
      </View>
    </Caja>
  );
}

const estilos = StyleSheet.create({
  suave: { fontSize: 12, color: colores.suave },
  texto: { fontSize: 14, color: colores.texto, marginBottom: 2 },
  negrita: { fontWeight: '800' },
  subtitulo: { fontSize: 13, fontWeight: '700', color: colores.texto, marginBottom: 4 },
  estado: { backgroundColor: colores.fondo, borderRadius: 12, padding: 12, marginVertical: 12 },
});
