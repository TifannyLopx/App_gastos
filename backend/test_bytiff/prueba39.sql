/*claude pidio crear las 3 cuentas de prueba antes de iniciar*/

begin;

create schema pruebas;
create function pruebas.como(correo text) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = correo))::text,
    true
  );
end $$;

do $$ begin
  assert (select count(*) from auth.users
          where email in ('ana@prueba.com', 'luis@prueba.com', 'carlos@prueba.com')) = 3,
    'Faltan los usuarios de prueba, créalos en Authentication';
end $$;

select set_config('pruebas.mes_actual', date_trunc('month', current_date)::date::text, true);
select set_config('pruebas.mes_pasado', (date_trunc('month', current_date) - interval '1 month')::date::text, true);

select set_config('pruebas.familia_ana', (
  select u.familia_id::text from usuarios u
  join auth.users a on a.id = u.id where a.email = 'ana@prueba.com'
), true);
select set_config('pruebas.codigo_ana', (
  select codigo_invitacion from familias where id = current_setting('pruebas.familia_ana')::bigint
), true);

select pruebas.como('luis@prueba.com');
set local role authenticated;
select unirse_familia(current_setting('pruebas.codigo_ana'));

reset role;
select pruebas.como('ana@prueba.com');
set local role authenticated;
do $$
declare t bigint;
begin
  insert into tarjetas (nombre, tipo_pago) values ('Visa Ana', 'credito') returning id into t;
  perform set_config('pruebas.tarjeta_ana', t::text, true);
  insert into limites (mes, aportacion) values (current_setting('pruebas.mes_actual')::date, 1000);
  insert into gastos (monto, motivo) values (300, 'efectivo ana');
  insert into gastos (monto, motivo, tarjeta_id) values (1000, 'visa ana', t);
end $$;

reset role;
select pruebas.como('luis@prueba.com');
set local role authenticated;
do $$ begin
  insert into tarjetas (nombre, tipo_pago) values ('Banamex Luis', 'debito');
  insert into limites (mes, aportacion) values (current_setting('pruebas.mes_actual')::date, 3000);
  insert into gastos (monto, motivo, tarjeta_id)
  values (500, 'luis con visa de ana', current_setting('pruebas.tarjeta_ana')::bigint);
end $$;

reset role;
select pruebas.como('carlos@prueba.com');
set local role authenticated;
do $$ begin
  insert into tarjetas (nombre, tipo_pago) values ('Nu Carlos', 'credito');
  insert into gastos (monto, motivo) values (200, 'efectivo carlos');
end $$;



do $$
declare fallo boolean;
begin
  assert (select count(*) from gastos) = 1, 'Carlos ve gastos de otra familia';
  assert (select count(*) from tarjetas) = 1, 'Carlos ve tarjetas de otra familia';
  assert (select count(*) from usuarios) = 1, 'Carlos ve usuarios de otra familia';
  assert (select count(*) from limites) = 0, 'Carlos ve límites de otra familia';

  fallo := false;
  begin
    insert into gastos (monto, motivo, tarjeta_id)
    values (100, 'intruso', current_setting('pruebas.tarjeta_ana')::bigint);
  exception when others then fallo := true;
  end;
  assert fallo, 'Carlos pudo usar la tarjeta de Ana';

  fallo := false;
  begin
    insert into gastos (familia_id, monto, motivo)
    values (current_setting('pruebas.familia_ana')::bigint, 100, 'intruso');
  exception when others then fallo := true;
  end;
  assert fallo, 'Carlos pudo meter un gasto en la familia de Ana';

  
  update tarjetas set nombre = 'hackeada' where id = current_setting('pruebas.tarjeta_ana')::bigint;
  assert not found, 'Carlos pudo editar la tarjeta de Ana';
end $$;


reset role;
select pruebas.como('luis@prueba.com');
set local role authenticated;
do $$
declare fallo boolean;
begin
  assert (select count(*) from gastos) = 3, 'Luis no ve todos los gastos de su familia';
  assert (select count(*) from tarjetas) = 2, 'Luis no ve todas las tarjetas de su familia';
  assert (select count(*) from usuarios) = 2, 'Luis no ve a todos los de su familia';

  update tarjetas set nombre = 'cambiada' where id = current_setting('pruebas.tarjeta_ana')::bigint;
  assert not found, 'Luis pudo editar la tarjeta de Ana';

  delete from gastos where motivo = 'efectivo ana';
  assert not found, 'Luis pudo borrar un gasto de Ana';

  fallo := false;
  begin
    update usuarios set rol = 'admin' where id = auth.uid();
  exception when others then fallo := true;
  end;
  assert fallo, 'Luis se pudo hacer admin';

  fallo := false;
  begin
    perform expulsar_miembro((select id from usuarios where nombre = 'ana'));
  exception when others then fallo := true;
  end;
  assert fallo, 'Luis pudo expulsar a Ana sin ser admin';
end $$;


reset role;
select pruebas.como('ana@prueba.com');
set local role authenticated;
do $$
declare r record;
begin
  select * into r from ver_resumen() where nombre = 'ana';
  assert r.gastado = 1800, 'Ana: gastado debería ser 1800 y salió ' || r.gastado;
  assert r.disponible = -800, 'Ana: disponible debería ser -800 y salió ' || r.disponible;
  assert r.sin_limite, 'Ana debería salir sin límite';

  select * into r from ver_resumen() where nombre = 'luis';
  assert r.disponible = 3000, 'Luis: disponible debería ser 3000 y salió ' || r.disponible;
  assert r.disponible_familia = 2200, 'Familia: disponible debería ser 2200 y salió ' || r.disponible_familia;
  assert r.disponible_real = 2200, 'El tope familiar no funciona, salió ' || r.disponible_real;
end $$;


reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$ begin
  assert (select count(*) from gastos) = 0, 'Sin sesión se ven gastos';
  assert (select count(*) from tarjetas) = 0, 'Sin sesión se ven tarjetas';
  assert (select count(*) from usuarios) = 0, 'Sin sesión se ven usuarios';
end $$;


reset role;
select pruebas.como('ana@prueba.com');
set local role authenticated;
do $$
declare
  pasado date := current_setting('pruebas.mes_pasado')::date;
  r record;
  fallo boolean;
begin
  
  insert into limites (mes, aportacion) values (pasado, 1000);
  insert into gastos (monto, motivo, fecha_compra) values (400, 'efectivo pasado', pasado + 5);
  insert into gastos (monto, motivo, fecha_compra, msi) values (1200, 'msi pasado', pasado + 5, 3);


  select * into r from ver_resumen(pasado) where nombre = 'ana';
  assert r.gastado = 800, 'MSI mal repartido, gastado salió ' || r.gastado;

  
  perform cerrar_mes('siguiente_mes', pasado);
  assert (select sobrante from cierres where mes = pasado and usuario_id = auth.uid()) = 200,
    'El sobrante debería ser 200';

  fallo := false;
  begin
    perform cerrar_mes('ahorro', pasado);
  exception when others then fallo := true;
  end;
  assert fallo, 'Se pudo cerrar el mismo mes 2 veces';

  fallo := false;
  begin
    perform cerrar_mes('ahorro', current_date);
  exception when others then fallo := true;
  end;
  assert fallo, 'Se pudo cerrar el mes actual';

 
  select * into r from ver_resumen() where nombre = 'ana';
  assert r.arrastre = 200, 'El sobrante no pasó a este mes, arrastre salió ' || r.arrastre;
  assert r.gastado = 2200, 'La 2a mensualidad del msi no se sumó, gastado salió ' || r.gastado;

  
  perform editar_cierre(pasado, 'ahorro');
  select * into r from ver_resumen() where nombre = 'ana';
  assert r.arrastre = 0, 'Al mandarlo a ahorro siguió pasando a este mes';
  assert (select ahorro from ver_ahorro() where nombre = 'ana') = 200, 'El ahorro no se registró';
end $$;


reset role;
select cerrar_mes_todos();
do $$ begin
  assert (
    select count(*) from cierres c
    join auth.users a on a.id = c.usuario_id
    where a.email in ('ana@prueba.com', 'luis@prueba.com', 'carlos@prueba.com')
      and c.mes = current_setting('pruebas.mes_pasado')::date
  ) = 3, 'El cierre automático no cerró a todos o duplicó alguno';

  assert (
    select destino from cierres c
    join auth.users a on a.id = c.usuario_id
    where a.email = 'ana@prueba.com' and c.mes = current_setting('pruebas.mes_pasado')::date
  ) = 'ahorro', 'El cierre automático le cambió el cierre a Ana';
end $$;


select pruebas.como('carlos@prueba.com');
set local role authenticated;
do $$ begin
  assert (select count(*) from cierres) = 1, 'Carlos ve cierres de otra familia';
end $$;


reset role;
select 'Todas las pruebas pasaron' as resultado;
rollback;