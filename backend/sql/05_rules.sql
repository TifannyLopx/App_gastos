-- prende RLS mas factible que una llave publica
alter table familias enable row level security;
alter table usuarios enable row level security;
alter table tarjetas enable row level security;
alter table gastos   enable row level security;
alter table limites  enable row level security;
alter table cierres  enable row level security;


-- TABLASh

-- FAMILIAS
create policy "ver mi familia" on familias for select to authenticated
  using (id = mi_familia());
create policy "admin edita familia" on familias for update to authenticated
  using (id = mi_familia() and soy_admin());

-- USUARIOS
create policy "ver miembros de mi familia" on usuarios for select to authenticated
  using (familia_id = mi_familia());
create policy "editar mi perfil" on usuarios for update to authenticated
  using (id = auth.uid());

-- solo se pueden editar nombre y salario
revoke update on usuarios from authenticated;
grant update (nombre, salario) on usuarios to authenticated;

-- TARJETAS: las ve toda la familia, solo el titular las agrega, edita o borra
create policy "ver tarjetas de mi familia" on tarjetas for select to authenticated
  using (familia_id = mi_familia());
create policy "agregar mi tarjeta" on tarjetas for insert to authenticated
  with check (familia_id = mi_familia() and titular_id = auth.uid());
create policy "editar mi tarjeta" on tarjetas for update to authenticated
  using (titular_id = auth.uid())
  with check (familia_id = mi_familia() and titular_id = auth.uid());
create policy "borrar mi tarjeta" on tarjetas for delete to authenticated
  using (titular_id = auth.uid());

-- GASTOS: los ve toda la familia, cada quien edita o borra los que registró
create policy "ver gastos de mi familia" on gastos for select to authenticated
  using (familia_id = mi_familia());
create policy "registrar gasto" on gastos for insert to authenticated
  with check (
    familia_id = mi_familia()
    and usuario_id = auth.uid()
    -- la tarjeta tiene que ser de la familia, o null si es efectivo
    and (tarjeta_id is null or exists (
      select 1 from tarjetas t where t.id = tarjeta_id and t.familia_id = mi_familia()
    ))
  );
create policy "editar mi gasto" on gastos for update to authenticated
  using (usuario_id = auth.uid())
  with check (
    familia_id = mi_familia()
    and usuario_id = auth.uid()
    and (tarjeta_id is null or exists (
      select 1 from tarjetas t where t.id = tarjeta_id and t.familia_id = mi_familia()
    ))
  );
create policy "borrar mi gasto" on gastos for delete to authenticated
  using (usuario_id = auth.uid());

-- LIMITES: los ve toda la familia, cada quien pone su aportación
create policy "ver limites de mi familia" on limites for select to authenticated
  using (familia_id = mi_familia());
create policy "poner mi aportacion" on limites for insert to authenticated
  with check (familia_id = mi_familia() and usuario_id = auth.uid());
create policy "editar mi aportacion" on limites for update to authenticated
  using (usuario_id = auth.uid())
  with check (familia_id = mi_familia() and usuario_id = auth.uid());

-- CIERRES: solo se ven, los crea la función de cerrar mes
create policy "ver cierres de mi familia" on cierres for select to authenticated
  using (familia_id = mi_familia());