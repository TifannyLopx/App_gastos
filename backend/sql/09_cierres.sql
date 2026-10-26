-- cierra el mes de una persona
create or replace function cerrar_mes_de(p_usuario uuid, p_mes date, p_destino text)
returns cierres
language plpgsql
security definer
set search_path = public
as $$
declare
  inicio date := date_trunc('month', p_mes)::date;
  familia bigint;
  r record;
  nuevo cierres;
begin
  if inicio >= date_trunc('month', current_date)::date then
    raise exception 'Solo se pueden cerrar meses que ya terminaron';
  end if;
  if exists (select 1 from cierres where usuario_id = p_usuario and mes = inicio) then
    raise exception 'Ese mes ya está cerrado';
  end if;

  select familia_id into familia from usuarios where id = p_usuario;

  -- toma los números del resumen de ese mes
  select * into r from ver_resumen(inicio, familia) where usuario_id = p_usuario;

  -- si quedó en negativo, el sobrante es 0
  insert into cierres (familia_id, usuario_id, mes, limite, gastado, sobrante, destino)
  values (familia, p_usuario, inicio, r.limite, r.gastado, greatest(r.disponible, 0), p_destino)
  returning * into nuevo;

  return nuevo;
end;
$$;

revoke execute on function cerrar_mes_de(uuid, date, text) from public, anon, authenticated;


-- CERRAR MES desde la app, por defecto el mes pasado // automatico
create or replace function cerrar_mes(
  p_destino text,
  p_mes date default (current_date - interval '1 month')::date
)
returns cierres
language sql
security definer
set search_path = public
as $$
  select * from cerrar_mes_de(auth.uid(), p_mes, p_destino)
$$;


-- EDITAR el destino de lo que sobro el mes pasado
create or replace function editar_cierre(p_mes date, p_destino text)
returns cierres
language plpgsql
security definer
set search_path = public
as $$
declare
  editado cierres;
begin
  -- solo el mes pasado
  if date_trunc('month', p_mes)::date <> (date_trunc('month', current_date) - interval '1 month')::date then
    raise exception 'Solo puedes cambiar el cierre del mes pasado';
  end if;

  update cierres set destino = p_destino
  where usuario_id = auth.uid() and mes = date_trunc('month', p_mes)::date
  returning * into editado;

  if not found then
    raise exception 'No hay cierre de ese mes';
  end if;

  return editado;
end;
$$;


-- VER AHORRO cuánto lleva ahorrado cada quien de la family
create or replace function ver_ahorro()
returns table (usuario_id uuid, nombre text, ahorro numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select u.id, u.nombre, coalesce(sum(c.sobrante), 0)
  from usuarios u
  left join cierres c on c.usuario_id = u.id and c.destino = 'ahorro'
  where u.familia_id = mi_familia()
  group by u.id, u.nombre
$$;