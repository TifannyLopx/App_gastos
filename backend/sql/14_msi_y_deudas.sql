-- msi de antes de usar la app y deudas que no son de tarjeta (moto, préstamos)
-- en la app los dos salen juntos como "pagos a plazos"

-- por si corriste la versión anterior de este archivo
drop table if exists msi_previos cascade;


-- MSI ANTERIORES

-- solo se pide lo que sale en el estado de cuenta: mensualidad y cuántas faltan
create table msi_previos (
  id bigint generated always as identity primary key,
  tarjeta_id bigint not null references tarjetas(id) on delete cascade,
  motivo text not null,
  mensualidad numeric not null check (mensualidad > 0),
  faltan smallint not null check (faltan between 1 and 48),       -- las que faltaban al registrarlo
  de_meses smallint check (de_meses between 2 and 48),            -- opcional, para mostrar "5 de 12"
  desde date not null default current_date,                       -- desde cuándo se cuentan las que faltan
  creada_el timestamptz not null default now(),
  actualizada_el timestamptz not null default now()
);

create index msi_previos_idx on msi_previos (tarjeta_id);

create trigger msi_previos_actualizada before update on msi_previos
for each row execute function poner_actualizada_el();

-- si editan cuántas faltan, se vuelve a contar desde hoy
create or replace function reiniciar_msi_previo()
returns trigger
language plpgsql
as $$
begin
  if new.faltan <> old.faltan then
    new.desde = current_date;
  end if;
  return new;
end;
$$;

create trigger msi_previos_reiniciar before update on msi_previos
for each row execute function reiniciar_msi_previo();

alter table msi_previos enable row level security;

-- toda la familia los ve, solo el titular de la tarjeta los maneja
create policy "ver msi previos de mi familia" on msi_previos for select to authenticated
  using (exists (select 1 from tarjetas t where t.id = tarjeta_id and t.familia_id = mi_familia()));

create policy "crear msi previo" on msi_previos for insert to authenticated
  with check (exists (
    select 1 from tarjetas t
    where t.id = tarjeta_id and t.titular_id = auth.uid() and t.tipo_pago = 'credito'
  ));

create policy "editar msi previo" on msi_previos for update to authenticated
  using (exists (select 1 from tarjetas t where t.id = tarjeta_id and t.titular_id = auth.uid()))
  with check (exists (
    select 1 from tarjetas t
    where t.id = tarjeta_id and t.titular_id = auth.uid() and t.tipo_pago = 'credito'
  ));

create policy "borrar msi previo" on msi_previos for delete to authenticated
  using (exists (select 1 from tarjetas t where t.id = tarjeta_id and t.titular_id = auth.uid()));


-- estado de tarjetas, igual que antes pero sumando las mensualidades de los msi anteriores
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
  -- cuotas de los gastos de la app, igual que antes
  cuotas_app as (
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
  -- mensualidades que faltan de los msi anteriores, la primera cae en el siguiente corte
  cuotas_previas as (
    select
      mp.tarjeta_id,
      mp.mensualidad as monto,
      case when t.dia_corte is null then fc.f else proximo_dia(fc.f, t.dia_corte) end as corte
    from msi_previos mp
    join t on t.id = mp.tarjeta_id and t.tipo_pago = 'credito'
    cross join lateral generate_series(0, mp.faltan - 1) as n
    cross join lateral (select (mp.desde + make_interval(months => n))::date as f) fc
  ),
  cuotas as (
    select * from cuotas_app
    union all
    select * from cuotas_previas
  ),
  -- lo que consume del límite: gastos completos + todo lo que falta de los msi anteriores
  principal as (
    select tarjeta_id, sum(total) as total from (
      select g.tarjeta_id, g.monto as total
      from gastos g join t on t.id = g.tarjeta_id and t.tipo_pago = 'credito'
      where g.fecha_compra >= t.control_desde
      union all
      select tarjeta_id, monto from cuotas_previas
    ) x
    group by tarjeta_id
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


-- desglose de msi activos, los de la app y los anteriores, para la sección de cada tarjeta
create or replace function ver_msi(p_hoy date default current_date)
returns table (
  origen text,           -- 'app' o 'anterior'
  id bigint,             -- id del gasto o del msi anterior
  tarjeta_id bigint,
  motivo text,
  mensualidad numeric,
  de_meses smallint,     -- null si no lo pusieron
  quedan int,            -- mensualidades que faltan por facturar
  pendiente numeric,
  termina date           -- corte de la última mensualidad
)
language sql
stable
security invoker
set search_path = public
as $$
  with
  t as (
    select * from tarjetas where familia_id = mi_familia() and tipo_pago = 'credito'
  ),
  -- msi de la app: un gasto con varios meses
  app as (
    select
      g.id, g.tarjeta_id, g.motivo, g.monto, g.msi,
      round(g.monto / g.msi, 2) as mensualidad,
      count(*) filter (where fc.corte <= p_hoy)::int as facturadas,
      max(fc.corte) as termina
    from gastos g
    join t on t.id = g.tarjeta_id
    cross join lateral generate_series(0, g.msi - 1) as n
    cross join lateral (
      select case when t.dia_corte is null then (g.fecha_compra + make_interval(months => n))::date
                  else proximo_dia((g.fecha_compra + make_interval(months => n))::date, t.dia_corte) end as corte
    ) fc
    where g.msi > 1 and g.fecha_compra >= t.control_desde
    group by g.id, g.tarjeta_id, g.motivo, g.monto, g.msi
  ),
  -- msi anteriores: las que faltan desde que se registraron
  anteriores as (
    select
      mp.id, mp.tarjeta_id, mp.motivo, mp.mensualidad, mp.de_meses, mp.faltan,
      count(*) filter (where fc.corte <= p_hoy)::int as facturadas,
      max(fc.corte) as termina
    from msi_previos mp
    join t on t.id = mp.tarjeta_id
    cross join lateral generate_series(0, mp.faltan - 1) as n
    cross join lateral (
      select case when t.dia_corte is null then (mp.desde + make_interval(months => n))::date
                  else proximo_dia((mp.desde + make_interval(months => n))::date, t.dia_corte) end as corte
    ) fc
    group by mp.id, mp.tarjeta_id, mp.motivo, mp.mensualidad, mp.de_meses, mp.faltan
  )
  select
    'app', id, tarjeta_id, motivo, mensualidad, msi, msi - facturadas,
    monto - mensualidad * facturadas,   -- así la última se lleva los centavos
    termina
  from app
  where facturadas < msi
  union all
  select
    'anterior', id, tarjeta_id, motivo, mensualidad, de_meses, faltan - facturadas,
    mensualidad * (faltan - facturadas),
    termina
  from anteriores
  where facturadas < faltan
  order by termina
$$;


-- resumen del mes, igual que antes pero la mensualidad de los msi anteriores también cuenta en el límite
-- solo cuenta desde que se registraron, así no cambia ningún mes pasado
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
  cargos as (
    -- gastos de la app, un msi se reparte en sus meses
    select
      coalesce(t.titular_id, g.usuario_id) as responsable,
      round(g.monto / coalesce(g.msi, 1), 2) as monto_mes,
      (date_trunc('month', g.fecha_compra) + make_interval(months => n))::date as mes_cargo
    from gastos g
    left join tarjetas t on t.id = g.tarjeta_id
    cross join lateral generate_series(0, coalesce(g.msi, 1) - 1) as n
    where g.familia_id = p_familia
    union all
    -- mensualidades de los msi anteriores, en el mes de su corte y al titular de la tarjeta
    select
      t.titular_id,
      mp.mensualidad,
      date_trunc('month', case when t.dia_corte is null then fc.f else proximo_dia(fc.f, t.dia_corte) end)::date
    from msi_previos mp
    join tarjetas t on t.id = mp.tarjeta_id
    cross join lateral generate_series(0, mp.faltan - 1) as n
    cross join lateral (select (mp.desde + make_interval(months => n))::date as f) fc
    where t.familia_id = p_familia
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


-- DEUDAS (moto, préstamos, cosas a plazos que se pagan directo)

create table if not exists deudas (
  id bigint generated always as identity primary key,
  usuario_id uuid not null default auth.uid() references usuarios(id) on delete cascade,  -- dueño
  nombre text not null,
  falta numeric not null,                                         -- baja sola con cada abono
  total numeric check (total > 0),                                -- opcional, para la barra de avance
  abono numeric check (abono > 0),                                -- opcional, el abono normal
  cada_dias smallint check (cada_dias between 1 and 365),         -- opcional, cada cuánto se abona
  creada_el timestamptz not null default now(),
  actualizada_el timestamptz not null default now()
);

drop trigger if exists deudas_actualizada on deudas;
create trigger deudas_actualizada before update on deudas
for each row execute function poner_actualizada_el();

alter table deudas enable row level security;

-- toda la familia las ve, solo el dueño las maneja
drop policy if exists "ver deudas de mi familia" on deudas;
create policy "ver deudas de mi familia" on deudas for select to authenticated
  using (exists (select 1 from usuarios u where u.id = usuario_id and u.familia_id = mi_familia()));

drop policy if exists "crear mi deuda" on deudas;
create policy "crear mi deuda" on deudas for insert to authenticated
  with check (usuario_id = auth.uid());

drop policy if exists "editar mi deuda" on deudas;
create policy "editar mi deuda" on deudas for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "borrar mi deuda" on deudas;
create policy "borrar mi deuda" on deudas for delete to authenticated
  using (usuario_id = auth.uid());

-- un abono es un gasto con deuda_id, así cuenta en el límite y baja el saldo de su cuenta
alter table gastos_recurrentes add column if not exists deuda_id bigint references deudas(id) on delete cascade;   
alter table gastos_recurrentes add column if not exists deuda_id bigint references deudas(id) on delete set null;

-- cada abono baja lo que falta, y si lo editan o borran se acomoda
create or replace function ajustar_deuda_por_gasto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- al archivar meses viejos no se regresa la deuda
  if coalesce(current_setting('app.archivando', true), '') = '1' then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.deuda_id is not null then
    update deudas set falta = falta + old.monto where id = old.deuda_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.deuda_id is not null then
    update deudas set falta = falta - new.monto where id = new.deuda_id;

    -- si ya quedó pagada, se apaga su pago automático
    update gastos_recurrentes set activo = false
    where deuda_id = new.deuda_id
      and (select falta from deudas where id = new.deuda_id) <= 0;
  end if;

  return null;
end;
$$;

drop trigger if exists gastos_deuda on gastos;
create trigger gastos_deuda
after insert or update or delete on gastos
for each row execute function ajustar_deuda_por_gasto();

-- gastos automáticos, igual que antes pero pasando el deuda_id al gasto
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
      insert into gastos (familia_id, usuario_id, tarjeta_id, monto, motivo, fecha_compra, msi, deuda_id)
      values (r.familia_id, r.usuario_id, r.tarjeta_id, r.monto, r.motivo, fecha, r.msi, r.deuda_id);
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


-- permisos
grant select, insert, update, delete on msi_previos, deudas to authenticated;
revoke execute on function ver_msi(date) from public, anon;
grant execute on function ver_msi(date) to authenticated;