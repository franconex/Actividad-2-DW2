/* =========================================================
   CONTROLADOR: eventos de teclado/mouse y conexión entre
   el modelo (datos) y la vista (pantalla)
   ========================================================= */

// ---------- Controlador del formulario ----------
class ControladorFormulario {
  #formulario;
  #inventario;
  #ventana;
  #alGuardar;           // función que se ejecuta después de guardar
  #alFallar;            // función que se ejecuta si hay errores
  #campos = [];
  #codigoEnEdicion = null; // null = producto nuevo
  #guardando = false;      // true mientras se espera a la base de datos

  constructor(formulario, inventario, ventana, { alGuardar, alFallar }) {
    this.#formulario = formulario;
    this.#inventario = inventario;
    this.#ventana = ventana;
    this.#alGuardar = alGuardar;
    this.#alFallar = alFallar;

    this.#crearCampos();
    this.#registrarEventos();
  }

  // Asigna las reglas a cada campo (en el mismo orden que en pantalla).
  #crearCampos() {
    const controles = this.#formulario.elements;

    this.#campos = [
      new Campo(controles.codigo, [
        new ReglaObligatorio('El código es obligatorio.'),
        new ReglaFormato(/^PRD-\d{4}$/, 'Use el formato PRD-0001.'),
        new ReglaPersonalizada(
          codigo => codigo === this.#codigoEnEdicion || !this.#inventario.existeCodigo(codigo),
          'Ya existe un producto con este código.'
        )
      ]),
      new Campo(controles.categoria, [
        new ReglaObligatorio('Seleccione una categoría.')
      ]),
      new Campo(controles.nombre, [
        new ReglaObligatorio('El nombre es obligatorio.'),
        new ReglaLongitud(3, 60, 'Debe tener entre 3 y 60 caracteres.')
      ]),
      new Campo(controles.precio, [
        new ReglaObligatorio('El precio es obligatorio.'),
        new ReglaFormato(/^\d+(\.\d{1,2})?$/, 'Máximo 2 decimales (ej. 25.50).'),
        new ReglaRango(0.1, 100000, 'Debe estar entre 0.10 y 100 000.')
      ]),
      new Campo(controles.stock, [
        new ReglaObligatorio('El stock es obligatorio.'),
        new ReglaFormato(/^\d+$/, 'Solo números enteros.'),
        new ReglaRango(0, 10000, 'Debe estar entre 0 y 10 000.')
      ]),
      new Campo(controles.descripcion, [
        new ReglaObligatorio('La descripción es obligatoria.'),
        new ReglaLongitud(10, 200, 'Debe tener entre 10 y 200 caracteres.')
      ])
    ];
  }

  #registrarEventos() {
    // Teclado: bloquea caracteres no permitidos antes de que se escriban.
    this.#formulario.addEventListener('beforeinput', evento => this.#filtrarTeclas(evento));

    // Teclado: Enter avanza al siguiente campo y Ctrl + S guarda.
    this.#formulario.addEventListener('keydown', evento => this.#atajosTeclado(evento));

    // Al escribir: código en mayúsculas, contador y validación en vivo.
    this.#formulario.addEventListener('input', evento => {
      const campo = this.#buscarCampo(evento.target);
      if (!campo) return;
      if (campo.nombre === 'codigo') campo.valor = campo.control.value.toUpperCase();
      if (campo.nombre === 'descripcion') this.#actualizarContador();
      if (campo.fueRevisado) campo.validar();
    });

    // Al salir de un campo que tiene datos, se valida.
    this.#formulario.addEventListener('focusout', evento => {
      const campo = this.#buscarCampo(evento.target);
      if (campo && campo.valor !== '') campo.validar();
    });

    // La lista de categorías se valida apenas cambia.
    this.#formulario.addEventListener('change', evento => {
      if (evento.target.name === 'categoria') this.#buscarCampo(evento.target).validar();
    });

    // Mouse (clic en Guardar) o Enter en el botón.
    this.#formulario.addEventListener('submit', evento => {
      evento.preventDefault(); // evita que la página se recargue
      this.guardar();
    });
  }

  // Solo deja escribir números (y un punto decimal en el precio).
  #filtrarTeclas(evento) {
    const tipoPermitido = evento.target.dataset.solo; // "entero" o "decimal"
    if (!tipoPermitido || !evento.data) return;

    const esDigito = /^\d+$/.test(evento.data);
    const esPuntoValido = evento.data === '.' && tipoPermitido === 'decimal'
      && !evento.target.value.includes('.');

    if (!esDigito && !esPuntoValido) evento.preventDefault();
  }

  #atajosTeclado(evento) {
    // Ctrl + S: guarda (y evita "Guardar página" del navegador).
    if (evento.ctrlKey && evento.key.toLowerCase() === 's') {
      evento.preventDefault();
      this.guardar();
      return;
    }

    // Enter: pasa al siguiente campo (en la descripción hace salto de línea).
    if (evento.key === 'Enter' && evento.target.matches('input, select')) {
      evento.preventDefault();
      const posicion = this.#campos.findIndex(campo => campo.control === evento.target);
      this.#campos[posicion + 1]?.control.focus();
    }
  }

  // Abre la ventana vacía para registrar un producto nuevo.
  nuevo() {
    this.#limpiarCampos();
    this.#codigoEnEdicion = null;
    this.#formulario.elements.codigo.value = this.#inventario.generarCodigo();
    this.#formulario.elements.codigo.readOnly = false;
    this.#abrirVentana('Nuevo producto');
  }

  // Abre la ventana con los datos de un producto existente.
  editar(codigo) {
    const producto = this.#inventario.buscarPorCodigo(codigo);
    if (!producto) return;

    this.#limpiarCampos();
    this.#codigoEnEdicion = codigo;
    const datos = producto.obtenerDatos();
    this.#campos.forEach(campo => (campo.valor = datos[campo.nombre]));
    this.#formulario.elements.codigo.readOnly = true; // el código no se cambia al editar
    this.#actualizarContador();
    this.#abrirVentana('Editar producto');
  }

  // Valida todo; si está correcto, guarda el producto y cierra la ventana.
  async guardar() {
    if (this.#guardando) return; // evita guardar dos veces seguidas

    // map (y no every) para que se muestren todos los errores a la vez.
    const resultados = this.#campos.map(campo => campo.validar());

    if (resultados.includes(false)) {
      this.#campos[resultados.indexOf(false)].control.focus();
      this.#alFallar();
      return;
    }

    const datos = {};
    this.#campos.forEach(campo => (datos[campo.nombre] = campo.valor));
    const producto = new Producto(datos);

    // Se guarda en la base de datos; si falla, la ventana queda abierta.
    this.#guardando = true;
    try {
      await this.#inventario.guardarProducto(producto);
    } catch (error) {
      this.#alFallar('Error al guardar', error.message);
      return;
    } finally {
      this.#guardando = false;
    }

    this.#ventana.cerrar();
    this.#alGuardar(producto, this.#codigoEnEdicion !== null);
  }

  #abrirVentana(titulo) {
    this.#ventana.fondo.querySelector('.ventana-titulo').textContent = titulo;
    this.#ventana.abrir();
    this.#formulario.elements.nombre.focus();
  }

  #limpiarCampos() {
    this.#campos.forEach(campo => campo.limpiar());
    this.#actualizarContador();
  }

  #buscarCampo(control) {
    return this.#campos.find(campo => campo.control === control);
  }

  #actualizarContador() {
    const cantidad = this.#formulario.elements.descripcion.value.length;
    this.#formulario.querySelector('.contador').textContent = `${cantidad}/200`;
  }
}

// ---------- Aplicación: crea los objetos y los conecta ----------
class Aplicacion {
  #inventario = new Inventario();
  #buscador = document.getElementById('buscador');
  #ventanaConfirmacion = new VentanaConfirmacion(document.getElementById('ventana-confirmacion'));
  #ventanaMensaje = new VentanaMensaje(document.getElementById('ventana-mensaje'));
  #ventanaFormulario = new Ventana(document.getElementById('ventana-formulario'));
  #tabla;
  #controladorFormulario;

  constructor() {
    this.#tabla = new TablaProductos(document.getElementById('cuerpo-tabla'), {
      editar: codigo => this.#controladorFormulario.editar(codigo),
      eliminar: codigo => this.#eliminarProducto(codigo)
    });

    this.#controladorFormulario = new ControladorFormulario(
      document.getElementById('formulario-producto'),
      this.#inventario,
      this.#ventanaFormulario,
      {
        alGuardar: (producto, fueEdicion) => this.#productoGuardado(producto, fueEdicion),
        alFallar: (titulo = 'Datos incorrectos', mensaje = 'Revise los campos marcados en rojo.') =>
          this.#ventanaMensaje.mostrar('error', titulo, mensaje, 3000)
      }
    );

    this.#registrarEventos();
    this.#cargarDatos();
  }

  // Trae los productos de la base de datos y los muestra.
  async #cargarDatos() {
    document.getElementById('total-productos').textContent = 'Cargando...';
    try {
      await this.#inventario.cargar();
    } catch (error) {
      this.#ventanaMensaje.mostrar('error', 'Sin conexión', error.message, 4000);
    }
    this.#actualizarTabla();
  }

  #registrarEventos() {
    // Mouse: botón "Nuevo producto".
    document.getElementById('boton-nuevo').addEventListener('click', () => this.#controladorFormulario.nuevo());

    // Teclado: filtra la tabla mientras se escribe en el buscador.
    this.#buscador.addEventListener('input', () => this.#actualizarTabla());

    // Teclado: Alt + C abre un producto nuevo desde cualquier parte.
    document.addEventListener('keydown', evento => {
      if (evento.altKey && evento.key.toLowerCase() === 'c' && !this.#ventanaFormulario.estaAbierta) {
        evento.preventDefault();
        this.#controladorFormulario.nuevo();
      }
    });
  }

  #productoGuardado(producto, fueEdicion) {
    this.#actualizarTabla();
    if (fueEdicion) {
      this.#ventanaMensaje.mostrar('exito', 'Producto actualizado', `${producto.nombre} se actualizó correctamente.`);
    } else {
      this.#ventanaMensaje.mostrar('exito', 'Producto agregado', `${producto.nombre} se registró correctamente.`);
    }
  }

  // Pide confirmación antes de borrar.
  async #eliminarProducto(codigo) {
    const producto = this.#inventario.buscarPorCodigo(codigo);
    const confirmado = await this.#ventanaConfirmacion.preguntar(
      '¿Eliminar producto?',
      `Se eliminará "${producto.nombre}" (${codigo}). Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    try {
      await this.#inventario.eliminarProducto(codigo);
    } catch (error) {
      this.#ventanaMensaje.mostrar('error', 'Error al eliminar', error.message, 3000);
      return;
    }
    this.#actualizarTabla();
    this.#ventanaMensaje.mostrar('exito', 'Producto eliminado', `${producto.nombre} se eliminó correctamente.`);
  }

  // Muestra en la tabla los productos que coinciden con la búsqueda.
  #actualizarTabla() {
    const textoBuscado = this.#buscador.value.trim().toLowerCase();
    const productosFiltrados = this.#inventario.productos.filter(producto =>
      `${producto.codigo} ${producto.nombre} ${producto.categoria}`.toLowerCase().includes(textoBuscado)
    );
    this.#tabla.mostrar(productosFiltrados);
    document.getElementById('total-productos').textContent = `${this.#inventario.productos.length} registrados`;
  }
}

// Inicia la aplicación cuando la página termina de cargar.
document.addEventListener('DOMContentLoaded', () => new Aplicacion());
