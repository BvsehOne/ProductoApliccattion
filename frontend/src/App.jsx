import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const PRODUCTOS_URL = `${API_URL}/productos`;
const defaultFoodImage =
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=960&q=82";
const foodImages = [
  {
    categories: /pizza|empanad/,
    src: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=960&q=82",
  },
  {
    categories: /papa|frit/,
    src: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=960&q=82",
  },
  {
    categories: /complet|hamburg|burger|sandwich|sándwich|sanguch/,
    src: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=960&q=82",
  },
  {
    categories: /pollo|ave|wrap/,
    src: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=960&q=82",
  },
  {
    categories: /ensalada|vegetarian/,
    src: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=960&q=82",
  },
];
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
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("Todos");
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
  const categorias = [...new Set(productos.map((producto) => producto.categoria).filter(Boolean))];
  const productosVisibles = productos.filter((producto) => {
    const coincideCategoria =
      categoriaActiva === "Todos" || producto.categoria === categoriaActiva;
    const termino = busqueda.trim().toLocaleLowerCase("es-CL");
    const coincideBusqueda =
      !termino ||
      `${producto.nombre} ${producto.descripcion} ${producto.categoria}`
        .toLocaleLowerCase("es-CL")
        .includes(termino);
    return coincideCategoria && coincideBusqueda;
  });
  const cantidadCarrito = lineasCarrito.reduce((cantidad, linea) => cantidad + linea.cantidad, 0);

  const imagenProducto = (producto) => {
    const texto = `${producto.nombre} ${producto.categoria}`.toLocaleLowerCase("es-CL");
    return foodImages.find(({ categories: patron }) => patron.test(texto))?.src || defaultFoodImage;
  };

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
            <span className="brand-mark" aria-hidden="true">SL</span>
            <span>Sabor <strong>Local</strong></span>
          </a>
          <div className="header-links">
            <a className="header-menu-link" href="#productos">Nuestro menú</a>
            <a className="cart-link" href="#carrito" aria-label={`Mi carrito, ${cantidadCarrito} productos`}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 8H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="20" r="1" fill="currentColor" />
                <circle cx="18" cy="20" r="1" fill="currentColor" />
              </svg>
              <span>Mi pedido</span>
              <span className="cart-count">{cantidadCarrito}</span>
            </a>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-content">
            <div className="hero-copy-block">
              <span className="hero-kicker"><span className="hero-kicker-dot" /> SABOR QUE SE NOTA</span>
              <h1>Hoy se come<br /><span>algo increíble.</span></h1>
              <p className="hero-copy">
                Tus antojos favoritos, preparados con cariño y listos para disfrutar.
              </p>
              <div className="hero-actions">
                <a className="hero-button" href="#productos">Explorar el menú <span aria-hidden="true">→</span></a>
                <span className="hero-note">Fresco, rico y sin complicaciones</span>
              </div>
            </div>
            <div className="hero-photo-wrap">
              <img
                className="hero-photo"
                src={defaultFoodImage.replace("w=960", "w=1400")}
                alt="Hamburguesa preparada con ingredientes frescos"
                fetchPriority="high"
                onError={(event) => {
                  event.currentTarget.style.visibility = "hidden";
                }}
              />
              <div className="hero-photo-caption">
                <span className="hero-caption-mark">SL</span>
                <span><strong>Tu pausa favorita</strong><small>Empieza por algo rico</small></span>
              </div>
              <div className="hero-photo-sticker"><span>100%</span><small>antojo</small></div>
            </div>
          </div>
        </section>

        <section className="promise-strip" aria-label="Ventajas de comprar">
          <div className="container promise-items">
            <div><span className="promise-icon">01</span><span><strong>Hecho para disfrutar</strong><small>Un menú lleno de favoritos</small></span></div>
            <div><span className="promise-icon">02</span><span><strong>Compra simple</strong><small>Arma tu pedido en segundos</small></span></div>
            <div><span className="promise-icon">03</span><span><strong>Pago protegido</strong><small>Webpay Plus de Transbank</small></span></div>
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

          <section className="menu-section" id="productos">
            <div className="section-heading">
              <div>
                <p className="eyebrow">ELIGE ALGO RICO</p>
                <h2>Lo bueno está en el menú.</h2>
                <p className="section-subtitle">Encuentra tu favorito y agrégalo al pedido.</p>
              </div>
              <button className="btn btn-primary add-product-button" onClick={abrirCrear}>
                <span aria-hidden="true">＋</span> Agregar producto
              </button>
            </div>

            {productos.length > 0 && (
              <div className="menu-tools">
                <div className="category-filters" aria-label="Filtrar por categoría">
                  {["Todos", ...categorias].map((categoria) => (
                    <button
                      className={`category-filter ${categoriaActiva === categoria ? "active" : ""}`}
                      key={categoria}
                      onClick={() => setCategoriaActiva(categoria)}
                    >
                      {categoria === "Todos" ? "Todo el menú" : categoria}
                    </button>
                  ))}
                </div>
                <label className="search-box">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                    <circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Buscar en el menú"
                    value={busqueda}
                    onChange={(event) => setBusqueda(event.target.value)}
                    aria-label="Buscar productos"
                  />
                </label>
              </div>
            )}

          {cargando ? (
            <div className="loading-state"><div className="spinner-border text-primary" />Preparando el menú…</div>
          ) : productos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-photo">
                <img src={defaultFoodImage} alt="" />
              </div>
              <p className="eyebrow">LA COCINA ESTÁ LISTA</p>
              <h3>Aún no hay productos en el menú</h3>
              <p>Agrega el primer favorito y empieza a recibir pedidos.</p>
              <button className="btn btn-primary mt-2" onClick={abrirCrear}>Agregar primer producto</button>
            </div>
          ) : productosVisibles.length === 0 ? (
            <div className="no-results">
              <strong>No encontramos ese antojo.</strong>
              <span>Prueba con otro nombre o categoría.</span>
              <button className="btn btn-link" onClick={() => { setBusqueda(""); setCategoriaActiva("Todos"); }}>
                Ver todo el menú
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {productosVisibles.map((producto) => (
                <article className="product-card" key={producto.id}>
                  <div className="product-image-wrap">
                    <img
                      className="product-image"
                      src={imagenProducto(producto)}
                      alt={producto.nombre}
                      loading="lazy"
                      onError={(event) => {
                        if (event.currentTarget.src !== defaultFoodImage) {
                          event.currentTarget.src = defaultFoodImage;
                        } else {
                          event.currentTarget.style.visibility = "hidden";
                        }
                      }}
                    />
                    <span className={`stock-tag ${producto.stock === 0 ? "out-of-stock" : ""}`}>
                      {producto.stock > 0 ? "Disponible" : "Agotado"}
                    </span>
                    <div className="product-admin-actions" aria-label={`Administrar ${producto.nombre}`}>
                      <button aria-label={`Editar ${producto.nombre}`} title="Editar producto" onClick={() => editarProducto(producto.id)}>✎</button>
                      <button aria-label={`Eliminar ${producto.nombre}`} title="Eliminar producto" onClick={() => eliminarProducto(producto)}>×</button>
                    </div>
                  </div>
                  <div className="product-body">
                    <span className="category-tag">{producto.categoria || "Favorito de la casa"}</span>
                    <h3>{producto.nombre}</h3>
                    <p className="product-description">{producto.descripcion}</p>
                    <div className="product-footer">
                      <strong className="product-price">{pesos.format(producto.precio)}</strong>
                      <button
                        className="add-to-cart-button"
                        disabled={producto.stock < 1}
                        onClick={() => cambiarCantidad(producto, (carrito[producto.id] || 0) + 1)}
                      >
                        <span aria-hidden="true">＋</span> Agregar
                      </button>
                    </div>
                    <p className="stock-caption">{producto.stock > 0 ? `${producto.stock} unidades disponibles` : "Vuelve pronto"}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
          </section>

          <section className="cart-section" id="carrito">
            <div className="section-heading">
              <div>
                <p className="eyebrow">UN ÚLTIMO PASO</p>
                <h2>Tu pedido</h2>
              </div>
            </div>
            {lineasCarrito.length === 0 ? (
              <div className="cart-empty">
                <span className="cart-empty-mark" aria-hidden="true">＋</span>
                <div><strong>Tu pedido empieza aquí</strong><span>Agrega algo rico del menú para continuar.</span></div>
                <a href="#productos" className="cart-empty-link">Ver menú <span aria-hidden="true">→</span></a>
              </div>
            ) : (
              <div className="cart-card">
                <div className="cart-card-heading">
                  <span>Tu selección</span>
                  <span>{cantidadCarrito} {cantidadCarrito === 1 ? "producto" : "productos"}</span>
                </div>
                {lineasCarrito.map(({ producto, cantidad }) => (
                  <div className="cart-row" key={producto.id}>
                    <div>
                      <strong>{producto.nombre}</strong>
                      <span>{pesos.format(producto.precio)} cada uno</span>
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
                  <span><strong>Total del pedido</strong><small>Impuestos incluidos</small></span>
                  <strong className="cart-total-amount">{pesos.format(total)}</strong>
                </div>
                <button className="btn btn-primary checkout-button" onClick={iniciarPago} disabled={pagando}>
                  {pagando ? "Conectando con Transbank…" : <>Continuar con Webpay <span aria-hidden="true">→</span></>}
                </button>
                <p className="payment-note"><span aria-hidden="true">◇</span> Pago protegido · El stock se confirma al pagar</p>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="container d-flex justify-content-between flex-wrap gap-2">
          <span className="footer-brand">Sabor <strong>Local</strong></span>
          <span>Una pausa rica empieza aquí.</span>
          <span>Pagos de prueba con Webpay Plus</span>
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
