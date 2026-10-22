-- ============================================================================
--  Mi Negocio — Esquema relacional para SUPABASE (PostgreSQL 15+)
--
--  CÓMO USARLO: Supabase → SQL Editor → New query → pega TODO este archivo → Run.
--  Es seguro volver a ejecutarlo (usa IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
--
--  Relaciones (llaves foráneas):
--    proveedores 1 ──< productos          (productos.proveedor_id, opcional)
--    proveedores 1 ──< compras >── 1 productos
--    clientes    1 ──< ventas  >── 1 productos
--
--  Seguridad: cada fila lleva user_id (el usuario que la creó) y Row Level Security
--  (RLS) hace que cada cuenta vea y modifique SOLO sus propias filas.
--  Las FK son compuestas (id, user_id) para que nadie pueda enlazar datos ajenos.
-- ============================================================================

-- ─── Tablas ─────────────────────────────────────────────────────────────────

create table if not exists public.clientes (
    id              bigint generated always as identity primary key,
    user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
    nombre          text not null check (length(trim(nombre)) > 0),
    telefono        text not null default '',
    email           text not null default '',
    fecha_registro  timestamptz not null default now(),
    unique (id, user_id)
);

create table if not exists public.proveedores (
    id              bigint generated always as identity primary key,
    user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
    nombre          text not null check (length(trim(nombre)) > 0),
    contacto        text not null default '',
    telefono        text not null default '',
    fecha_registro  timestamptz not null default now(),
    unique (id, user_id)
);

create table if not exists public.productos (
    id              bigint generated always as identity primary key,
    user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
    nombre          text not null check (length(trim(nombre)) > 0),
    descripcion     text not null default '',
    precio_venta    numeric(10,2) not null default 0 check (precio_venta >= 0),
    costo_compra    numeric(10,2) not null default 0 check (costo_compra >= 0),
    stock_actual    integer not null default 0 check (stock_actual >= 0),
    proveedor_id    bigint,
    unique (id, user_id),
    -- Si se borra el proveedor, el producto queda sin proveedor (solo se anula esa columna)
    foreign key (proveedor_id, user_id) references public.proveedores (id, user_id)
        on delete set null (proveedor_id)
);

create table if not exists public.compras (
    id              bigint generated always as identity primary key,
    user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
    proveedor_id    bigint not null,
    producto_id     bigint not null,
    cantidad        integer not null check (cantidad > 0),
    costo_unitario  numeric(10,2) not null check (costo_unitario >= 0),
    total           numeric(12,2) not null,
    fecha_hora      timestamptz not null default now(),   -- timestamp exacto automático
    foreign key (proveedor_id, user_id) references public.proveedores (id, user_id) on delete restrict,
    foreign key (producto_id, user_id)  references public.productos   (id, user_id) on delete restrict
);

create table if not exists public.ventas (
    id              bigint generated always as identity primary key,
    user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
    cliente_id      bigint not null,
    producto_id     bigint not null,
    cantidad        integer not null check (cantidad > 0),
    precio_unitario numeric(10,2) not null check (precio_unitario >= 0),
    total           numeric(12,2) not null,
    fecha_hora      timestamptz not null default now(),   -- timestamp exacto automático
    foreign key (cliente_id, user_id)  references public.clientes  (id, user_id) on delete restrict,
    foreign key (producto_id, user_id) references public.productos (id, user_id) on delete restrict
);

create index if not exists idx_productos_user   on public.productos   (user_id);
create index if not exists idx_clientes_user    on public.clientes    (user_id);
create index if not exists idx_proveedores_user on public.proveedores (user_id);
create index if not exists idx_compras_fecha    on public.compras     (user_id, fecha_hora desc);
create index if not exists idx_ventas_fecha     on public.ventas      (user_id, fecha_hora desc);

-- ─── Seguridad por filas (RLS): cada usuario ve solo lo suyo ────────────────

alter table public.clientes    enable row level security;
alter table public.proveedores enable row level security;
alter table public.productos   enable row level security;
alter table public.compras     enable row level security;
alter table public.ventas      enable row level security;

do $$
declare t text;
begin
    foreach t in array array['clientes','proveedores','productos','compras','ventas'] loop
        execute format('drop policy if exists "propios_%1$s" on public.%1$I', t);
        execute format(
            'create policy "propios_%1$s" on public.%1$I for all to authenticated
               using (user_id = (select auth.uid()))
               with check (user_id = (select auth.uid()))', t);
    end loop;
end $$;

-- ─── Funciones transaccionales (una llamada = todo o nada) ──────────────────
-- security invoker: se ejecutan con los permisos del usuario, así RLS sigue activa.

create or replace function public.registrar_venta(
    p_cliente_id  bigint,
    p_producto_id bigint,
    p_cantidad    integer
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_prod public.productos%rowtype;
    v_id   bigint;
begin
    if p_cantidad is null or p_cantidad <= 0 then
        raise exception 'La cantidad debe ser mayor a 0.';
    end if;

    -- FOR UPDATE bloquea la fila: evita vender de más si hay dos ventas simultáneas
    select * into v_prod from public.productos where id = p_producto_id for update;
    if not found then
        raise exception 'Producto no encontrado.';
    end if;
    if not exists (select 1 from public.clientes where id = p_cliente_id) then
        raise exception 'Selecciona un cliente válido.';
    end if;
    if v_prod.stock_actual < p_cantidad then
        raise exception 'Stock insuficiente. Disponible: %.', v_prod.stock_actual;
    end if;

    insert into public.ventas (cliente_id, producto_id, cantidad, precio_unitario, total)
    values (p_cliente_id, p_producto_id, p_cantidad, v_prod.precio_venta,
            round(v_prod.precio_venta * p_cantidad, 2))
    returning id into v_id;

    update public.productos
       set stock_actual = stock_actual - p_cantidad     -- la venta RESTA stock
     where id = p_producto_id;

    return v_id;
end $$;

create or replace function public.registrar_compra(
    p_proveedor_id   bigint,
    p_producto_id    bigint,
    p_cantidad       integer,
    p_costo_unitario numeric
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_id bigint;
begin
    if p_cantidad is null or p_cantidad <= 0 then
        raise exception 'La cantidad debe ser mayor a 0.';
    end if;
    if p_costo_unitario is null or p_costo_unitario < 0 then
        raise exception 'El costo no puede ser negativo.';
    end if;

    perform 1 from public.productos where id = p_producto_id for update;
    if not found then
        raise exception 'Producto no encontrado.';
    end if;
    if not exists (select 1 from public.proveedores where id = p_proveedor_id) then
        raise exception 'Selecciona un proveedor válido.';
    end if;

    insert into public.compras (proveedor_id, producto_id, cantidad, costo_unitario, total)
    values (p_proveedor_id, p_producto_id, p_cantidad, round(p_costo_unitario, 2),
            round(p_costo_unitario * p_cantidad, 2))
    returning id into v_id;

    update public.productos
       set stock_actual = stock_actual + p_cantidad,    -- la compra SUMA stock
           costo_compra = round(p_costo_unitario, 2)    -- último costo como referencia
     where id = p_producto_id;

    return v_id;
end $$;

-- Solo usuarios con sesión pueden llamar a las funciones (no el rol anónimo)
revoke all on function public.registrar_venta(bigint, bigint, integer)          from public, anon;
revoke all on function public.registrar_compra(bigint, bigint, integer, numeric) from public, anon;
grant execute on function public.registrar_venta(bigint, bigint, integer)          to authenticated;
grant execute on function public.registrar_compra(bigint, bigint, integer, numeric) to authenticated;

-- ─── Vista de movimientos (ventas + compras) para el botón "Movimientos" ────
-- security_invoker = la vista respeta RLS del usuario que consulta.

create or replace view public.vw_movimientos
with (security_invoker = true) as
select 'venta'::text as tipo, v.id, v.fecha_hora, p.nombre as producto, v.cantidad,
       v.precio_unitario as valor_unitario, v.total,
       c.nombre as cliente, pr.nombre as proveedor
  from public.ventas v
  join public.productos p       on p.id  = v.producto_id
  join public.clientes  c       on c.id  = v.cliente_id
  left join public.proveedores pr on pr.id = p.proveedor_id
union all
select 'compra'::text, co.id, co.fecha_hora, p.nombre, co.cantidad,
       co.costo_unitario, co.total,
       null::text, pr.nombre
  from public.compras co
  join public.productos   p  on p.id  = co.producto_id
  join public.proveedores pr on pr.id = co.proveedor_id;

revoke all on public.vw_movimientos from anon;
grant select on public.vw_movimientos to authenticated;
