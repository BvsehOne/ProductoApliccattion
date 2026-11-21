# PostgreSQL 15 persistente en EC2

Esta guía conecta la aplicación Spring Boot con PostgreSQL 15 y mantiene los datos en un volumen Docker. PostgreSQL solo es accesible desde la red privada de Docker; no abras el puerto 5432 al público. Este despliegue usa PostgreSQL en un contenedor, en vez de instalar el servidor directamente en Amazon Linux, para que la aplicación y la base compartan una red aislada y el volumen sobreviva al reemplazo de los contenedores.

## 1. Preparar el repositorio y Docker Compose

Conéctate a la instancia EC2 donde ya ejecutas la aplicación:

```bash
cd ~/ProductoApliccattion
git pull --ff-only origin main
docker --version
docker compose version
```

Si `docker compose version` falla, instala el plugin de Docker Compose siguiendo la [guía oficial de instalación](https://docs.docker.com/compose/install/linux/); no continúes hasta que el comando responda con una versión.

## 2. Crear la configuración privada

Crea el archivo local de variables desde la plantilla y edítalo:

```bash
cp .env.example .env
nano .env
```

Establece una contraseña larga y única para `DB_PASSWORD` y reemplaza la URL de `PUBLIC_BASE_URL` por la IP pública actual de EC2, por ejemplo `http://203.0.113.10:8080`. Conserva:

```text
DB_NAME=carrito_compras
DB_USER=carrito_user
```

Guarda y cierra el editor; después restringe los permisos del archivo:

```bash
chmod 600 .env
```

`.env` está excluido de Git y del contexto de construcción de Docker. No lo compartas ni pegues la contraseña en comandos, capturas o el repositorio. La IP de ejemplo no es una dirección real; consulta la IP pública de tu instancia en AWS.

## 3. Construir y arrancar la base y la aplicación

Construye la aplicación antes de detener el contenedor anterior:

```bash
sudo docker compose build productos
sudo docker compose up -d postgres
sudo docker compose ps
```

Espera hasta que el servicio `postgres` aparezca como `healthy`. Si anteriormente ejecutaste la aplicación con el comando de Docker de la guía EC2, localiza ese contenedor:

```bash
sudo docker ps -a --filter name=^/productos$
```

Si aparece el contenedor anterior `productos`, detenlo y elimínalo para liberar el puerto 8080. Ten presente que el contenedor anterior usaba H2 temporal: sus datos no se copian a PostgreSQL y detenerlo los pierde.

```bash
sudo docker stop productos
sudo docker rm productos
```

Inicia la nueva aplicación:

```bash
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail 100 productos
```

Spring Boot se conecta al hostname interno `postgres`, y JPA crea/actualiza la tabla `productos` al iniciar. El precio se guarda como `NUMERIC(12,2)`. La aplicación conserva el CRUD, la tienda y Webpay en ambiente de integración.

Una instancia `t3.micro` puede quedarse corta al compilar y ejecutar Spring Boot junto con PostgreSQL. Si aparece `Out of memory` o Docker reinicia contenedores, considera una instancia con al menos 2 GiB de memoria y revisa el costo antes de cambiarla.

## 4. Comprobar la API y la tabla

Desde EC2, comprueba los endpoints:

```bash
curl -i http://localhost:8080/api/productos
curl -i http://localhost:8080/v3/api-docs
```

En un navegador, abre `http://IP_PUBLICA_EC2:8080/` y crea un producto desde la tienda. También puedes usar Swagger en `http://IP_PUBLICA_EC2:8080/swagger-ui/index.html`.

Para comprobar directamente el registro persistido:

```bash
sudo docker compose exec postgres psql -U carrito_user -d carrito_compras
```

En el prompt de `psql`:

```sql
\dt
SELECT id, nombre, descripcion, precio, stock, categoria FROM productos;
\q
```

Si cambiaste `DB_NAME` o `DB_USER` en `.env`, usa esos mismos valores con `psql`. El puerto 5432 no está publicado; accede a la base mediante `docker compose exec`.

## 5. Comprobar persistencia y actualizar

Reinicia solo la aplicación y vuelve a consultar el catálogo: los productos deben seguir allí.

```bash
sudo docker compose restart productos
curl -i http://localhost:8080/api/productos
```

Para desplegar cambios de GitHub:

```bash
git pull --ff-only origin main
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs --tail 100 productos
```

`docker compose down` elimina los contenedores, pero conserva el volumen nombrado `postgres_data`. **No uses `docker compose down --volumes` ni borres ese volumen** si quieres conservar los datos. Mantén además copias de seguridad; un volumen local no protege contra la pérdida de la instancia o del disco.

## 6. Seguridad y ambiente de integración

- En el Security Group de EC2 permite el puerto 8080 solo para el acceso requerido por el laboratorio y SSH solo desde tu IP o mediante EC2 Instance Connect.
- No agregues una regla entrante para 5432. La configuración de Compose no publica ese puerto.
- Usa solo tarjetas de prueba documentadas por [Transbank Developers](https://www.transbankdevelopers.cl/documentacion/como_empezar#ambientes). La integración de esta guía no procesa pagos reales.
- Para un servicio público real, configura dominio y HTTPS, almacena secretos con un gestor de secretos y no expongas directamente el puerto 8080.

## Configuración de la entidad

La entidad `Producto` declara explícitamente `@Table(name = "productos")`; su campo `precio` usa `BigDecimal` y precisión `NUMERIC(12,2)`. El controlador conserva los números JSON que ya usa el frontend. El modo H2 queda disponible para desarrollo local y las pruebas de CI validan el CRUD usando PostgreSQL 15.
