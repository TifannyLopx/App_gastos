-- después de borrar un usuario, acomoda su familia
create or replace function limpiar_familia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- si la familia ta vacía, se borra
  if not exists (select 1 from usuarios where familia_id = old.familia_id) then
    delete from familias where id = old.familia_id;

  -- si quedó sin admin, el más antiguo se vuelve admin
  elsif not exists (select 1 from usuarios where familia_id = old.familia_id and rol = 'admin') then
    update usuarios set rol = 'admin'
    where id = (
      select id from usuarios
      where familia_id = old.familia_id
      order by creada_el
      limit 1
    );
  end if;

  return old;
end;
$$;

create trigger al_borrar_usuario
after delete on usuarios
for each row execute function limpiar_familia();