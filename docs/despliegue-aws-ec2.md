# Desplegar Sabor Local en AWS EC2

Esta guía adapta el laboratorio DUOC de EC2 al repositorio actual. La aplicación incluye el catálogo React, la API Spring Boot y Webpay Plus de integración en una sola imagen Docker; por eso el navegador, la API y el retorno de pago usan el mismo dominio/puerto y no requieren una segunda VM ni configurar CORS para el despliegue.

## 1. Crear la instancia

En AWS Console, abre **EC2 → Launch instance** y crea una instancia con:

- **AMI:** Amazon Linux 2023, 64 bits.
- **Arquitectura:** x86_64.
- **Tipo:** el tamaño que autorice tu cuenta y presupuesto; Docker compila el frontend y Java, por lo que 2 GiB de memoria o más es más cómodo que `t3.micro`.
- **Acceso:** EC2 Instance Connect o un par de claves SSH.
- **Disco:** conserva espacio suficiente para Docker, la imagen y las capas de compilación.

Revisa los precios vigentes antes de lanzar recursos. La IP pública puede cambiar si detienes y vuelves a iniciar la instancia; para una URL estable se necesita una Elastic IP, que puede tener cargos.

## 2. Configurar el Security Group

En **Security → Security groups → Inbound rules**, agrega:

| Tipo | Puerto | Origen | Uso |
|---|---:|---|---|
| SSH | 22 | Tu IP para SSH local; prefijo regional de EC2 Instance Connect para conexión desde la consola AWS | Administrar la VM |
| Custom TCP | 8080 | `0.0.0.0/0` para el laboratorio | Navegador y retorno de Webpay |

La regla pública de 8080 sirve para la demostración académica. En producción no expongas SSH al mundo ni dejes el servicio en HTTP: usa HTTPS detrás de un Application Load Balancer o un proxy, y restringe el puerto 8080 para que solo lo alcance ese proxy.

Si usarás **EC2 Instance Connect** desde la consola, permite en el Security Group el prefix list regional `com.amazonaws.<region>.ec2-instance-connect` en el puerto 22. La regla **My IP** corresponde a una conexión SSH iniciada directamente desde tu computador. También puedes usar AWS Systems Manager Session Manager si la instancia y su rol IAM están configurados para ello.

## 3. Conectarse e instalar Git y Docker

En la instancia, pulsa **Connect → EC2 Instance Connect → Connect**. En la terminal Linux ejecuta:

```bash
sudo dnf update -y
sudo dnf install -y git docker
sudo systemctl enable --now docker
docker --version
git --version
```

Las etapas de compilación del `Dockerfile` usan Java 25 y Node.js 24; no necesitas instalar Java, Node ni Maven directamente en la VM. Si el usuario de EC2 no tiene permiso para usar Docker, antepone `sudo` a los comandos Docker.

## 4. Clonar el repositorio y construir la aplicación

Clona el repositorio público directamente en EC2:

```bash
cd ~
git clone https://github.com/BvsehOne/ProductoApliccattion.git
cd ProductoApliccattion
git switch main
sudo docker build -t productos:latest .
```

La construcción puede tardar varios minutos mientras descarga las dependencias y arma el frontend y el JAR. Si `docker build` termina con código de salida 0, se generó la imagen `productos:latest`. La compilación también se valida en GitHub Actions.

Si una instancia pequeña se queda sin memoria durante la construcción, detén el proceso y prueba con una instancia de más memoria o configura swap en el sistema antes de volver a construir. Considera el costo de cualquier cambio de capacidad/disco.

## 5. Iniciar el servicio para la IP pública de EC2

En la consola EC2, copia el campo **Public IPv4 address** de tu instancia. Sustituye `IP_PUBLICA_EC2` en el comando; no uses la IP privada `172.31.x.x`.

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

La interfaz React se sirve desde el mismo Spring Boot. Su cliente usa `/api` como ruta relativa, y el backend registra el retorno Webpay en `http://IP_PUBLICA_EC2:8080/api/pagos/retorno`. La IP debe ser alcanzable desde Internet para que el navegador y Transbank puedan volver a la aplicación. Esta configuración es solo para el ambiente de integración.

## 6. Verificar el despliegue

Desde la terminal EC2:

```bash
sudo docker ps --filter name=productos
sudo docker logs --tail 100 productos
curl -i http://localhost:8080/api/productos
curl -i http://localhost:8080/v3/api-docs
```

Desde tu computador, abre estas direcciones reemplazando la IP:

- Tienda y carrito: `http://IP_PUBLICA_EC2:8080/`
- API: `http://IP_PUBLICA_EC2:8080/api/productos`
- Swagger: `http://IP_PUBLICA_EC2:8080/swagger-ui/index.html`

Crea un producto, agrégalo al carrito y realiza una compra de prueba con las tarjetas documentadas por [Transbank Developers](https://www.transbankdevelopers.cl/documentacion/como_empezar#ambientes). Al volver del pago, el resultado debe mostrarse en la misma tienda y el stock solo se descuenta si el pago fue aprobado.

Si el navegador no conecta, confirma que el contenedor está activo, revisa `sudo docker logs -f productos`, verifica la IP pública y el puerto 8080 en el Security Group. El `@CrossOrigin` de `localhost:5173` solo se necesita para desarrollo local: en EC2 el frontend y `/api` tienen el mismo origen.

## 7. Actualizar el despliegue existente con H2

Este procedimiento conserva el modo H2 temporal. Para cambiar el despliegue a PostgreSQL persistente con Docker Compose, sigue la [guía de PostgreSQL en EC2](./postgres-ec2.md) en vez de volver a ejecutar este comando `docker run`.

En la VM:

```bash
cd ~/ProductoApliccattion
git pull --ff-only origin main
sudo docker build -t productos:latest .
sudo docker rm -f productos
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

`--restart unless-stopped` vuelve a iniciar el contenedor cuando reinicia Docker o la VM. La base actual es H2 en memoria: los productos y compras se pierden al reemplazar/reiniciar el contenedor o la instancia. Para conservarlos, configura PostgreSQL con `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` y `JPA_DDL_AUTO`; no guardes contraseñas en Git ni en el historial del shell.

## 8. Transbank y datos de producción

El despliegue usa credenciales de integración no comerciales incluidas por el SDK oficial. No permite cobros reales. Para producción necesitas una afiliación/código de comercio y llave API entregados por Transbank, además de un dominio HTTPS y configuración segura de secretos. No cambies a producción con la IP pública y HTTP de esta guía.

Configura `TRANSBANK_ENVIRONMENT=production`, `TRANSBANK_COMMERCE_CODE`, `TRANSBANK_API_KEY`, `FRONTEND_URL` y `BACKEND_URL` en el entorno seguro del servicio. No pegues ni subas claves al repositorio.

## 9. Autoescalado: propuesta para el desafío

Una sola VM EC2 no es autoescalado. Un **Auto Scaling Group** con más instancias tampoco es correcto si cada una guarda sus propios datos H2 en memoria: los productos y compras no se compartirían y desaparecerían al reemplazarlas.

Arquitectura propuesta para escalar:

```text
Navegador / retorno Webpay
              |
       HTTPS :443
              v
Application Load Balancer
              |
   Target Group :8080 (health check /api/productos)
          /       \
     EC2 #1       EC2 #2 ... Auto Scaling Group
          \       /
          PostgreSQL administrado
```

- Usa un Launch Template y un Auto Scaling Group; para una demostración puede proponerse mínimo 1, deseado 1, máximo 2 instancias. Para alta disponibilidad real, distribuye instancias en más de una zona y revisa capacidad/costos.
- Usa CPU promedio del grupo mayor a 60 % durante 5 minutos como ejemplo de política de escalado; define también una política de reducción con ventana de enfriamiento para evitar oscilaciones.
- El Application Load Balancer distribuye las solicitudes y termina HTTPS. Limita la entrada de las EC2 al Security Group del ALB; no abras el puerto 8080 a todo Internet.
- Todas las instancias deben conectarse a la misma base PostgreSQL, no a H2 en memoria.
- Para aprovisionamiento repetible, publica la imagen Docker en Amazon ECR y configura el Launch Template para descargarla y ejecutar el contenedor. No compiles el repositorio en cada arranque.
- Configura `BACKEND_URL` y `FRONTEND_URL` con el dominio HTTPS público del balanceador para que el retorno de Webpay llegue al mismo servicio.

Esta arquitectura se describe como una propuesta para el laboratorio; esta guía no crea recursos AWS ni activa un Auto Scaling Group.
