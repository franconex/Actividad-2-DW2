/* =========================================================
   SERVIDOR: API REST que conecta la página con la base de
   datos PostgreSQL "Actividad 2" (Neon)
   ========================================================= */
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Copie .env.example a .env y coloque su cadena de conexión.');
  process.exit(1);
}

const baseDatos = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();

app.use(express.json());
// Solo se publican los archivos de la página (no .env ni el código del servidor).
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Consulta base: productos con el nombre de su categoría.
const SELECCIONAR_PRODUCTOS = `
  SELECT p.codigo, p.nombre, c.nombre AS categoria, p.precio::float AS precio,
         p.stock, p.descripcion
  FROM productos p JOIN categorias c ON c.id = p.categoria_id`;

// Validación en el servidor (las mismas reglas que el formulario).
function validarProducto(datos) {
  const errores = [];
  const { codigo, nombre, categoria, precio, stock, descripcion } = datos ?? {};
  if (!/^PRD-\d{4}$/.test(codigo ?? '')) errores.push('Código inválido (PRD-0001).');
  if (typeof nombre !== 'string' || nombre.trim().length < 3 || nombre.trim().length > 60) errores.push('Nombre: 3 a 60 caracteres.');
  if (!categoria) errores.push('Categoría obligatoria.');
  if (!/^\d+(\.\d{1,2})?$/.test(String(precio)) || precio < 0.1 || precio > 100000) errores.push('Precio entre 0.10 y 100 000.');
  if (!/^\d+$/.test(String(stock)) || stock > 10000) errores.push('Stock entero entre 0 y 10 000.');
  if (typeof descripcion !== 'string' || descripcion.trim().length < 10 || descripcion.trim().length > 200) errores.push('Descripción: 10 a 200 caracteres.');
  return errores;
}

// GET /api/categorias → lista de categorías
app.get('/api/categorias', async (req, res, next) => {
  try {
    const { rows } = await baseDatos.query('SELECT nombre FROM categorias ORDER BY id');
    res.json(rows.map(fila => fila.nombre));
  } catch (error) { next(error); }
});

// GET /api/productos → todos los productos
app.get('/api/productos', async (req, res, next) => {
  try {
    const { rows } = await baseDatos.query(`${SELECCIONAR_PRODUCTOS} ORDER BY p.codigo`);
    res.json(rows);
  } catch (error) { next(error); }
});

// PUT /api/productos/:codigo → crea o actualiza (upsert)
app.put('/api/productos/:codigo', async (req, res, next) => {
  const datos = { ...req.body, codigo: req.params.codigo.toUpperCase() };
  const errores = validarProducto(datos);
  if (errores.length) return res.status(400).json({ error: errores.join(' ') });

  try {
    const { rows, rowCount } = await baseDatos.query(
      `INSERT INTO productos (codigo, nombre, categoria_id, precio, stock, descripcion)
       SELECT $1, $2, c.id, $4, $5, $6 FROM categorias c WHERE c.nombre = $3
       ON CONFLICT (codigo) DO UPDATE SET
         nombre = EXCLUDED.nombre, categoria_id = EXCLUDED.categoria_id,
         precio = EXCLUDED.precio, stock = EXCLUDED.stock,
         descripcion = EXCLUDED.descripcion, actualizado_en = now()
       RETURNING (xmax = 0) AS es_nuevo`,
      [datos.codigo, datos.nombre.trim(), datos.categoria, Number(datos.precio), Number(datos.stock), datos.descripcion.trim()]
    );
    if (rowCount === 0) return res.status(400).json({ error: 'La categoría no existe.' });
    res.status(rows[0].es_nuevo ? 201 : 200).json({ ok: true });
  } catch (error) { next(error); }
});

// DELETE /api/productos/:codigo → elimina
app.delete('/api/productos/:codigo', async (req, res, next) => {
  try {
    const { rowCount } = await baseDatos.query('DELETE FROM productos WHERE codigo = $1', [req.params.codigo.toUpperCase()]);
    if (rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

// Manejo de errores de la base de datos
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Error en la base de datos.' });
});

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => console.log(`Inventario en http://localhost:${PUERTO}`));
