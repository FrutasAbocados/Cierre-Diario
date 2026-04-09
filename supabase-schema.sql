-- ============================================================
-- ABOCADOS — Esquema de base de datos para Supabase
-- ============================================================
-- Cómo usar:
-- 1. En Supabase, ve al menú izquierdo: SQL Editor
-- 2. Click en "New query"
-- 3. Copia y pega TODO este archivo
-- 4. Click en "Run" (abajo a la derecha)
-- 5. Deberías ver "Success. No rows returned"
-- ============================================================

-- Tabla: cierres diarios
create table if not exists cierres (
  fecha date primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  dia_semana text,
  semana int,
  efectivo numeric default 0,
  tarjeta numeric default 0,
  otros_efectivo numeric default 0,
  otros_tarjeta numeric default 0,
  total_cobrado numeric default 0,
  compras numeric default 0,
  vehiculos numeric default 0,
  otras_compras numeric default 0,
  otros numeric default 0,
  total_gastos numeric default 0,
  resultado numeric default 0,
  deuda_generada numeric default 0,
  deuda_cobrada numeric default 0,
  deuda_acum numeric default 0,
  pedidos int default 0,
  clientes_nuevos int default 0,
  caja_fisica numeric default 0,
  observaciones text,
  updated_at timestamptz default now()
);

-- Tabla: deudores (clientes que deben dinero)
create table if not exists deudores (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  cliente text not null,
  concepto text,
  importe numeric not null,
  fecha date not null,
  pagado boolean default false,
  fecha_pago date,
  created_at timestamptz default now()
);

-- Tabla: proveedores (gastos detallados)
create table if not exists proveedores (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  nombre text not null,
  categoria text,
  importe numeric not null,
  fecha date not null
);

-- Tabla: sueldos (movimientos de empleados)
create table if not exists sueldos (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  empleado text not null,
  tipo text,
  importe numeric not null,
  fecha date not null
);

-- Tabla: configuración (key-value por usuario)
create table if not exists config (
  user_id uuid references auth.users(id) on delete cascade not null,
  key text not null,
  value jsonb,
  primary key (user_id, key)
);

-- ============================================================
-- ROW LEVEL SECURITY — cada usuario solo ve sus datos
-- ============================================================
alter table cierres enable row level security;
alter table deudores enable row level security;
alter table proveedores enable row level security;
alter table sueldos enable row level security;
alter table config enable row level security;

-- Políticas: cada usuario solo accede a sus propias filas
create policy "users own cierres" on cierres for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own deudores" on deudores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own proveedores" on proveedores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own sueldos" on sueldos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own config" on config for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- REALTIME — para que los cambios se vean al instante en otros dispositivos
-- ============================================================
alter publication supabase_realtime add table cierres;
alter publication supabase_realtime add table deudores;
alter publication supabase_realtime add table proveedores;
alter publication supabase_realtime add table sueldos;
alter publication supabase_realtime add table config;

-- ============================================================
-- LISTO. Ahora ve a Authentication → Providers y verifica que
-- "Email" esté habilitado (viene activado por defecto).
-- ============================================================
