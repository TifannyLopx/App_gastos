-- resumen del mes por usuario, cuánto aportó, cuánto gastó y cuánto le queda, es un reporte btw
create or replace function ver_resumen(
  p_mes date default current_date,        -- cualquier día del mes que quieres ver
  p_familia bigint default mi_familia()   -- por defecto tu familia
)
returns table (
  usuario_id uuid,
  nombre text,
  aportacion numeric,          -- lo que puso este mes
  arrastre numeric,            -- lo que le sobró el mes pasado
  limite numeric,              -- aportación + arrastre
  gastado numeric,
  disponible numeric,          -- lo suyo
  disponible_familia numeric,  -- lo que le queda a toda la familia
  disponible_real numeric,     -- lo suyo pero con lim en lo de la familia
  sin_limite boolean           -- true si ya se acabó lo suyo, para la alerta
)
language sql
stable
security invoker               
set search_path = public
as $$
  with
  -- el mes que se pide, siempre en día 1, todas las cuentas abren en día 1 de cada mes
  m as (
    select date_trunc('month', p_mes)::date as inicio
  ),
  -- cada gasto convertido en lo que pega cada mes, si es msi se reparte los meses hasta que termiinan
  cargos as (
    select
      coalesce(t.titular_id, g.usuario_id) as responsable,  -- dueño de la tarjeta, o quien pagó en efectivo
      round(g.monto / coalesce(g.msi, 1), 2) as monto_mes,
      (date_trunc('month', g.fecha_compra) + make_interval(months => n))::date as mes_cargo
    from gastos g
    left join tarjetas t on t.id = g.tarjeta_id
    cross join lateral generate_series(0, coalesce(g.msi, 1) - 1) as n
    where g.familia_id = p_familia
  ),
  -- los números de cada people
  por_persona as (
    select
      u.id,
      u.nombre,
      coalesce((
        select l.aportacion from limites l
        where l.usuario_id = u.id and l.mes = m.inicio
      ), 0) as aportacion,
      coalesce((
        select c.sobrante from cierres c
        where c.usuario_id = u.id
          and c.destino = 'siguiente_mes'
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
    aportacion + arrastre,                                 -- limite
    gastado,
    aportacion + arrastre - gastado,                       -- disponible
    sum(aportacion + arrastre - gastado) over (),          -- disponible_familia
    least(aportacion + arrastre - gastado,
          sum(aportacion + arrastre - gastado) over ()),   -- disponible_real
    aportacion + arrastre - gastado <= 0                   -- sin_limite
  from por_persona
$$;