-- =========================================================
-- Base de datos: Actividad 2 (PostgreSQL en Neon)
-- Nombre interno de la base: actividad_2
-- =========================================================

-- Tabla de categorías (catálogo)
CREATE TABLE IF NOT EXISTS categorias (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(30) UNIQUE NOT NULL
);

INSERT INTO categorias (nombre) VALUES
  ('Electrónica'), ('Alimentos'), ('Bebidas'), ('Limpieza'), ('Papelería'), ('Otros')
ON CONFLICT DO NOTHING;

-- Tabla de productos (las mismas reglas que valida el formulario)
CREATE TABLE IF NOT EXISTS productos (
  codigo         VARCHAR(8)    PRIMARY KEY CHECK (codigo ~ '^PRD-[0-9]{4}$'),
  nombre         VARCHAR(60)   NOT NULL CHECK (char_length(nombre) BETWEEN 3 AND 60),
  categoria_id   INT           NOT NULL REFERENCES categorias(id),
  precio         NUMERIC(10,2) NOT NULL CHECK (precio BETWEEN 0.10 AND 100000),
  stock          INT           NOT NULL CHECK (stock BETWEEN 0 AND 10000),
  descripcion    VARCHAR(200)  NOT NULL CHECK (char_length(descripcion) BETWEEN 10 AND 200),
  creado_en      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Datos de ejemplo
INSERT INTO productos (codigo, nombre, categoria_id, precio, stock, descripcion) VALUES
  ('PRD-0001', 'Laptop Lenovo IdeaPad 3', (SELECT id FROM categorias WHERE nombre = 'Electrónica'), 4500.00, 8,   'Laptop de 15.6 pulgadas, 8 GB RAM, 512 GB SSD'),
  ('PRD-0002', 'Cuaderno universitario',  (SELECT id FROM categorias WHERE nombre = 'Papelería'),   15.50,   120, 'Cuaderno de 100 hojas cuadriculadas tapa dura'),
  ('PRD-0003', 'Agua mineral 2L',         (SELECT id FROM categorias WHERE nombre = 'Bebidas'),     8.00,    60,  'Botella de agua mineral sin gas de 2 litros')
ON CONFLICT DO NOTHING;
