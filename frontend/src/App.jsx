import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const PRODUCTOS_URL = `${API_URL}/productos`;
const initialProduct = {
  nombre: "",
  descripcion: "",
  precio: "",
  stock: "",
  categoria: "",
};
const pesos = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function App() {
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(initialProduct);
  const [idEditar, setIdEditar] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [carrito, setCarrito] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const resultado = useMemo(() => {
    if (window.location.pathname !== "/pago/resultado") return null;
    const parametros = new URLSearchParams(window.location.search);
    return {
      estado: parametros.get("estado") || "ERROR",
      mensaje: parametros.get("mensaje"),
    };
  }, []);

  const cargarProductos = async () => {
    setCargando(true);
    setError("");
    try {
      const { data } = await axios.get(PRODUCTOS_URL);
      setProductos(data);
    } catch (requestError) {
      console.error("Error al cargar productos:", requestError);
      setError("No fue posible cargar los productos. Comprueba que el backend esté iniciado.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarProductos();
  }, []);

  useEffect(() => {
    if (resultado?.estado === "ACEPTADO") setCarrito({});
  }, [resultado]);

  const limpiarFormulario = () => {
    setForm(initialProduct);
    setIdEditar(null);
  };

  const abrirCrear = () => {
    limpiarFormulario();
    setError("");
    setModalAbierto(true);
  };

  const editarProducto = async (id) => {
    setError("");
    try {
      const { data } = await axios.get(`${PRODUCTOS_URL}/${id}`);
      setForm({
        nombre: data.nombre,
        descripcion: data.descripcion,
        precio: data.precio,
        stock: data.stock,
        categoria: data.categoria,
      });
      setIdEditar(id);
      setModalAbierto(true);
    } catch (requestError) {
      console.error("Error al consultar producto:", requestError);
      setError("No fue posible consultar el producto para editarlo.");
    }
  };

  const cambiarCampo = (event) => {
    const { name, value } = event.target;
    setForm((actual) => ({ ...actual, [name]: value }));
  };

  const guardarProducto = async (event) => {
    event.preventDefault();
    setGuardando(true);
    setError("");
    const producto = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      precio: Number(form.precio),
      stock: Number(form.stock),
      categoria: form.categoria.trim(),
    };
    try {
      if (idEditar === null) {
        await axios.post(PRODUCTOS_URL, producto);
        setAviso("Producto creado correctamente.");
      } else {
        await axios.put(`${PRODUCTOS_URL}/${idEditar}`, producto);
        setAviso("Producto actualizado correctamente.");
      }
      setModalAbierto(false);
      limpiarFormulario();
      await cargarProductos();
    } catch (requestError) {
      console.error("Error al guardar producto:", requestError);
      setError("No fue posible guardar el producto. Revisa los datos e inténtalo otra vez.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarProducto = async (producto) => {
    if (!window.confirm(`¿Seguro que quieres eliminar "${producto.nombre}"?`)) return;
    setError("");
    try {
      await axios.delete(`${PRODUCTOS_URL}/${producto.id}`);
      setCarrito((actual) => {
        const siguiente = { ...actual };
        delete siguiente[producto.id];
        return siguiente;
      });
      setAviso("Producto eliminado correctamente.");
      await cargarProductos();
    } catch (requestError) {
      console.error("Error al eliminar producto:", requestError);
      setError("No fue posible eliminar el producto.");
    }
  };

  const cambiarCantidad = (producto, cantidad) => {
    setCarrito((actual) => {
      const siguiente = { ...actual };
      if (cantidad < 1) delete siguiente[producto.id];
      else siguiente[producto.id] = Math.min(cantidad, producto.stock);
      return siguiente;
    });
  };

  const lineasCarrito = productos
    .filter((producto) => carrito[producto.id] > 0)
    .map((producto) => ({ producto, cantidad: carrito[producto.id] }));
  const total = lineasCarrito.reduce(
    (suma, linea) => suma + Number(linea.producto.precio) * linea.cantidad,
    0,
  );

  const iniciarPago = async () => {
    setPagando(true);
    setError("");
    try {
      const { data } = await axios.post(`${API_URL}/pagos/iniciar`, {
        items: lineasCarrito.map(({ producto, cantidad }) => ({
          productoId: producto.id,
          cantidad,
        })),
      });
      const formulario = document.createElement("form");
      formulario.method = "post";
      formulario.action = data.url;
      const token = document.createElement("input");
      token.type = "hidden";
      token.name = "token_ws";
      token.value = data.token;
      formulario.append(token);
      document.body.append(formulario);
      formulario.submit();
    } catch (requestError) {
      console.error("Error al iniciar el pago:", requestError);
      setError("No fue posible iniciar el pago con Transbank. Inténtalo otra vez.");
      setPagando(false);
    }
  };

  const volverAlCatalogo = () => {
    window.history.replaceState({}, "", "/");
    window.location.reload();
  };

  if (resultado) {
    const aprobado = resultado.estado === "ACEPTADO";
    return (
      <main className="result-page container">
        <section className="result-card text-center">
          <div className={`result-icon ${aprobado ? "success" : "failure"}`}>
            {aprobado ? "✓" : "!"}
          </div>
          <p className="eyebrow">SABOR LOCAL · PAGO WEBPAY PLUS</p>
          <h1>{aprobado ? "¡Pago aprobado!" : "Pago no completado"}</h1>
          <p className="text-secondary">
            {resultado.mensaje ||
              (aprobado
                ? "Tu pago fue confirmado por Transbank y el stock se actualizó."
                : "No se confirmó el pago. Puedes revisar tu carrito e intentarlo nuevamente.")}
          </p>
          <button className="btn btn-primary mt-3" onClick={volverAlCatalogo}>
            Volver a los productos
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <nav className="container navbar navbar-expand">
          <a className="brand" href="/" aria-label="Sabor Local, inicio">
            <span className="brand-mark">SL</span>
            <span>Sabor <strong>Local</strong></span>
          </a>
          <a className="cart-link" href="#carrito">
            <span aria-hidden="true">🛒</span> Mi carrito
            <span className="cart-count">
              {lineasCarrito.reduce((cantidad, linea) => cantidad + linea.cantidad, 0)}
            </span>
          </a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-content">
            <div>
              <p className="eyebrow">HECHO CON SABOR, HECHO CERCA</p>
              <h1>Lo rico de siempre,<br /><span>a un clic de distancia.</span></h1>
              <p className="hero-copy">
                Descubre nuestros favoritos y arma tu pedido para disfrutar.
              </p>
              <a className="btn btn-light hero-button" href="#productos">Ver productos</a>
            </div>
            <div className="hero-illustration" aria-hidden="true">
              <span className="food-circle">🍔</span>
              <span className="food-spark spark-one">✦</span>
              <span className="food-spark spark-two">✦</span>
            </div>
          </div>
        </section>

        <div className="container content-area">
          {resultado && <div className="alert alert-info">{resultado.estado}</div>}
          {aviso && (
            <div className="alert alert-success alert-dismissible" role="status">
              {aviso}
              <button className="btn-close" aria-label="Cerrar" onClick={() => setAviso("")} />
            </div>
          )}
          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          <div className="section-heading" id="productos">
            <div>
              <p className="eyebrow">NUESTRO CATÁLOGO</p>
              <h2>Productos para disfrutar</h2>
            </div>
            <button className="btn btn-primary" onClick={abrirCrear}>
              <span aria-hidden="true">＋</span> Agregar producto
            </button>
          </div>

          {cargando ? (
            <div className="loading-state"><div className="spinner-border text-primary" />Cargando productos…</div>
          ) : productos.length === 0 ? (
            <div className="empty-state">
              <span aria-hidden="true">🍽️</span>
              <h3>Aún no hay productos</h3>
              <p>Agrega el primero para comenzar a armar tu catálogo.</p>
            </div>
          ) : (
            <div className="row g-4 product-grid">
              {productos.map((producto) => (
                <div className="col-sm-6 col-lg-4" key={producto.id}>
                  <article className="product-card h-100">
                    <div className="product-art" aria-hidden="true">🥪</div>
                    <div className="product-body">
                      <div className="d-flex justify-content-between gap-2">
                        <span className="category-tag">{producto.categoria}</span>
                        <span className={`stock-tag ${producto.stock === 0 ? "out-of-stock" : ""}`}>
                          {producto.stock > 0 ? `${producto.stock} disponibles` : "Agotado"}
                        </span>
                      </div>
                      <h3>{producto.nombre}</h3>
                      <p className="product-description">{producto.descripcion}</p>
                      <div className="product-footer">
                        <strong className="product-price">{pesos.format(producto.precio)}</strong>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          disabled={producto.stock < 1}
                          onClick={() => cambiarCantidad(producto, (carrito[producto.id] || 0) + 1)}
                        >
                          Agregar al carrito
                        </button>
                      </div>
                      <div className="product-actions">
                        <button className="btn btn-link btn-sm" onClick={() => editarProducto(producto.id)}>
                          Editar
                        </button>
                        <button className="btn btn-link btn-sm text-danger" onClick={() => eliminarProducto(producto)}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          )}

          <section className="cart-section" id="carrito">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TU PEDIDO</p>
                <h2>Mi carrito</h2>
              </div>
            </div>
            {lineasCarrito.length === 0 ? (
              <p className="cart-empty">Tu carrito está vacío. Agrega algo rico del catálogo.</p>
            ) : (
              <div className="cart-card">
                {lineasCarrito.map(({ producto, cantidad }) => (
                  <div className="cart-row" key={producto.id}>
                    <div>
                      <strong>{producto.nombre}</strong>
                      <span>{pesos.format(producto.precio)} c/u</span>
                    </div>
                    <div className="quantity-control">
                      <button aria-label={`Quitar uno de ${producto.nombre}`} onClick={() => cambiarCantidad(producto, cantidad - 1)}>−</button>
                      <span>{cantidad}</span>
                      <button aria-label={`Agregar uno de ${producto.nombre}`} onClick={() => cambiarCantidad(producto, cantidad + 1)} disabled={cantidad >= producto.stock}>＋</button>
                    </div>
                    <strong>{pesos.format(producto.precio * cantidad)}</strong>
                  </div>
                ))}
                <div className="cart-total">
                  <span>Total</span>
                  <strong>{pesos.format(total)}</strong>
                </div>
                <button className="btn btn-primary checkout-button" onClick={iniciarPago} disabled={pagando}>
                  {pagando ? "Conectando con Transbank…" : "Pagar con Webpay Plus"}
                </button>
                <p className="payment-note">El precio y el stock se validan nuevamente antes del pago.</p>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="container d-flex justify-content-between flex-wrap gap-2">
          <span>Sabor Local</span>
          <span>Pagos de prueba protegidos por Webpay Plus</span>
        </div>
      </footer>

      {modalAbierto && (
        <div className="modal-backdrop-custom" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !guardando) setModalAbierto(false);
        }}>
          <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">{idEditar === null ? "NUEVO EN EL MENÚ" : "ACTUALIZA TU CATÁLOGO"}</p>
                <h2 id="modal-title">{idEditar === null ? "Agregar producto" : "Editar producto"}</h2>
              </div>
              <button className="btn-close" aria-label="Cerrar" onClick={() => setModalAbierto(false)} disabled={guardando} />
            </div>
            <form onSubmit={guardarProducto}>
              <div className="modal-body">
                {error && <div className="alert alert-danger">{error}</div>}
                <label className="form-label" htmlFor="nombre">Nombre</label>
                <input id="nombre" className="form-control" name="nombre" value={form.nombre} onChange={cambiarCampo} required maxLength={100} />
                <label className="form-label mt-3" htmlFor="descripcion">Descripción</label>
                <textarea id="descripcion" className="form-control" name="descripcion" value={form.descripcion} onChange={cambiarCampo} rows="2" required maxLength={500} />
                <div className="row g-3 mt-1">
                  <div className="col-sm-6">
                    <label className="form-label" htmlFor="precio">Precio (CLP)</label>
                    <input id="precio" className="form-control" name="precio" type="number" min="1" step="1" value={form.precio} onChange={cambiarCampo} required />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label" htmlFor="stock">Stock</label>
                    <input id="stock" className="form-control" name="stock" type="number" min="0" step="1" value={form.stock} onChange={cambiarCampo} required />
                  </div>
                </div>
                <label className="form-label mt-3" htmlFor="categoria">Categoría</label>
                <input id="categoria" className="form-control" name="categoria" value={form.categoria} onChange={cambiarCampo} required maxLength={80} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" type="button" onClick={() => setModalAbierto(false)} disabled={guardando}>
                  Cancelar
                </button>
                <button className="btn btn-primary" type="submit" disabled={guardando}>
                  {guardando ? "Guardando…" : idEditar === null ? "Guardar producto" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
