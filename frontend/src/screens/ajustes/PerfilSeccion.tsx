import React, { useEffect, useState } from 'react';
import { useDatos } from '../../context/DatosContext';
import { Caja } from '../../components/Tarjeta';
import { Campo } from '../../components/Campo';
import { Boton } from '../../components/Boton';
import { Mensaje } from '../../components/Mensaje';
import { editarPerfil } from '../../services/usuariosService';
import { leerMonto } from '../../utils/dinero';

export function PerfilSeccion() {
  const { perfil, refrescar } = useDatos();
  const [nombre, setNombre] = useState('');
  const [salario, setSalario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (perfil) {
      setNombre(perfil.nombre);
      setSalario(perfil.salario !== null ? String(perfil.salario) : '');
    }
  }, [perfil]);

  const guardar = async () => {
    setError(null);
    setOk(null);
    if (!perfil) return;
    const s = salario.trim() === '' ? undefined : leerMonto(salario);
    if (!nombre.trim()) return setError('El nombre no puede quedar vacío.');
    if (salario.trim() !== '' && (s === null || (s !== undefined && s < 0))) return setError('Salario inválido.');
    setGuardando(true);
    try {
      await editarPerfil({ nombre: nombre.trim(), ...(s !== undefined && s !== null && { salario: s }) });
      await refrescar();
      setOk('Perfil actualizado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Caja titulo="Mi perfil">
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} autoCapitalize="words" />
      <Campo etiqueta="Salario mensual (opcional)" value={salario} onChangeText={setSalario} keyboardType="decimal-pad" placeholder="0.00" />
      <Mensaje texto={error} />
      <Mensaje texto={ok} tipo="info" />
      <Boton variante="secundario" titulo="Guardar perfil" onPress={guardar} cargando={guardando} />
    </Caja>
  );
}
