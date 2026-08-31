-- ============================================================
-- KOROVKA · Esquema de base de datos
-- Pega este contenido en Supabase > SQL Editor y ejecuta
-- ============================================================

-- Extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PERFILES DE USUARIO ────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'operador' CHECK (rol IN ('admin', 'operador')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PRODUCTOS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  unidad TEXT DEFAULT 'kg',
  precio_base NUMERIC(10,2) NOT NULL DEFAULT 0,
  costo NUMERIC(10,2) DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CLIENTES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  rfc TEXT,
  direccion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PUNTOS DE DISTRIBUCIÓN ─────────────────────────────────
CREATE TABLE IF NOT EXISTS puntos_distribucion (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id),
  nombre TEXT NOT NULL,
  direccion TEXT,
  modelo TEXT NOT NULL DEFAULT 'directa' CHECK (modelo IN ('directa', 'consignacion')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── VENTAS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ventas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  folio TEXT UNIQUE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'directa' CHECK (tipo IN ('directa', 'consignacion_liquidacion')),
  cliente_id UUID REFERENCES clientes(id),
  punto_id UUID REFERENCES puntos_distribucion(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  iva NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada', 'cancelada')),
  notas TEXT,
  creado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ITEMS DE VENTA ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venta_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  cantidad NUMERIC(10,3) NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL
);

-- ─── ENTREGAS EN CONSIGNACIÓN ───────────────────────────────
CREATE TABLE IF NOT EXISTS consignacion_entregas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  folio TEXT UNIQUE NOT NULL,
  punto_id UUID REFERENCES puntos_distribucion(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa', 'liquidada', 'cancelada')),
  notas TEXT,
  creado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ITEMS DE ENTREGA ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS consignacion_entrega_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entrega_id UUID REFERENCES consignacion_entregas(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  cantidad NUMERIC(10,3) NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL
);

-- ─── LIQUIDACIONES DE CONSIGNACIÓN ──────────────────────────
CREATE TABLE IF NOT EXISTS consignacion_liquidaciones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entrega_id UUID REFERENCES consignacion_entregas(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo TEXT NOT NULL DEFAULT 'reporte_tienda' CHECK (metodo IN ('reporte_tienda', 'conteo_fisico')),
  venta_id UUID REFERENCES ventas(id),
  creado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ITEMS DE LIQUIDACIÓN ───────────────────────────────────
CREATE TABLE IF NOT EXISTS consignacion_liquidacion_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  liquidacion_id UUID REFERENCES consignacion_liquidaciones(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  cantidad_vendida NUMERIC(10,3) NOT NULL DEFAULT 0,
  cantidad_devuelta NUMERIC(10,3) NOT NULL DEFAULT 0,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ─── MOVIMIENTOS DE INVENTARIO ──────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  producto_id UUID REFERENCES productos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad NUMERIC(10,3) NOT NULL,
  concepto TEXT NOT NULL,
  referencia_id UUID,
  referencia_tipo TEXT,
  creado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CUENTAS POR COBRAR ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  venta_id UUID REFERENCES ventas(id),
  cliente_id UUID REFERENCES clientes(id),
  monto_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  monto_pagado NUMERIC(10,2) NOT NULL DEFAULT 0,
  fecha_vencimiento DATE,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'parcial', 'pagada', 'vencida')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE puntos_distribucion ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE consignacion_entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE consignacion_entrega_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE consignacion_liquidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE consignacion_liquidacion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_por_cobrar ENABLE ROW LEVEL SECURITY;

-- Políticas: usuarios autenticados tienen acceso completo
CREATE POLICY "auth" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth" ON productos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth" ON puntos_distribucion FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth" ON ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth" ON venta_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth" ON consignacion_entregas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth" ON consignacion_entrega_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth" ON consignacion_liquidaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth" ON consignacion_liquidacion_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth" ON movimientos_inventario FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth" ON cuentas_por_cobrar FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger: crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nombre, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'operador')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── DATOS INICIALES ────────────────────────────────────────
INSERT INTO productos (sku, nombre, unidad, precio_base, costo) VALUES
  ('QCH-1KG',  'Queso Chihuahua 1 kg',   'pieza', 180.00, 95.00),
  ('QCH-500G', 'Queso Chihuahua 500 g',  'pieza',  95.00, 50.00),
  ('QOA-1KG',  'Queso Oaxaca 1 kg',      'pieza', 165.00, 88.00),
  ('QOA-500G', 'Queso Oaxaca 500 g',     'pieza',  85.00, 46.00),
  ('QCR-1KG',  'Queso Crema 1 kg',       'pieza', 145.00, 75.00),
  ('CREM-1KG', 'Crema Ácida 1 kg',       'pieza', 120.00, 62.00)
ON CONFLICT (sku) DO NOTHING;
