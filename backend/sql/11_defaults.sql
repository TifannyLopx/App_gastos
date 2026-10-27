-- valores automáticos nadie los puede inventar se ponen solos para evitar estar poniendolos siempre ma facil
alter table tarjetas alter column familia_id set default mi_familia();
alter table tarjetas alter column titular_id set default auth.uid();

alter table gastos alter column familia_id set default mi_familia();
alter table gastos alter column usuario_id set default auth.uid();

alter table limites alter column familia_id set default mi_familia();
alter table limites alter column usuario_id set default auth.uid();