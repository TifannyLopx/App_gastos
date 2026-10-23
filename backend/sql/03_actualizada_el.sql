

-- función que pone la fecha actual cada que se edita una fila, llegará a ser util en los reportes
create or replace function poner_actualizada_el()
returns trigger
language plpgsql
as $$
begin
  new.actualizada_el = now();
  return new;
end;
$$;

-- cada tabla que se puede editar
create trigger familias_actualizada before update on familias for each row execute function poner_actualizada_el();
create trigger usuarios_actualizada before update on usuarios for each row execute function poner_actualizada_el();
create trigger tarjetas_actualizada before update on tarjetas for each row execute function poner_actualizada_el();
create trigger gastos_actualizada before update on gastos for each row execute function poner_actualizada_el();
create trigger limites_actualizada before update on limites for each row execute function poner_actualizada_el();