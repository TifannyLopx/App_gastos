-- regresa la familia del usuario que tiene la inición seciada
create or replace function mi_familia()
returns bigint
language sql
stable
security definer 
set search_path = public
as $$
  select familia_id from usuarios where id = auth.uid()
$$;

-- regresa true si el usuario logueado es admin de su family
create or replace function soy_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from usuarios where id = auth.uid() and rol = 'admin')
$$;