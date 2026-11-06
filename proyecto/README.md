# Inventario de Productos — Validación con POO, eventos en JavaScript y base de datos

Los productos se guardan en la base de datos **PostgreSQL "Actividad 2"** (Neon, base `actividad_2`).

## Cómo ejecutarlo

1. Instalar [Node.js](https://nodejs.org) 20.6 o superior.
2. En la carpeta `proyecto`, ejecutar:
   ```
   npm install
   npm start
   ```
3. Abrir **http://localhost:3000** en el navegador.

> El archivo `.env` contiene la cadena de conexión (`DATABASE_URL`). Si se usa otra base, copiar `.env.example` a `.env` y ejecutar `base_datos.sql` para crear las tablas.

## Base de datos

| Tabla | Columnas |
|---|---|
| `categorias` | `id` (PK), `nombre` (único) |
| `productos` | `codigo` (PK, `PRD-0001`), `nombre`, `categoria_id` (FK → categorias), `precio`, `stock`, `descripcion`, `creado_en`, `actualizado_en` |

Las tablas tienen restricciones `CHECK` con las mismas reglas del formulario, así los datos se validan en **3 niveles**: navegador (clases `Regla`), servidor (`servidor.js`) y base de datos.

## API REST (servidor.js)

| Método | Ruta | Acción |
|---|---|---|
| GET | `/api/productos` | Listar productos |
| PUT | `/api/productos/:codigo` | Crear o actualizar |
| DELETE | `/api/productos/:codigo` | Eliminar |
| GET | `/api/categorias` | Listar categorías |

## Estructura (patrón MVC)

```
proyecto/
├── servidor.js         API REST (Express) conectada a PostgreSQL
├── base_datos.sql      Script de creación de tablas y datos de ejemplo
├── index.html          Página y las 3 ventanas (formulario, confirmación, mensaje)
├── css/estilos.css     Diseño
└── js/
    ├── modelo.js       Producto, Regla (abstracta) y sus 5 subclases, Inventario (guarda en la base de datos mediante fetch)
    ├── vista.js        Campo, Ventana, VentanaConfirmacion, VentanaMensaje, TablaProductos
    └── controlador.js  ControladorFormulario y Aplicacion (eventos y conexión)
```

## Conceptos de POO aplicados

| Concepto | Dónde |
|---|---|
| Clases y objetos | Todas las clases del proyecto |
| Encapsulamiento (`#privado`, getters) | `Producto`, `Inventario`, `Campo`, `Ventana` |
| Abstracción (clase abstracta) | `Regla` no se puede instanciar |
| Herencia (`extends`, `super`) | 5 reglas heredan de `Regla`; `VentanaConfirmacion` y `VentanaMensaje` heredan de `Ventana` |
| Polimorfismo | Cada regla tiene su propio `cumple()`; `VentanaConfirmacion` sobrescribe `cerrar()` |
| Composición | `Aplicacion` crea y usa `Inventario`, `TablaProductos`, `ControladorFormulario` y las ventanas |

## Eventos usados

| Tipo | Evento | Uso |
|---|---|---|
| Teclado | `beforeinput` | Bloquea letras en precio y stock |
| Teclado | `keydown` | Enter = siguiente campo · Ctrl+S = guardar · Esc = cerrar ventana · Alt+C = nuevo |
| Teclado | `input` | Validación en vivo, contador, buscador, código en mayúsculas |
| Mouse | `click` | Nuevo producto, Guardar, Cancelar, Editar, Eliminar, Sí eliminar |
| Mouse | `dblclick` | Doble clic en una fila para editarla |
| Mouse | `mousedown` | Clic fuera de una ventana la cierra |
| Formulario | `focusout`, `change`, `submit` | Validar al salir del campo y al guardar |

## Ventanas temporales

- **Confirmación**: "¿Eliminar producto?" antes de borrar.
- **Mensajes que se cierran solos (2 s)**: Producto agregado · Producto actualizado · Producto eliminado · Datos incorrectos.
