-- usuarios, su id es el mismo del login de supabase
create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,  -- si alguien borra su cuenta tambièn se borra aqui
  familia_id bigint not null references familias(id),               -- familia
  nombre text not null,
  rol text not null default 'admin' check (rol in ('admin', 'miembro')),
  salario numeric check (salario >= 0),
  creada_el timestamptz not null default now(),
  actualizada_el timestamptz not null default now()
);

-- tabla de familias, cada usuario va a pertenecer a una
create table familias (
  id bigint generated always as identity primary key,  
  nombre text not null,                                -- ej. "Familia de Kitty"
  codigo_invitacion text unique not null
    default upper(substr(md5(random()::text), 1, 6)),  -- código de 6 letras para unirse, se genera solo
  actualizada_el timestamptz not null default now(),
  creada_el timestamptz not null default now()        
)

-- tarjetas, cada una tiene un dueño pero la ve toda la familia
create table tarjetas (
  id bigint generated always as identity primary key,
  familia_id bigint not null references familias(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,  -- dueño
  nombre text not null,
  tipo_pago text not null check (tipo_pago in ('credito', 'debito')),
  dia_corte smallint check (dia_corte between 1 and 31),  -- día del mes, se repite cada mes
  dia_pago smallint check (dia_pago between 1 and 31),
  creada_el timestamptz not null default now(),
  actualizada_el timestamptz not null default now()
);

-- gastos
create table gastos (
  id bigint generated always as identity primary key,
  familia_id bigint not null references familias(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete set null,     -- quién gastó
  tarjeta_id bigint references tarjetas(id) on delete set null,   -- null = efectivo
  monto numeric not null check (monto > 0),
  motivo text not null,
  fecha_compra date not null default current_date,
  msi smallint check (msi between 1 and 48),                      -- meses sin intereses, null si no aplica
  creada_el timestamptz not null default now(),
  actualizada_el timestamptz not null default now()
);

-- lo que aporta cada quien al límite del mes para separar limites de los integrantes
create table limites (
  id bigint generated always as identity primary key,
  familia_id bigint not null references familias(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),  -- siempre el día 1
  aportacion numeric not null check (aportacion >= 0),
  creada_el timestamptz not null default now(),
  actualizada_el timestamptz not null default now(),
  unique (usuario_id, mes)                               -- una aportación por persona por mes
);

-- cierre de cada mes por persona, aquí se guarda el sobrante tmbn
create table cierres (
  id bigint generated always as identity primary key,
  familia_id bigint not null references familias(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  limite numeric not null,
  gastado numeric not null,
  sobrante numeric not null,
  destino text not null check (destino in ('siguiente_mes', 'ahorro')),
  creada_el timestamptz not null default now(),
  unique (usuario_id, mes)                               -- no se puede cerrar el mismo mes 2 veces pero se puede cerrar antes de la fecha automatica
);

-- índices para buscar mas rápido
create index on usuarios (familia_id);
create index on tarjetas (familia_id);
create index on gastos (familia_id, fecha_compra);
create index on gastos (usuario_id);
create index on limites (familia_id, mes);
create index on cierres (familia_id, mes);