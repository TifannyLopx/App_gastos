-- función interna que sereutiliza al salir y expulsar de las familias
create or replace function mover_a_familia_personal(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  familia_vieja bigint;
  familia_nueva bigint;
  nombre_usuario text;
begin
  -- guarda su familia actual y su nombre
  select familia_id, nombre into familia_vieja, nombre_usuario
  from usuarios where id = uid;

  -- si era el único admin, el miembro más antiguo se vuelve admin
  if not exists (
    select 1 from usuarios
    where familia_id = familia_vieja and rol = 'admin' and id <> uid
  ) then
    update usuarios set rol = 'admin'
    where id = (
      select id from usuarios
      where familia_id = familia_vieja and id <> uid
      order by creada_el
      limit 1
    );
  end if;

  -- le crea su familia personal
  insert into familias (nombre) values ('Familia de ' || nombre_usuario)
  returning id into familia_nueva;

  update usuarios set familia_id = familia_nueva, rol = 'admin' where id = uid;

  -- sus tarjetas se van con él, gastos y límites se quedan como historial
  update tarjetas set familia_id = familia_nueva where titular_id = uid;
end;
$$;

-- nadie la puede llamar directo desde la app, es comom un trigger sin serlo realmente
revoke execute on function mover_a_familia_personal(uuid) from public, anon, authenticated;


-- UNIRSE con código
create or replace function unirse_familia(codigo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  familia_destino bigint;
  familia_vieja bigint := mi_familia();
begin
  -- busca la familia del código, sin importar mayúsculas ni espacios
  select id into familia_destino from familias
  where codigo_invitacion = upper(trim(codigo));

  if familia_destino is null then
    raise exception 'Código no válido';
  end if;
  if familia_destino = familia_vieja then
    raise exception 'Ya estás en esa familia';
  end if;
  if (select count(*) from usuarios where familia_id = familia_vieja) > 1 then
    raise exception 'Primero sal de tu familia actual';
  end if;

  -- muda todo lo suyo a la familia nueva
  update usuarios set familia_id = familia_destino, rol = 'miembro' where id = auth.uid();
  update tarjetas set familia_id = familia_destino where familia_id = familia_vieja;
  update gastos   set familia_id = familia_destino where familia_id = familia_vieja;
  update limites  set familia_id = familia_destino where familia_id = familia_vieja;
  update cierres  set familia_id = familia_destino where familia_id = familia_vieja;

  -- su familia personal quedó vacía, se borra por q ni modo de dejarla ahí
  delete from familias where id = familia_vieja;
end;
$$;


-- SALIR de la familia
create or replace function salir_familia()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from usuarios where familia_id = mi_familia()) = 1 then
    raise exception 'Ya estás en tu familia personal';
  end if;

  perform mover_a_familia_personal(auth.uid());
end;
$$;


-- EXPULSAR a un miembro, solo admin puede hacerlo
create or replace function expulsar_miembro(miembro uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not soy_admin() then
    raise exception 'Solo el admin puede expulsar';
  end if;
  if miembro = auth.uid() then
    raise exception 'Para salirte usa salir_familia';
  end if;
  if not exists (select 1 from usuarios where id = miembro and familia_id = mi_familia()) then
    raise exception 'Ese usuario no está en tu familia';
  end if;

  perform mover_a_familia_personal(miembro);
end;
$$;


-- CAMBIAR el código de invitación, solo admin puede hacelo
create or replace function regenerar_codigo()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo text;
begin
  if not soy_admin() then
    raise exception 'Solo el admin puede cambiar el código';
  end if;

  update familias
  set codigo_invitacion = upper(substr(md5(random()::text), 1, 6))
  where id = mi_familia()
  returning codigo_invitacion into nuevo;

  return nuevo;
end;
$$;