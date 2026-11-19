# Cómo funciona y cómo personalizar la tienda

## Qué cambió

- **Portada:** foto amplia de hamburguesa, título y botón que baja hasta el menú.
- **Tarjetas:** fotos según nombre/categoría, precio, descripción y disponibilidad.
- **Buscar y filtrar:** se ejecuta en el navegador sobre los productos ya recibidos por `GET /api/productos`; no crea nuevas rutas.
- **Carrito:** permite agregar productos y cambiar unidades hasta el stock indicado; el total se actualiza al instante.
- **CRUD:** el botón “Agregar producto” abre el modal existente; editar y eliminar siguen usando la API actual.
- **Webpay:** el botón continúa iniciando el mismo flujo de pago de integración. El backend calcula el total y verifica el stock real antes de iniciar el pago.

## Personalizar las fotos

Abre `frontend/src/App.jsx`. Al principio del archivo encontrarás `defaultFoodImage` y la lista `foodImages`. Cada entrada asocia palabras con una foto:

```js
{
  categories: /pizza|empanad/,
  src: "https://images.unsplash.com/...",
}
```

La aplicación revisa el nombre y la categoría del producto. Por ejemplo, “Completo Italiano” o la categoría “Completos” usa una foto de hamburguesa/sándwich; “Papas fritas” usa una foto de papas. Agrega una nueva regla antes de las demás para una comida específica. Si nada coincide, se muestra la foto predeterminada.

Las imágenes actuales vienen de Unsplash y necesitan conexión a Internet en el navegador. Si se reemplaza una URL, pruébala primero en un navegador; si un servicio de imágenes no está disponible, los datos del menú y las operaciones de la API siguen funcionando.

## Cambiar colores y diseño

Abre `frontend/src/styles.css`:

1. Los colores principales están al principio en variables como `--orange`, `--ink` y `--paper`.
2. Los bloques `.hero-*` controlan la portada.
3. `.product-*` controla las tarjetas del menú.
4. `.cart-*` controla el pedido.
5. Las reglas `@media` del final adaptan la página a pantallas pequeñas.

Para cambiar títulos, textos, botones y orden de las secciones, edita el JSX correspondiente en `frontend/src/App.jsx`. Mantén las llamadas a `PRODUCTOS_URL` y `/pagos/iniciar` para conservar la integración actual.

## Probar los cambios antes de AWS

1. En la raíz del proyecto, inicia Spring Boot en una terminal:

   ```powershell
   .\mvnw.cmd spring-boot:run
   ```

2. En una segunda terminal inicia React:

   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```

3. Abre <http://localhost:5173>. Si no hay productos, crea uno con “Agregar producto”.
4. Prueba búsqueda, filtros, agregar y quitar unidades del carrito y edición.
5. Genera el build de producción:

   ```powershell
   npm run build
   ```

6. Desde la raíz valida también el backend:

   ```powershell
   .\mvnw.cmd test
   ```

Al publicar un cambio en `main`, GitHub Actions vuelve a compilar el frontend, ejecutar las pruebas Java y construir la imagen Docker.

## Actualizar tu EC2 después de publicar

En EC2, ejecuta:

```bash
cd ~/ProductoApliccattion
git pull --ff-only origin main
sudo docker build -t productos:latest .
```

El sitio usa H2 en memoria en la configuración académica. Antes de reemplazar el contenedor, toma nota o captura de los productos que necesites conservar; al quitarlo, se pierden sus productos y compras:

```bash
sudo docker rm -f productos
```

Después arranca la imagen nueva. Sustituye la IP si cambió desde la consola EC2:

```bash
PUBLIC_IP=IP_PUBLICA_EC2
sudo docker run -d \
  --name productos \
  --restart unless-stopped \
  -p 8080:8080 \
  -e TRANSBANK_ENVIRONMENT=integration \
  -e FRONTEND_URL="http://${PUBLIC_IP}:8080" \
  -e BACKEND_URL="http://${PUBLIC_IP}:8080" \
  -e H2_CONSOLE_ENABLED=false \
  productos:latest
```

Comprueba el contenedor y abre la tienda desde tu computador:

```bash
sudo docker ps --filter name=productos
sudo docker logs --tail 50 productos
curl -i http://localhost:8080/api/productos
```

<http://IP_PUBLICA_EC2:8080/>

El frontend publicado y el backend se sirven desde el mismo dominio, así que las fotos se descargan directamente al navegador y `/api` sigue siendo una ruta relativa. El puerto 8080 debe seguir permitido en el Security Group para esta demostración.
