# Sabor Local: catálogo y pagos

Aplicación para administrar productos de comida y comprar desde un carrito. Incluye una API REST Spring Boot, una interfaz React/Axios con CRUD y modal, y una integración de Webpay Plus en ambiente de pruebas.

## Requisitos

- JDK 25 (LTS).
- Node.js 24 o superior.
- PowerShell y conexión a Internet para descargar las dependencias.
- Maven no necesita instalación: el proyecto incluye `mvnw.cmd`.

## Ejecutar en desarrollo

En una terminal, desde la raíz del proyecto:

```powershell
.\mvnw.cmd spring-boot:run
```

En otra terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Abre <http://localhost:5173>. Vite reenvía `/api` al backend en el puerto 8080. La API y Swagger están disponibles en <http://localhost:8080/api/productos> y <http://localhost:8080/swagger-ui/index.html>.

Para que Webpay redirija al frontend local, configura antes de iniciar Spring Boot:

```powershell
$env:FRONTEND_URL = "http://localhost:5173"
.\mvnw.cmd spring-boot:run
```

## Webpay Plus

El proyecto usa el SDK oficial de Transbank (`com.github.transbankdevelopers:transbank-sdk-java`) y por defecto utiliza el ambiente de integración, con credenciales de prueba incluidas en el SDK oficial. No se requieren claves privadas de producción para probar el flujo.

El frontend envía solamente los productos y cantidades. El backend vuelve a consultar precios y stock, calcula el total y crea la transacción; después del retorno valida la respuesta de Transbank y descuenta el stock solo si el pago está aprobado. Las credenciales de producción nunca deben agregarse al repositorio.

Para configurar una cuenta de producción, utiliza variables seguras del proveedor de hosting:

```text
TRANSBANK_ENVIRONMENT=production
TRANSBANK_COMMERCE_CODE=<código entregado a tu comercio>
TRANSBANK_API_KEY=<llave secreta entregada a tu comercio>
BACKEND_URL=https://<dominio-backend>
FRONTEND_URL=https://<dominio-frontend>
```

El backend falla al iniciar en modo de producción si falta el código o la llave. La activación real requiere afiliación comercial y credenciales de Transbank. Consulta [Transbank Developers: cómo empezar](https://www.transbankdevelopers.cl/documentacion/como_empezar) y [referencia Webpay](https://www.transbankdevelopers.cl/referencia/webpay).

## Probar CRUD y compras

La interfaz permite listar, consultar, crear, editar y eliminar productos; el formulario se abre en un modal. El carrito permite cambiar cantidades, valida stock y comienza el pago con Webpay Plus. En ambiente de integración, usa las tarjetas de prueba publicadas en [Transbank Developers](https://www.transbankdevelopers.cl/documentacion/como_empezar#ambientes).

La API CRUD conserva estas rutas:

| Método | Ruta | Acción |
|---|---|---|
| GET | `/api/productos` | Listar productos |
| GET | `/api/productos/{id}` | Consultar un producto |
| POST | `/api/productos` | Crear un producto |
| PUT | `/api/productos/{id}` | Actualizar un producto |
| DELETE | `/api/productos/{id}` | Eliminar un producto |

El pago comienza en `POST /api/pagos/iniciar`. El endpoint de retorno de Webpay es `/api/pagos/retorno`.

## Pruebas y compilación

```powershell
.\mvnw.cmd test
cd frontend
npm ci
npm run build
```

La integración continua ejecuta ambas validaciones con Java 25 y Node.js 24 en GitHub Actions.

## Contenedor

El `Dockerfile` compila React y Spring Boot y empaqueta el frontend en el mismo servicio:

```powershell
docker build -t sabor-local .
docker run --rm -p 8080:8080 `
  -e FRONTEND_URL=https://<dominio-publico> `
  -e BACKEND_URL=https://<dominio-publico> `
  sabor-local
```

En producción configura PostgreSQL y una URL HTTPS pública. H2 en memoria es solo para desarrollo y pierde los datos al reiniciar. El driver PostgreSQL ya está incluido. Configura la conexión como variables seguras del servicio:

```text
SPRING_DATASOURCE_URL=jdbc:postgresql://<host>:5432/<base>
SPRING_DATASOURCE_USERNAME=<usuario>
SPRING_DATASOURCE_PASSWORD=<contraseña>
JPA_DDL_AUTO=update
```

No incluyas credenciales de base de datos en Git. El proyecto está publicado en GitHub con CI, pero aún no está desplegado como una aplicación pública.
En producción, configura también `H2_CONSOLE_ENABLED=false`.

## GitHub

El repositorio debe incluir el código fuente, no `target/`, `node_modules/`, archivos `.env` ni claves privadas. El workflow `.github/workflows/ci.yml` valida cada push y pull request. El proyecto debe estar en un repositorio GitHub al que tengas acceso de escritura para poder publicar cambios.
