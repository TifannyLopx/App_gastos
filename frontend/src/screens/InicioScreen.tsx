import React from 'react';
import { Pantalla } from './Pantalla';
import { useDatos } from '../context/DatosContext';
import { ResumenLimites } from '../components/ResumenLimites';
import { AlertasPagos } from '../components/AlertasPagos';
import { PresupuestoCategorias } from '../components/PresupuestoCategorias';
import { FormularioGasto } from '../components/FormularioGasto';
import { nombreMes } from '../utils/fechas';

// Pantalla principal: límites, pagos por vencer, a dónde va el dinero, y el formulario para registrar gastos.
export function InicioScreen() {
  const { perfil, mes } = useDatos();
  return (
    <Pantalla titulo={`Hola${perfil ? `, ${perfil.nombre}` : ''}`} subtitulo={nombreMes(mes)}>
      <ResumenLimites />
      <AlertasPagos />
      <PresupuestoCategorias />
      <FormularioGasto />
    </Pantalla>
  );
}
