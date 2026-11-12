package cl.duoc.productos.controller;

import cl.duoc.productos.model.EstadoPago;
import cl.duoc.productos.service.PagoService;
import cl.duoc.productos.service.PagoService.InicioPago;
import cl.duoc.productos.service.PagoService.ItemPago;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pagos")
public class PagoController {

    private final PagoService pagoService;
    private final String frontendUrl;

    public PagoController(
            PagoService pagoService,
            @Value("${app.frontend-url}") String frontendUrl) {
        this.pagoService = pagoService;
        this.frontendUrl = frontendUrl;
    }

    @PostMapping("/iniciar")
    public InicioPago iniciar(@RequestBody SolicitudPago solicitud) {
        List<ItemPago> items = solicitud == null ? null : solicitud.items();
        return pagoService.iniciar(items);
    }

    @PostMapping(value = "/retorno", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<Void> retorno(
            @RequestParam(name = "token_ws", required = false) String token,
            @RequestParam(name = "TBK_TOKEN", required = false) String tokenAnulado,
            @RequestParam(name = "TBK_ORDEN_COMPRA", required = false) String ordenAnulada) {
        if (token != null && !token.isBlank()) {
            EstadoPago estado = pagoService.confirmar(token);
            return redirigir(estado.name(), null);
        }
        if (tokenAnulado != null && !tokenAnulado.isBlank()) {
            pagoService.anular(tokenAnulado);
            return redirigir(EstadoPago.ANULADO.name(), null);
        }
        if (ordenAnulada != null && !ordenAnulada.isBlank()) {
            pagoService.anularPorOrden(ordenAnulada);
            return redirigir(EstadoPago.ANULADO.name(), null);
        }
        return redirigir("ERROR", "Transbank no devolvió datos de la transacción");
    }

    @GetMapping("/retorno")
    public ResponseEntity<Void> retornoGet() {
        return redirigir("ANULADO", null);
    }

    private ResponseEntity<Void> redirigir(String estado, String mensaje) {
        String destino = frontendUrl + "/pago/resultado?estado=" + estado;
        if (mensaje != null) {
            destino += "&mensaje=" + URLEncoder.encode(mensaje, StandardCharsets.UTF_8);
        }
        return ResponseEntity.status(303).location(URI.create(destino)).build();
    }

    public record SolicitudPago(List<ItemPago> items) {
    }
}
