/* =========================================================
   MODELO: datos del sistema y reglas de validación
   ========================================================= */

// ---------- Producto ----------
class Producto {
  // Campos privados (#): solo se usan dentro de la clase (encapsulamiento).
  #codigo;
  #nombre;
  #categoria;
  #precio;
  #stock;
  #descripcion;

  constructor({ codigo, nombre, categoria, precio, stock, descripcion }) {
    this.#codigo = codigo.toUpperCase();
    this.#nombre = nombre.trim();
    this.#categoria = categoria;
    this.#precio = Number(precio);
    this.#stock = Number(stock);
    this.#descripcion = (descripcion ?? '').trim();
  }

  // Getters: permiten leer los datos sin poder cambiarlos desde fuera.
  get codigo() { return this.#codigo; }
  get nombre() { return this.#nombre; }
  get categoria() { return this.#categoria; }
  get precio() { return this.#precio; }
  get stock() { return this.#stock; }
  get descripcion() { return this.#descripcion; }

  // Valor total del producto en el inventario.
  get valorTotal() {
    return this.#precio * this.#stock;
  }

  // Devuelve los datos en un objeto simple (para guardar o editar).
  obtenerDatos() {
    return {
      codigo: this.#codigo,
      nombre: this.#nombre,
      categoria: this.#categoria,
      precio: this.#precio,
      stock: this.#stock,
      descripcion: this.#descripcion
    };
  }
}

// ---------- Reglas de validación ----------

// Clase abstracta: no se puede crear directamente, solo sus hijas.
class Regla {
  constructor(mensajeError) {
    if (new.target === Regla) {
      throw new Error('Regla es abstracta: use una subclase.');
    }
    this.mensajeError = mensajeError;
  }

  // Cada subclase escribe su propia versión (polimorfismo).
  cumple(valor) {
    throw new Error('El método cumple() debe implementarse en la subclase.');
  }
}

// El campo no puede quedar vacío.
class ReglaObligatorio extends Regla {
  cumple(valor) {
    return valor !== '';
  }
}

// El texto debe tener entre "minimo" y "maximo" caracteres.
class ReglaLongitud extends Regla {
  constructor(minimo, maximo, mensajeError) {
    super(mensajeError);
    this.minimo = minimo;
    this.maximo = maximo;
  }

  cumple(valor) {
    return valor.length >= this.minimo && valor.length <= this.maximo;
  }
}

// El texto debe respetar un formato (expresión regular).
class ReglaFormato extends Regla {
  constructor(patron, mensajeError) {
    super(mensajeError);
    this.patron = patron;
  }

  cumple(valor) {
    return this.patron.test(valor);
  }
}

// El número debe estar entre "minimo" y "maximo".
class ReglaRango extends Regla {
  constructor(minimo, maximo, mensajeError) {
    super(mensajeError);
    this.minimo = minimo;
    this.maximo = maximo;
  }

  cumple(valor) {
    const numero = Number(valor);
    return !isNaN(numero) && numero >= this.minimo && numero <= this.maximo;
  }
}

// Regla con una condición propia (ej.: que el código no se repita).
class ReglaPersonalizada extends Regla {
  constructor(condicion, mensajeError) {
    super(mensajeError);
    this.condicion = condicion;
  }

  cumple(valor) {
    return this.condicion(valor);
  }
}

// ---------- Inventario ----------
// Los datos se guardan en la base de datos PostgreSQL "Actividad 2"
// a través de la API del servidor (servidor.js).
class Inventario {
  #listaProductos = [];
  #urlApi = '/api/productos';

  // Envía una petición a la API y devuelve la respuesta en JSON.
  async #pedir(url, opciones = {}) {
    const respuesta = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opciones
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error || 'No se pudo conectar con la base de datos.');
    return datos;
  }

  // Lee los productos guardados en la base de datos.
  async cargar() {
    const filas = await this.#pedir(this.#urlApi);
    this.#listaProductos = filas.map(datos => new Producto(datos));
  }

  get productos() {
    return [...this.#listaProductos];
  }

  buscarPorCodigo(codigo) {
    return this.#listaProductos.find(producto => producto.codigo === codigo);
  }

  existeCodigo(codigo) {
    return Boolean(this.buscarPorCodigo(codigo));
  }

  // Agrega el producto, o lo reemplaza si el código ya existe.
  // Primero guarda en la base de datos; si funciona, actualiza la lista local.
  async guardarProducto(producto) {
    await this.#pedir(`${this.#urlApi}/${producto.codigo}`, {
      method: 'PUT',
      body: JSON.stringify(producto.obtenerDatos())
    });
    const posicion = this.#listaProductos.findIndex(p => p.codigo === producto.codigo);
    if (posicion >= 0) {
      this.#listaProductos[posicion] = producto;
    } else {
      this.#listaProductos.push(producto);
    }
  }

  async eliminarProducto(codigo) {
    await this.#pedir(`${this.#urlApi}/${codigo}`, { method: 'DELETE' });
    this.#listaProductos = this.#listaProductos.filter(producto => producto.codigo !== codigo);
  }

  // Genera el siguiente código libre: PRD-0001, PRD-0002...
  generarCodigo() {
    const numeros = this.#listaProductos.map(producto => Number(producto.codigo.slice(4)));
    const siguienteNumero = Math.max(0, ...numeros) + 1;
    return 'PRD-' + String(siguienteNumero).padStart(4, '0');
  }
}
