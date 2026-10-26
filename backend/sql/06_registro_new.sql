-- cuando alguien se registra le crea su familia personal y su perfil automaticamente
create or replace function crear_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nueva_familia bigint;
  -- toma el nombre que mande la app, si no hay usa lo de antes del @ del correo
  nombre_usuario text := coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1));
begin
  insert into familias (nombre)
  values ('Familia de ' || nombre_usuario)
  returning id into nueva_familia;

  insert into usuarios (id, familia_id, nombre, rol)
  values (new.id, nueva_familia, nombre_usuario, 'admin');

  return new;
end;
$$;

-- se dispara solito cada que se crea una cuenta
create trigger al_registrarse
after insert on auth.users
for each row execute function crear_usuario_nuevo();