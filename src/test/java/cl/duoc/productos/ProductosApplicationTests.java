package cl.duoc.productos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpStatus.NOT_FOUND;

import cl.duoc.productos.model.Producto;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProductosApplicationTests {

    @LocalServerPort
    private int port;

    @Test
    void crudDeProductos() throws Exception {
        String url = baseUrl();
        ObjectMapper objectMapper = new ObjectMapper();
        HttpClient httpClient = HttpClient.newHttpClient();
        Producto nuevo = new Producto("Completo", "Italiano", 3990, 20, "Comida Rapida");

        HttpRequest documentacion = HttpRequest.newBuilder(URI.create(rootUrl() + "/v3/api-docs"))
                .GET()
                .build();
        HttpResponse<String> openApi = httpClient.send(documentacion, HttpResponse.BodyHandlers.ofString());
        assertThat(openApi.statusCode()).isEqualTo(HttpStatus.OK.value());
        assertThat(openApi.body()).contains("/api/productos");

        HttpRequest crear = HttpRequest.newBuilder(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(nuevo)))
                .build();
        HttpResponse<String> creado = httpClient.send(crear, HttpResponse.BodyHandlers.ofString());
        assertThat(creado.statusCode()).isEqualTo(HttpStatus.OK.value());
        Producto productoCreado = objectMapper.readValue(creado.body(), Producto.class);
        assertThat(productoCreado.getId()).isNotNull();
        Long id = productoCreado.getId();

        HttpRequest consultar = HttpRequest.newBuilder(URI.create(url + "/" + id)).GET().build();
        HttpResponse<String> consultado = httpClient.send(consultar, HttpResponse.BodyHandlers.ofString());
        assertThat(consultado.statusCode()).isEqualTo(HttpStatus.OK.value());
        assertThat(objectMapper.readValue(consultado.body(), Producto.class).getNombre())
                .isEqualTo("Completo");

        HttpRequest listar = HttpRequest.newBuilder(URI.create(url)).GET().build();
        HttpResponse<String> listado = httpClient.send(listar, HttpResponse.BodyHandlers.ofString());
        assertThat(listado.statusCode()).isEqualTo(HttpStatus.OK.value());
        Producto[] productos = objectMapper.readValue(listado.body(), Producto[].class);
        assertThat(productos).anySatisfy(producto -> assertThat(producto.getId()).isEqualTo(id));

        nuevo.setNombre("Completo italiano");
        HttpRequest actualizar = HttpRequest.newBuilder(URI.create(url + "/" + id))
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(nuevo)))
                .build();
        HttpResponse<String> respuestaActualizacion =
                httpClient.send(actualizar, HttpResponse.BodyHandlers.ofString());
        assertThat(respuestaActualizacion.statusCode()).isEqualTo(HttpStatus.OK.value());
        HttpResponse<String> actualizado = httpClient.send(consultar, HttpResponse.BodyHandlers.ofString());
        assertThat(objectMapper.readValue(actualizado.body(), Producto.class).getNombre())
                .isEqualTo("Completo italiano");

        HttpRequest eliminar = HttpRequest.newBuilder(URI.create(url + "/" + id)).DELETE().build();
        HttpResponse<String> respuestaEliminacion =
                httpClient.send(eliminar, HttpResponse.BodyHandlers.ofString());
        assertThat(respuestaEliminacion.statusCode()).isEqualTo(HttpStatus.OK.value());
        HttpResponse<String> inexistente = httpClient.send(consultar, HttpResponse.BodyHandlers.ofString());
        assertThat(inexistente.statusCode()).isEqualTo(NOT_FOUND.value());
    }

    @Test
    void iniciarPagoValidaElCarritoAntesDeContactarTransbank() throws Exception {
        HttpRequest solicitud = HttpRequest.newBuilder(URI.create(rootUrl() + "/api/pagos/iniciar"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"items\":[]}"))
                .build();

        HttpResponse<String> respuesta =
                HttpClient.newHttpClient().send(solicitud, HttpResponse.BodyHandlers.ofString());

        assertThat(respuesta.statusCode()).isEqualTo(HttpStatus.BAD_REQUEST.value());
    }

    private String baseUrl() {
        return rootUrl() + "/api/productos";
    }

    private String rootUrl() {
        return "http://localhost:" + port;
    }
}
