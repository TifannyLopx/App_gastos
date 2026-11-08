-- =====================================================================
-- 13_mejoras.sql  ·  MIGRACIÓN NO DESTRUCTIVA (se corre UNA vez sobre la base que ya tiene datos)
--
-- Qué agrega:
--   1. Tarjetas: efectivo como cuenta, saldo editable, límite de crédito, cuenta que paga cada crédito
--   2. Saldos que bajan solos al gastar con débito/efectivo, y transferencias entre cuentas
--   3. Estado de cada tarjeta de crédito (usado, disponible, a pagar, apartado) y pagos
--   4. Metas de ahorro en la base (antes vivían solo en el celular) + movimientos
--   5. Reparto del sobrante de cada mes (a siguiente mes, ahorro libre o una meta)
--   6. Porcentajes 35/20/15 editables
--   7. Dispositivos para notificaciones push
--   8. Gastos automáticos (cada X días)
--   9. Respaldo local + borrado de meses viejos
--
-- No borra ni modifica gastos, límites ni cierres existentes.
-- Todo está pensado para que la APK anterior siga funcionando mientras se actualiza.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. FUNCIONES DE FECHA (para cortes y pagos de tarjeta)
-- ---------------------------------------------------------------------

-- el día `dia` del mes de `mes` (si el mes es más corto, usa su último día: día 31 en febrero = 28)
create or replace function dia_en_mes(mes date, dia int)
returns date
language sql
immutable
as $$
  select (date_trunc('month', mes)::date
          + (least(dia, extract(day from (date_trunc('month', mes) + interval '1 month - 1 day'))::int) - 1))
$$;

-- la primera fecha con ese día del mes que sea igual o posterior a `d`
create or replace function proximo_dia(d date, dia int)
returns date
language sql
immutable
as $$
  select case
    when dia_en_mes(d, dia) >= d then dia_en_mes(d, dia)
    else dia_en_mes((date_trunc('month', d) + interval '1 month')::date, dia)
  end
$$;


-- ---------------------------------------------------------------------
-- 1. TARJETAS: efectivo, saldo, límite de crédito
-- ---------------------------------------------------------------------

-- ahora hay 3 tipos: crédito, débito y efectivo (el efectivo es una cuenta por persona)
alter table tarjetas drop constraint if exists tarjetas_tipo_pago_check;
alter table tarjetas add constraint tarjetas_tipo_pago_check
  check (tipo_pago in ('credito', 'debito', 'efectivo'));

alter table tarjetas add column if not exists limite_credito numeric check (limite_credito >= 0);   -- null = sin límite
alter table tarjetas add column if not exists saldo numeric not null default 0;                     -- dinero en débito/efectivo
alter table tarjetas add column if not exists deuda_inicial numeric not null default 0;             -- lo que ya se debía antes de usar la app
alter table tarjetas add column if not exists control_desde date not null
  default (date_trunc('month', current_date))::date;                                                -- desde cuándo se cuentan los gastos
alter table tarjetas add column if not exists cuenta_pago_id bigint references tarjetas(id) on delete set null; -- con qué cuenta se paga este crédito

-- las tarjetas que ya existían empiezan a contarse desde este mes
update tarjetas set control_desde = (date_trunc('month', current_date))::date;

-- una cuenta de efectivo por persona
create unique index if not exists un_efectivo_por_usuario on tarjetas (titular_id) where tipo_pago = 'efectivo';

insert into tarjetas (familia_id, titular_id, nombre, tipo_pago)
select u.familia_id, u.id, 'Efectivo', 'efectivo'
from usuarios u
where not exists (select 1 from tarjetas t where t.titular_id = u.id and t.tipo_pago = 'efectivo');

-- a quien se registre de aquí en adelante también se le crea su efectivo
create or replace function crear_efectivo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into tarjetas (familia_id, titular_id, nombre, tipo_pago)
  values (new.familia_id, new.id, 'Efectivo', 'efectivo');
  return new;
end;
$$;

drop trigger if exists al_crear_usuario_efectivo on usuarios;
create trigger al_crear_usuario_efectivo
after insert on usuarios
for each row execute function crear_efectivo();

-- el efectivo no se puede borrar
drop policy if exists "borrar mi tarjeta" on tarjetas;
create policy "borrar mi tarjeta" on tarjetas for delete to authenticated
  using (titular_id = auth.uid() and tipo_pago <> 'efectivo');


-- ---------------------------------------------------------------------
-- 2. SALDOS: bajan solos al gastar y se pueden transferir
-- ---------------------------------------------------------------------

-- los gastos viejos NO tocan saldos (nunca los descontaron), solo los nuevos
alter table gastos add column if not exists afecta_saldo boolean not null default false;
alter table gastos alter column afecta_saldo set default true;

create or replace function ajustar_saldo_por_gasto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- cuando se archivan meses viejos no se devuelve dinero a las cuentas
  if coalesce(current_setting('app.archivando', true), '') = '1' then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.afecta_saldo and old.tarjeta_id is not null then
    update tarjetas set saldo = saldo + old.monto
    where id = old.tarjeta_id and tipo_pago in ('debito', 'efectivo');
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.afecta_saldo and new.tarjeta_id is not null then
    update tarjetas set saldo = saldo - new.monto
    where id = new.tarjeta_id and tipo_pago in ('debito', 'efectivo');
  end if;
  return null;
end;
$$;

drop trigger if exists gastos_saldo on gastos;
create trigger gastos_saldo
after insert or update or delete on gastos
for each row execute function ajustar_saldo_por_gasto();

-- pasa dinero de una cuenta tuya (débito o efectivo) a otra cuenta de la familia
create or replace function transferir(p_origen bigint, p_destino bigint, p_monto numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o tarjetas;
  d tarjetas;
begin
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;
  if p_origen = p_destino then raise exception 'Elige dos cuentas distintas'; end if;

  select * into o from tarjetas where id = p_origen and familia_id = mi_familia();
  select * into d from tarjetas where id = p_destino and familia_id = mi_familia();

  if o.id is null or d.id is null then raise exception 'Cuenta no encontrada'; end if;
  if o.titular_id <> auth.uid() then raise exception 'Solo puedes sacar dinero de tus cuentas'; end if;
  if o.tipo_pago = 'credito' or d.tipo_pago = 'credito' then
    raise exception 'Solo se puede transferir entre débito y efectivo';
  end if;

  update tarjetas set saldo = saldo - p_monto where id = o.id;
  update tarjetas set saldo = saldo + p_monto where id = d.id;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. TARJETAS DE CRÉDITO: pagos y estado
-- ---------------------------------------------------------------------

create table if not exists pagos_tarjeta (
  id bigint generated always as identity primary key,
  familia_id bigint not null default mi_familia() references familias(id) on delete cascade,
  tarjeta_id bigint not null references tarjetas(id) on delete cascade,
  usuario_id uuid default auth.uid() references usuarios(id) on delete set null,
  monto numeric not null check (monto > 0),
  cuenta_origen_id bigint references tarjetas(id) on delete set null,   -- de qué cuenta salió el dinero
  fecha date not null default current_date,
  creada_el timestamptz not null default now()
);
create index if not exists pagos_tarjeta_idx on pagos_tarjeta (tarjeta_id, fecha);

alter table pagos_tarjeta enable row level security;
drop policy if exists "ver pagos de mi familia" on pagos_tarjeta;
create policy "ver pagos de mi familia" on pagos_tarjeta for select to authenticated
  using (familia_id = mi_familia());
-- los pagos solo se crean/deshacen con las funciones pagar_tarjeta y deshacer_pago

-- estado de TODAS las cuentas de la familia en una sola consulta
--   crédito:  usado, disponible, facturado, a_pagar, apartado, fechas de corte y pago
--   débito/efectivo: saldo, apartado_en_cuenta (lo reservado para pagar créditos) y libre
-- regla: un MSI consume TODO su monto del límite de crédito, pero solo su cuota mensual cuenta para pagar/apartar
create or replace function ver_estado_tarjetas(p_hoy date default current_date)
returns table (
  tarjeta_id bigint,
  tipo_pago text,
  saldo numeric,
  limite_credito numeric,
  usado numeric,
  disponible_credito numeric,
  a_pagar numeric,
  apartado numeric,
  ultimo_corte date,
  prox_corte date,
  fecha_limite_pago date,
  prox_pago date,
  apartado_en_cuenta numeric,
  libre numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with
  t as (
    select * from tarjetas where familia_id = mi_familia()
  ),
  -- cada gasto de crédito partido en sus cuotas, y a qué corte le toca cada una
  cuotas as (
    select
      g.tarjeta_id,
      round(g.monto / coalesce(g.msi, 1), 2) as monto,
      case when t.dia_corte is null then fc.f else proximo_dia(fc.f, t.dia_corte) end as corte
    from gastos g
    join t on t.id = g.tarjeta_id and t.tipo_pago = 'credito'
    cross join lateral generate_series(0, coalesce(g.msi, 1) - 1) as n
    cross join lateral (select (g.fecha_compra + make_interval(months => n))::date as f) fc
    where g.fecha_compra >= t.control_desde
  ),
  principal as (
    select g.tarjeta_id, sum(g.monto) as total
    from gastos g join t on t.id = g.tarjeta_id and t.tipo_pago = 'credito'
    where g.fecha_compra >= t.control_desde
    group by g.tarjeta_id
  ),
  pagado as (
    select p.tarjeta_id, sum(p.monto) as total
    from pagos_tarjeta p join t on t.id = p.tarjeta_id
    group by p.tarjeta_id
  ),
  cred as (
    select
      t.id, t.tipo_pago, t.saldo, t.limite_credito, t.cuenta_pago_id, t.dia_corte, t.dia_pago,
      calc.ultimo_corte, calc.prox_corte,
      greatest(coalesce(pr.total, 0) + t.deuda_inicial - coalesce(pg.total, 0), 0) as usado,
      greatest(
        coalesce((select sum(c.monto) from cuotas c where c.tarjeta_id = t.id and c.corte <= p_hoy), 0)
          + t.deuda_inicial - coalesce(pg.total, 0), 0) as a_pagar,
      greatest(
        coalesce((select sum(c.monto) from cuotas c where c.tarjeta_id = t.id and c.corte <= calc.prox_corte), 0)
          + t.deuda_inicial - coalesce(pg.total, 0), 0) as apartado
    from t
    left join principal pr on pr.tarjeta_id = t.id
    left join pagado pg on pg.tarjeta_id = t.id
    cross join lateral (
      select
        case when t.dia_corte is null then null
             when dia_en_mes(p_hoy, t.dia_corte) <= p_hoy then dia_en_mes(p_hoy, t.dia_corte)
             else dia_en_mes((p_hoy - interval '1 month')::date, t.dia_corte) end as ultimo_corte,
        case when t.dia_corte is null then p_hoy + 30
             else proximo_dia(p_hoy + 1, t.dia_corte) end as prox_corte
    ) calc
    where t.tipo_pago = 'credito'
  )
  select
    c.id, c.tipo_pago, c.saldo, c.limite_credito, c.usado,
    case when c.limite_credito is null then null else c.limite_credito - c.usado end,
    c.a_pagar, c.apartado, c.ultimo_corte, c.prox_corte,
    case when c.a_pagar > 0 and c.dia_pago is not null and c.ultimo_corte is not null
         then proximo_dia(c.ultimo_corte + 1, c.dia_pago) end,
    case when c.dia_pago is not null then proximo_dia(c.prox_corte + 1, c.dia_pago) end,
    null::numeric, null::numeric
  from cred c
  union all
  select
    t.id, t.tipo_pago, t.saldo, null, null, null, null, null, null, null, null, null,
    coalesce((select sum(c.apartado) from cred c where c.cuenta_pago_id = t.id), 0),
    t.saldo - coalesce((select sum(c.apartado) from cred c where c.cuenta_pago_id = t.id), 0)
  from t
  where t.tipo_pago in ('debito', 'efectivo')
$$;

-- "Ya pagué": registra el pago, baja el saldo de la cuenta con la que se pagó y libera el apartado
-- sin monto = paga todo lo que toca pagar ahora (a_pagar)
create or replace function pagar_tarjeta(
  p_tarjeta bigint,
  p_monto numeric default null,
  p_cuenta bigint default null,
  p_hoy date default current_date
)
returns pagos_tarjeta
language plpgsql
security definer
set search_path = public
as $$
declare
  tj tarjetas;
  origen tarjetas;
  monto_final numeric := p_monto;
  nuevo pagos_tarjeta;
begin
  select * into tj from tarjetas where id = p_tarjeta and familia_id = mi_familia() and tipo_pago = 'credito';
  if tj.id is null then raise exception 'Tarjeta de crédito no encontrada'; end if;

  if monto_final is null then
    select e.a_pagar into monto_final from ver_estado_tarjetas(p_hoy) e where e.tarjeta_id = p_tarjeta;
  end if;
  if monto_final is null or monto_final <= 0 then raise exception 'No hay nada que pagar'; end if;

  -- cuenta de donde sale el dinero: la que elijas, o la que tiene asignada la tarjeta (puede no haber)
  select * into origen from tarjetas
  where id = coalesce(p_cuenta, tj.cuenta_pago_id)
    and familia_id = mi_familia() and tipo_pago in ('debito', 'efectivo');

  if origen.id is not null then
    if origen.titular_id <> auth.uid() then raise exception 'Solo puedes pagar con dinero de tus cuentas'; end if;
    update tarjetas set saldo = saldo - monto_final where id = origen.id;
  end if;

  insert into pagos_tarjeta (familia_id, tarjeta_id, usuario_id, monto, cuenta_origen_id, fecha)
  values (tj.familia_id, tj.id, auth.uid(), monto_final, origen.id, p_hoy)
  returning * into nuevo;

  return nuevo;
end;
$$;

-- deshace un pago (por si le picaron sin querer): devuelve el dinero a la cuenta
create or replace function deshacer_pago(p_pago bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p pagos_tarjeta;
begin
  select * into p from pagos_tarjeta where id = p_pago and familia_id = mi_familia();
  if p.id is null then raise exception 'Pago no encontrado'; end if;
  if p.usuario_id is distinct from auth.uid() then raise exception 'Solo puedes deshacer tus pagos'; end if;

  if p.cuenta_origen_id is not null then
    update tarjetas set saldo = saldo + p.monto where id = p.cuenta_origen_id;
  end if;
  delete from pagos_tarjeta where id = p.id;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. METAS DE AHORRO
-- ---------------------------------------------------------------------

create table if not exists metas (
  id bigint generated always as identity primary key,
  familia_id bigint not null default mi_familia() references familias(id) on delete cascade,
  nombre text not null,
  objetivo numeric not null check (objetivo > 0),
  creada_el timestamptz not null default now(),
  actualizada_el timestamptz not null default now()
);

-- entradas (+) y salidas (-) de dinero de una meta
-- desde_ahorro = true: el dinero viene de tu "ahorro libre" (o regresa a él si es una salida)
create table if not exists movimientos_meta (
  id bigint generated always as identity primary key,
  familia_id bigint not null default mi_familia() references familias(id) on delete cascade,
  meta_id bigint not null references metas(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references usuarios(id) on delete cascade,
  monto numeric not null check (monto <> 0),
  desde_ahorro boolean not null default true,
  nota text,
  creada_el timestamptz not null default now()
);
create index if not exists movimientos_meta_idx on movimientos_meta (meta_id);

-- cómo se repartió el sobrante de cada cierre
create table if not exists cierre_repartos (
  id bigint generated always as identity primary key,
  cierre_id bigint not null references cierres(id) on delete cascade,
  familia_id bigint not null references familias(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  tipo text not null check (tipo in ('siguiente_mes', 'ahorro', 'meta')),
  meta_id bigint references metas(id) on delete cascade,
  monto numeric not null check (monto > 0),
  check ((tipo = 'meta') = (meta_id is not null))
);
create index if not exists cierre_repartos_idx on cierre_repartos (cierre_id);

-- los cierres que ya existían quedan como un reparto único (igual que antes)
insert into cierre_repartos (cierre_id, familia_id, usuario_id, tipo, monto)
select c.id, c.familia_id, c.usuario_id, c.destino, c.sobrante
from cierres c
where c.sobrante > 0
  and not exists (select 1 from cierre_repartos r where r.cierre_id = c.id);

drop trigger if exists metas_actualizada on metas;
create trigger metas_actualizada before update on metas for each row execute function poner_actualizada_el();

alter table metas enable row level security;
alter table movimientos_meta enable row level security;
alter table cierre_repartos enable row level security;

drop policy if exists "ver metas de mi familia" on metas;
create policy "ver metas de mi familia" on metas for select to authenticated using (familia_id = mi_familia());
drop policy if exists "crear meta" on metas;
create policy "crear meta" on metas for insert to authenticated with check (familia_id = mi_familia());
drop policy if exists "editar meta" on metas;
create policy "editar meta" on metas for update to authenticated
  using (familia_id = mi_familia()) with check (familia_id = mi_familia());
drop policy if exists "borrar meta" on metas;
create policy "borrar meta" on metas for delete to authenticated using (familia_id = mi_familia());

drop policy if exists "ver movimientos de mi familia" on movimientos_meta;
create policy "ver movimientos de mi familia" on movimientos_meta for select to authenticated
  using (familia_id = mi_familia());
-- los movimientos se crean con mover_meta; cada quien puede deshacer los suyos
drop policy if exists "borrar mi movimiento" on movimientos_meta;
create policy "borrar mi movimiento" on movimientos_meta for delete to authenticated
  using (usuario_id = auth.uid());

drop policy if exists "ver repartos de mi familia" on cierre_repartos;
create policy "ver repartos de mi familia" on cierre_repartos for select to authenticated
  using (familia_id = mi_familia());

-- cuánto lleva cada meta
create or replace function ver_metas()
returns table (id bigint, nombre text, objetivo numeric, ahorrado numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.id, m.nombre, m.objetivo,
    coalesce((select sum(x.monto) from movimientos_meta x where x.meta_id = m.id), 0)
    + coalesce((select sum(r.monto) from cierre_repartos r where r.meta_id = m.id and r.tipo = 'meta'), 0)
  from metas m
  where m.familia_id = mi_familia()
  order by m.id
$$;

-- ahorro libre de cada quien = lo que mandó a "ahorro" en sus cierres, menos lo que ya pasó a metas
-- (misma firma que antes: la APK vieja sigue funcionando)
create or replace function ver_ahorro()
returns table (usuario_id uuid, nombre text, ahorro numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    u.id, u.nombre,
    coalesce((select sum(r.monto) from cierre_repartos r where r.usuario_id = u.id and r.tipo = 'ahorro'), 0)
    - coalesce((select sum(x.monto) from movimientos_meta x where x.usuario_id = u.id and x.desde_ahorro), 0)
  from usuarios u
  where u.familia_id = mi_familia()
$$;

-- mete (+) o saca (-) dinero de una meta
create or replace function mover_meta(
  p_meta bigint,
  p_monto numeric,
  p_desde_ahorro boolean default true,
  p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  guardado numeric;
  libre numeric;
begin
  if p_monto is null or p_monto = 0 then raise exception 'El monto no puede ser 0'; end if;
  if not exists (select 1 from metas where id = p_meta and familia_id = mi_familia()) then
    raise exception 'Meta no encontrada';
  end if;

  select ahorrado into guardado from ver_metas() where id = p_meta;
  if p_monto < 0 and guardado + p_monto < 0 then
    raise exception 'La meta solo tiene % guardados', guardado;
  end if;

  if p_desde_ahorro and p_monto > 0 then
    select ahorro into libre from ver_ahorro() where usuario_id = auth.uid();
    if libre < p_monto then
      raise exception 'Solo tienes % de ahorro libre. Desmarca "usar ahorro libre" para meter dinero de otro lado', libre;
    end if;
  end if;

  insert into movimientos_meta (familia_id, meta_id, usuario_id, monto, desde_ahorro, nota)
  values (mi_familia(), p_meta, auth.uid(), p_monto, p_desde_ahorro, p_nota);
end;
$$;


-- ---------------------------------------------------------------------
-- 5. REPARTO DEL SOBRANTE
-- ---------------------------------------------------------------------

-- el arrastre al mes siguiente ahora sale del reparto (antes salía del destino único)
create or replace function ver_resumen(
  p_mes date default current_date,
  p_familia bigint default mi_familia()
)
returns table (
  usuario_id uuid,
  nombre text,
  aportacion numeric,
  arrastre numeric,
  limite numeric,
  gastado numeric,
  disponible numeric,
  disponible_familia numeric,
  disponible_real numeric,
  sin_limite boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with
  m as (
    select date_trunc('month', p_mes)::date as inicio
  ),
  -- cada gasto convertido en lo que pega cada mes: un MSI se reparte en sus meses
  cargos as (
    select
      coalesce(t.titular_id, g.usuario_id) as responsable,
      round(g.monto / coalesce(g.msi, 1), 2) as monto_mes,
      (date_trunc('month', g.fecha_compra) + make_interval(months => n))::date as mes_cargo
    from gastos g
    left join tarjetas t on t.id = g.tarjeta_id
    cross join lateral generate_series(0, coalesce(g.msi, 1) - 1) as n
    where g.familia_id = p_familia
  ),
  por_persona as (
    select
      u.id,
      u.nombre,
      coalesce((
        select l.aportacion from limites l
        where l.usuario_id = u.id and l.mes = m.inicio
      ), 0) as aportacion,
      coalesce((
        select sum(r.monto) from cierre_repartos r
        join cierres c on c.id = r.cierre_id
        where c.usuario_id = u.id
          and r.tipo = 'siguiente_mes'
          and c.mes = (m.inicio - interval '1 month')::date
      ), 0) as arrastre,
      coalesce((
        select sum(x.monto_mes) from cargos x
        where x.responsable = u.id and x.mes_cargo = m.inicio
      ), 0) as gastado
    from usuarios u
    cross join m
    where u.familia_id = p_familia
  )
  select
    id,
    nombre,
    aportacion,
    arrastre,
    aportacion + arrastre,
    gastado,
    aportacion + arrastre - gastado,
    sum(aportacion + arrastre - gastado) over (),
    least(aportacion + arrastre - gastado,
          sum(aportacion + arrastre - gastado) over ()),
    aportacion + arrastre - gastado <= 0
  from por_persona
$$;

-- cierra un mes y deja el reparto inicial (todo a un solo destino)
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
  select * into r from ver_resumen(inicio, familia) where usuario_id = p_usuario;

  insert into cierres (familia_id, usuario_id, mes, limite, gastado, sobrante, destino)
  values (familia, p_usuario, inicio, r.limite, r.gastado, greatest(r.disponible, 0), p_destino)
  returning * into nuevo;

  if nuevo.sobrante > 0 then
    insert into cierre_repartos (cierre_id, familia_id, usuario_id, tipo, monto)
    values (nuevo.id, familia, p_usuario, p_destino, nuevo.sobrante);
  end if;

  return nuevo;
end;
$$;

revoke execute on function cerrar_mes_de(uuid, date, text) from public, anon, authenticated;

-- la función de antes (todo el sobrante a un destino) sigue existiendo para la APK vieja
create or replace function editar_cierre(p_mes date, p_destino text)
returns cierres
language plpgsql
security definer
set search_path = public
as $$
declare
  editado cierres;
begin
  if date_trunc('month', p_mes)::date <> (date_trunc('month', current_date) - interval '1 month')::date then
    raise exception 'Solo puedes cambiar el cierre del mes pasado';
  end if;

  update cierres set destino = p_destino
  where usuario_id = auth.uid() and mes = date_trunc('month', p_mes)::date
  returning * into editado;

  if not found then
    raise exception 'No hay cierre de ese mes';
  end if;

  delete from cierre_repartos where cierre_id = editado.id;
  if editado.sobrante > 0 then
    insert into cierre_repartos (cierre_id, familia_id, usuario_id, tipo, monto)
    values (editado.id, editado.familia_id, editado.usuario_id, p_destino, editado.sobrante);
  end if;

  return editado;
end;
$$;

-- reparto a la medida. p_reparto = [{"tipo":"siguiente_mes","monto":500},{"tipo":"meta","meta_id":3,"monto":200},{"tipo":"ahorro","monto":100}]
-- lo que no se reparta se va al mes siguiente. Si el mes aún no estaba cerrado, lo cierra.
create or replace function guardar_reparto(p_mes date, p_reparto jsonb)
returns cierres
language plpgsql
security definer
set search_path = public
as $$
declare
  inicio date := date_trunc('month', p_mes)::date;
  cierre cierres;
  item jsonb;
  total numeric := 0;
  resto numeric;
  monto_item numeric;
  tipo_item text;
  meta_item bigint;
  a_siguiente numeric := 0;
  a_otros numeric := 0;
begin
  if inicio >= date_trunc('month', current_date)::date then
    raise exception 'Solo se pueden repartir meses que ya terminaron';
  end if;

  select * into cierre from cierres where usuario_id = auth.uid() and mes = inicio;
  if cierre.id is null then
    cierre := cerrar_mes_de(auth.uid(), inicio, 'siguiente_mes');
  elsif inicio <> (date_trunc('month', current_date) - interval '1 month')::date then
    raise exception 'Solo puedes cambiar el reparto del mes pasado';
  end if;

  -- valida lo que mandaron
  for item in select * from jsonb_array_elements(coalesce(p_reparto, '[]'::jsonb)) loop
    tipo_item := item->>'tipo';
    monto_item := (item->>'monto')::numeric;
    meta_item := nullif(item->>'meta_id', '')::bigint;

    if tipo_item not in ('siguiente_mes', 'ahorro', 'meta') then raise exception 'Destino no válido: %', tipo_item; end if;
    if monto_item is null or monto_item <= 0 then raise exception 'Cada monto debe ser mayor a 0'; end if;
    if tipo_item = 'meta' and not exists (select 1 from metas where id = meta_item and familia_id = cierre.familia_id) then
      raise exception 'Meta no encontrada';
    end if;
    total := total + monto_item;
  end loop;

  if total > cierre.sobrante then
    raise exception 'Repartiste % pero solo sobraron %', total, cierre.sobrante;
  end if;
  resto := cierre.sobrante - total;

  delete from cierre_repartos where cierre_id = cierre.id;

  for item in select * from jsonb_array_elements(coalesce(p_reparto, '[]'::jsonb)) loop
    tipo_item := item->>'tipo';
    monto_item := (item->>'monto')::numeric;
    meta_item := nullif(item->>'meta_id', '')::bigint;
    if tipo_item = 'siguiente_mes' then
      a_siguiente := a_siguiente + monto_item;
    else
      a_otros := a_otros + monto_item;
      insert into cierre_repartos (cierre_id, familia_id, usuario_id, tipo, meta_id, monto)
      values (cierre.id, cierre.familia_id, cierre.usuario_id, tipo_item, meta_item, monto_item);
    end if;
  end loop;

  a_siguiente := a_siguiente + resto;
  if a_siguiente > 0 then
    insert into cierre_repartos (cierre_id, familia_id, usuario_id, tipo, monto)
    values (cierre.id, cierre.familia_id, cierre.usuario_id, 'siguiente_mes', a_siguiente);
  end if;

  -- destino "principal" para compatibilidad con la APK vieja
  update cierres set destino = case when a_siguiente >= a_otros then 'siguiente_mes' else 'ahorro' end
  where id = cierre.id
  returning * into cierre;

  return cierre;
end;
$$;

-- unirse a una familia ahora también mueve lo nuevo (si no, se borraría con la familia personal vacía)
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

  update usuarios set familia_id = familia_destino, rol = 'miembro' where id = auth.uid();
  update tarjetas set familia_id = familia_destino where familia_id = familia_vieja;
  update gastos   set familia_id = familia_destino where familia_id = familia_vieja;
  update limites  set familia_id = familia_destino where familia_id = familia_vieja;
  update cierres  set familia_id = familia_destino where familia_id = familia_vieja;
  update pagos_tarjeta   set familia_id = familia_destino where familia_id = familia_vieja;
  update metas           set familia_id = familia_destino where familia_id = familia_vieja;
  update movimientos_meta set familia_id = familia_destino where familia_id = familia_vieja;
  update cierre_repartos set familia_id = familia_destino where familia_id = familia_vieja;

  delete from familias where id = familia_vieja;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. PORCENTAJES DEL PRESUPUESTO (antes 35/20/15 fijos en la app)
-- ---------------------------------------------------------------------

alter table familias add column if not exists pct_obligatorio numeric not null default 35 check (pct_obligatorio between 0 and 100);
alter table familias add column if not exists pct_necesario   numeric not null default 20 check (pct_necesario between 0 and 100);
alter table familias add column if not exists pct_chucheria   numeric not null default 15 check (pct_chucheria between 0 and 100);

-- cualquiera de la familia puede cambiarlos (no solo el admin)
create or replace function editar_porcentajes(p_obligatorio numeric, p_necesario numeric, p_chucheria numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if least(p_obligatorio, p_necesario, p_chucheria) < 0 then raise exception 'Los porcentajes no pueden ser negativos'; end if;
  if p_obligatorio + p_necesario + p_chucheria > 100 then raise exception 'Los porcentajes no pueden sumar más de 100'; end if;

  update familias
  set pct_obligatorio = p_obligatorio, pct_necesario = p_necesario, pct_chucheria = p_chucheria
  where id = mi_familia();
end;
$$;


-- ---------------------------------------------------------------------
-- 7. NOTIFICACIONES PUSH: dispositivos
-- ---------------------------------------------------------------------

create table if not exists dispositivos (
  token text primary key,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  plataforma text,
  actualizada_el timestamptz not null default now()
);

alter table dispositivos enable row level security;
drop policy if exists "ver mis dispositivos" on dispositivos;
create policy "ver mis dispositivos" on dispositivos for select to authenticated using (usuario_id = auth.uid());

-- si el celular cambió de cuenta, el token pasa a la cuenta nueva
create or replace function registrar_dispositivo(p_token text, p_plataforma text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into dispositivos (token, usuario_id, plataforma)
  values (p_token, auth.uid(), p_plataforma)
  on conflict (token) do update set usuario_id = auth.uid(), plataforma = excluded.plataforma, actualizada_el = now()
$$;

-- al cerrar sesión, ese celular deja de recibir avisos de esta cuenta
create or replace function borrar_dispositivo(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from dispositivos where token = p_token and usuario_id = auth.uid()
$$;


-- ---------------------------------------------------------------------
-- 8. GASTOS AUTOMÁTICOS (cada X días, por un monto)
-- ---------------------------------------------------------------------

create table if not exists gastos_recurrentes (
  id bigint generated always as identity primary key,
  familia_id bigint not null default mi_familia() references familias(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references usuarios(id) on delete cascade,
  tarjeta_id bigint references tarjetas(id) on delete set null,
  motivo text not null,                                   -- ya con la categoría dentro, igual que en gastos
  monto numeric not null check (monto > 0),
  cada_dias smallint not null check (cada_dias between 1 and 365),
  msi smallint check (msi between 1 and 48),
  proxima_fecha date not null default current_date,
  activo boolean not null default true,
  creada_el timestamptz not null default now(),
  actualizada_el timestamptz not null default now()
);

drop trigger if exists recurrentes_actualizada on gastos_recurrentes;
create trigger recurrentes_actualizada before update on gastos_recurrentes for each row execute function poner_actualizada_el();

alter table gastos_recurrentes enable row level security;
drop policy if exists "ver automaticos de mi familia" on gastos_recurrentes;
create policy "ver automaticos de mi familia" on gastos_recurrentes for select to authenticated using (familia_id = mi_familia());
drop policy if exists "crear mi automatico" on gastos_recurrentes;
create policy "crear mi automatico" on gastos_recurrentes for insert to authenticated
  with check (familia_id = mi_familia() and usuario_id = auth.uid()
    and (tarjeta_id is null or exists (select 1 from tarjetas t where t.id = tarjeta_id and t.familia_id = mi_familia())));
drop policy if exists "editar mi automatico" on gastos_recurrentes;
create policy "editar mi automatico" on gastos_recurrentes for update to authenticated
  using (usuario_id = auth.uid())
  with check (familia_id = mi_familia() and usuario_id = auth.uid()
    and (tarjeta_id is null or exists (select 1 from tarjetas t where t.id = tarjeta_id and t.familia_id = mi_familia())));
drop policy if exists "borrar mi automatico" on gastos_recurrentes;
create policy "borrar mi automatico" on gastos_recurrentes for delete to authenticated using (usuario_id = auth.uid());

-- crea los gastos que ya tocan (si pasaron varios periodos, crea todos). p_usuario null = de todos
create or replace function generar_recurrentes(p_usuario uuid default null, p_hoy date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r gastos_recurrentes;
  fecha date;
  creados int := 0;
  vueltas int;
begin
  for r in
    select * from gastos_recurrentes
    where activo and proxima_fecha <= p_hoy and (p_usuario is null or usuario_id = p_usuario)
    for update
  loop
    fecha := r.proxima_fecha;
    vueltas := 0;
    while fecha <= p_hoy and vueltas < 400 loop
      insert into gastos (familia_id, usuario_id, tarjeta_id, monto, motivo, fecha_compra, msi)
      values (r.familia_id, r.usuario_id, r.tarjeta_id, r.monto, r.motivo, fecha, r.msi);
      creados := creados + 1;
      fecha := fecha + r.cada_dias;
      vueltas := vueltas + 1;
    end loop;
    update gastos_recurrentes set proxima_fecha = fecha where id = r.id;
  end loop;
  return creados;
end;
$$;

revoke execute on function generar_recurrentes(uuid, date) from public, anon, authenticated;

-- la app la llama al abrirse, así lo de hoy aparece al momento (el cron de abajo lo hace de todos modos)
create or replace function generar_mis_recurrentes(p_hoy date default current_date)
returns int
language sql
security definer
set search_path = public
as $$
  select generar_recurrentes(auth.uid(), p_hoy)
$$;

select cron.schedule('gastos-automaticos', '10 6 * * *', $$select generar_recurrentes()$$);


-- ---------------------------------------------------------------------
-- 9. RESPALDO LOCAL Y BORRADO DE MESES VIEJOS
-- ---------------------------------------------------------------------

-- cada quien avisa hasta qué fecha ya guardó su copia local en su celular
create table if not exists respaldos (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  hasta date not null,
  actualizada_el timestamptz not null default now()
);
alter table respaldos enable row level security;
drop policy if exists "ver respaldos de mi familia" on respaldos;
create policy "ver respaldos de mi familia" on respaldos for select to authenticated
  using (exists (select 1 from usuarios u where u.id = respaldos.usuario_id and u.familia_id = mi_familia()));

create or replace function registrar_respaldo(p_hasta date)
returns void
language sql
security definer
set search_path = public
as $$
  insert into respaldos (usuario_id, hasta) values (auth.uid(), p_hasta)
  on conflict (usuario_id) do update set hasta = greatest(respaldos.hasta, excluded.hasta), actualizada_el = now()
$$;

-- borra los gastos y pagos viejos. Reglas de seguridad:
--   · solo meses anteriores al mes pasado
--   · TODOS los de la familia deben haber guardado su copia local hasta esa fecha
--   · solo se borran gastos que ya terminaron de cobrarse (un MSI activo se queda)
--   · lo que quedaba por pagar de esos gastos pasa a la "deuda inicial" de la tarjeta, así los números no cambian
create or replace function borrar_meses_respaldados(p_antes_de date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  corte date := date_trunc('month', p_antes_de)::date;
  limite_borrado date := (date_trunc('month', current_date) - interval '1 month')::date;
  falta text;
  n_gastos int;
  n_pagos int;
begin
  if corte > limite_borrado then
    raise exception 'Solo puedes borrar meses anteriores al mes pasado';
  end if;

  select u.nombre into falta
  from usuarios u
  left join respaldos r on r.usuario_id = u.id
  where u.familia_id = mi_familia() and coalesce(r.hasta, date '1900-01-01') < corte
  limit 1;
  if falta is not null then
    raise exception 'Falta que % guarde su copia local antes de borrar', falta;
  end if;

  perform set_config('app.archivando', '1', true);   -- que los saldos no se muevan al borrar

  -- el saldo pendiente de esas tarjetas se conserva como deuda inicial
  update tarjetas t set deuda_inicial = t.deuda_inicial
      + coalesce((select sum(g.monto) from gastos g
                  where g.tarjeta_id = t.id and g.familia_id = mi_familia() and g.fecha_compra >= t.control_desde
                    and (date_trunc('month', g.fecha_compra) + make_interval(months => coalesce(g.msi, 1)))::date <= corte), 0)
      - coalesce((select sum(p.monto) from pagos_tarjeta p where p.tarjeta_id = t.id and p.fecha < corte), 0)
  where t.familia_id = mi_familia() and t.tipo_pago = 'credito';

  delete from pagos_tarjeta where familia_id = mi_familia() and fecha < corte;
  get diagnostics n_pagos = row_count;

  delete from gastos
  where familia_id = mi_familia()
    and (date_trunc('month', fecha_compra) + make_interval(months => coalesce(msi, 1)))::date <= corte;
  get diagnostics n_gastos = row_count;

  return jsonb_build_object('gastos', n_gastos, 'pagos', n_pagos);
end;
$$;


-- ---------------------------------------------------------------------
-- PERMISOS
-- ---------------------------------------------------------------------

grant select, insert, update, delete on pagos_tarjeta, metas, movimientos_meta, cierre_repartos,
  dispositivos, gastos_recurrentes, respaldos to authenticated;
grant usage on all sequences in schema public to authenticated;

-- las funciones nuevas solo las puede llamar alguien con sesión
do $$
declare f text;
begin
  foreach f in array array[
    'transferir(bigint,bigint,numeric)',
    'ver_estado_tarjetas(date)',
    'pagar_tarjeta(bigint,numeric,bigint,date)',
    'deshacer_pago(bigint)',
    'ver_metas()',
    'mover_meta(bigint,numeric,boolean,text)',
    'guardar_reparto(date,jsonb)',
    'editar_porcentajes(numeric,numeric,numeric)',
    'registrar_dispositivo(text,text)',
    'borrar_dispositivo(text)',
    'generar_mis_recurrentes(date)',
    'registrar_respaldo(date)',
    'borrar_meses_respaldados(date)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
