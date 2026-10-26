-- cierra el mes pasado de todos los que no lo cerraron, el sobrante se va al mes siguiente
create or replace function cerrar_mes_todos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  mes_pasado date := (date_trunc('month', current_date) - interval '1 month')::date;
begin
  for u in
    select id from usuarios
    where not exists (
      select 1 from cierres c where c.usuario_id = usuarios.id and c.mes = mes_pasado
    )
  loop
    perform cerrar_mes_de(u.id, mes_pasado, 'siguiente_mes');
  end loop;
end;
$$;

revoke execute on function cerrar_mes_todos() from public, anon, authenticated;

select cron.schedule('cerrar-mes', '5 6 1 * *', $$select cerrar_mes_todos()$$);