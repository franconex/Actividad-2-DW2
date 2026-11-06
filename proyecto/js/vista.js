/* =========================================================
   VISTA: todo lo que se muestra en pantalla
   ========================================================= */

// ---------- Campo del formulario ----------
// Une un control (input, select o textarea) con sus reglas.
class Campo {
  #control;
  #reglas;
  #textoError;

  constructor(control, reglas) {
    this.#control = control;
    this.#reglas = reglas;
    this.#textoError = control.closest('.campo').querySelector('.texto-error');
  }

  get control() { return this.#control; }
  get nombre() { return this.#control.name; }
  get valor() { return this.#control.value.trim(); }
  set valor(nuevoValor) { this.#control.value = nuevoValor; }

  // true si el campo ya fue revisado al menos una vez.
  get fueRevisado() {
    return this.#control.classList.contains('correcto') || this.#control.classList.contains('incorrecto');
  }

  // Revisa las reglas en orden y muestra el primer error encontrado.
  validar() {
    const reglaFallida = this.#reglas.find(regla => !regla.cumple(this.valor));
    this.#control.classList.toggle('incorrecto', Boolean(reglaFallida));
    this.#control.classList.toggle('correcto', !reglaFallida);
    this.#textoError.textContent = reglaFallida ? reglaFallida.mensajeError : '';
    return !reglaFallida;
  }

  // Deja el campo vacío y sin colores.
  limpiar() {
    this.#control.value = '';
    this.#control.classList.remove('correcto', 'incorrecto');
    this.#textoError.textContent = '';
  }
}

// ---------- Ventana (modal base) ----------
// Se cierra con la tecla Esc, con los botones [data-cerrar] o con clic afuera.
class Ventana {
  #fondo;

  constructor(fondo) {
    this.#fondo = fondo;

    // Mouse: clic en el fondo oscuro (fuera del cuadro) cierra la ventana.
    fondo.addEventListener('mousedown', evento => {
      if (evento.target === fondo) this.cerrar();
    });

    // Mouse: botones con el atributo data-cerrar (X y Cancelar).
    fondo.querySelectorAll('[data-cerrar]').forEach(boton => {
      boton.addEventListener('click', () => this.cerrar());
    });

    // Teclado: Esc cierra solo la ventana que está encima.
    document.addEventListener('keydown', evento => {
      if (evento.key === 'Escape' && this.estaEncima) this.cerrar();
    });
  }

  get fondo() { return this.#fondo; }

  // true si es la última ventana abierta (la que se ve al frente).
  get estaEncima() {
    const abiertas = document.querySelectorAll('.ventana-fondo:not([hidden])');
    return abiertas[abiertas.length - 1] === this.#fondo;
  }

  get estaAbierta() {
    return !this.#fondo.hidden;
  }

  abrir() {
    this.#fondo.hidden = false;
  }

  cerrar() {
    this.#fondo.hidden = true;
  }
}

// ---------- Ventana de confirmación (hereda de Ventana) ----------
// Pregunta "¿Está seguro?" y devuelve true (Sí) o false (No).
class VentanaConfirmacion extends Ventana {
  #responder = null;

  constructor(fondo) {
    super(fondo);
    fondo.querySelector('[data-aceptar]').addEventListener('click', () => this.#terminar(true));
  }

  // Devuelve una promesa que se resuelve cuando el usuario elige.
  preguntar(titulo, mensaje) {
    this.fondo.querySelector('.ventana-titulo').textContent = titulo;
    this.fondo.querySelector('.ventana-texto').textContent = mensaje;
    this.abrir();
    this.fondo.querySelector('[data-aceptar]').focus();
    return new Promise(resolver => (this.#responder = resolver));
  }

  // Cerrar sin aceptar (Esc, Cancelar o clic afuera) cuenta como "No".
  cerrar() {
    super.cerrar();
    this.#terminar(false);
  }

  #terminar(respuesta) {
    if (!this.#responder) return;
    const responder = this.#responder;
    this.#responder = null;
    super.cerrar();
    responder(respuesta);
  }
}

// ---------- Ventana de mensaje temporal (hereda de Ventana) ----------
// Muestra un aviso (éxito, error o aviso) y se cierra sola.
class VentanaMensaje extends Ventana {
  static ICONOS = { exito: '✓', error: '✕', aviso: '!' };
  #temporizador;

  mostrar(tipo, titulo, mensaje, duracion = 2000) {
    const icono = this.fondo.querySelector('.icono-mensaje');
    icono.className = `icono-mensaje ${tipo}`;
    icono.textContent = VentanaMensaje.ICONOS[tipo];
    this.fondo.querySelector('.ventana-titulo').textContent = titulo;
    this.fondo.querySelector('.ventana-texto').textContent = mensaje;
    this.abrir();

    clearTimeout(this.#temporizador);
    this.#temporizador = setTimeout(() => this.cerrar(), duracion);
  }
}

// ---------- Tabla de productos ----------
class TablaProductos {
  #cuerpoTabla;
  #acciones; // { editar(codigo), eliminar(codigo) }

  constructor(cuerpoTabla, acciones) {
    this.#cuerpoTabla = cuerpoTabla;
    this.#acciones = acciones;

    // Mouse: un solo evento para todos los botones (delegación de eventos).
    cuerpoTabla.addEventListener('click', evento => {
      const boton = evento.target.closest('button[data-accion]');
      if (!boton) return;
      const codigo = boton.closest('tr').dataset.codigo;
      this.#acciones[boton.dataset.accion](codigo);
    });

    // Mouse: doble clic sobre una fila para editarla.
    cuerpoTabla.addEventListener('dblclick', evento => {
      const fila = evento.target.closest('tr[data-codigo]');
      if (fila) this.#acciones.editar(fila.dataset.codigo);
    });
  }

  mostrar(productos) {
    this.#cuerpoTabla.innerHTML = '';

    if (productos.length === 0) {
      this.#cuerpoTabla.innerHTML = '<tr><td colspan="7" class="tabla-vacia">No hay productos para mostrar.</td></tr>';
      return;
    }

    productos.forEach(producto => {
      const fila = this.#cuerpoTabla.insertRow();
      fila.dataset.codigo = producto.codigo;

      const columnas = [
        producto.codigo,
        producto.nombre,
        producto.categoria,
        formatearMoneda(producto.precio),
        producto.stock,
        formatearMoneda(producto.valorTotal)
      ];
      // textContent evita que el texto escrito se interprete como HTML.
      columnas.forEach(texto => (fila.insertCell().textContent = texto));

      fila.insertCell().innerHTML = `
        <button type="button" class="boton-tabla" data-accion="editar">Editar</button>
        <button type="button" class="boton-tabla peligro" data-accion="eliminar">Eliminar</button>`;
    });
  }
}

// Convierte un número a moneda boliviana: Bs 1.250,00
function formatearMoneda(monto) {
  return 'Bs ' + monto.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
