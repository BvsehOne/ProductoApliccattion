package cl.duoc.productos.service;

import cl.duoc.productos.model.Compra;
import cl.duoc.productos.model.DetalleCompra;
import cl.duoc.productos.model.EstadoPago;
import cl.duoc.productos.model.Producto;
import cl.duoc.productos.repository.CompraRepository;
import cl.duoc.productos.repository.ProductoRepository;
import cl.transbank.webpay.exception.TransactionCommitException;
import cl.transbank.webpay.exception.TransactionCreateException;
import cl.transbank.webpay.webpayplus.WebpayPlus;
import cl.transbank.webpay.webpayplus.responses.WebpayPlusTransactionCommitResponse;
import cl.transbank.webpay.webpayplus.responses.WebpayPlusTransactionCreateResponse;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PagoService {

    private static final Logger logger = LoggerFactory.getLogger(PagoService.class);

    private final CompraRepository compraRepository;
    private final ProductoRepository productoRepository;
    private final WebpayPlus.Transaction transaccion;
    private final String backendUrl;

    public PagoService(
            CompraRepository compraRepository,
            ProductoRepository productoRepository,
            WebpayPlus.Transaction transaccion,
            @Value("${app.backend-url}") String backendUrl) {
        this.compraRepository = compraRepository;
        this.productoRepository = productoRepository;
        this.transaccion = transaccion;
        this.backendUrl = backendUrl;
    }

    public InicioPago iniciar(List<ItemPago> items) {
        if (items == null || items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El carrito está vacío");
        }

        BigDecimal total = BigDecimal.ZERO;
        List<DetalleCompra> detalles = new ArrayList<>();
        Set<Long> productosIncluidos = new HashSet<>();
        for (ItemPago item : items) {
            if (item == null || item.productoId() == null || item.cantidad() < 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Producto o cantidad inválidos");
            }
            if (!productosIncluidos.add(item.productoId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hay productos repetidos en el carrito");
            }
            Producto producto = productoRepository.findById(item.productoId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND, "Producto no encontrado: " + item.productoId()));
            if (producto.getStock() < item.cantidad()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT, "Stock insuficiente para " + producto.getNombre());
            }
            if (!Double.isFinite(producto.getPrecio()) || producto.getPrecio() <= 0) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT, "El precio de " + producto.getNombre() + " no es válido");
            }
            BigDecimal precio = BigDecimal.valueOf(producto.getPrecio());
            if (precio.stripTrailingZeros().scale() > 0) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT, "El precio debe expresarse en pesos enteros");
            }
            total = total.add(precio.multiply(BigDecimal.valueOf(item.cantidad())));
            detalles.add(new DetalleCompra(
                    producto.getId(), producto.getNombre(), item.cantidad(), precio));
        }

        String ordenCompra = UUID.randomUUID().toString().replace("-", "").substring(0, 26);
        String sessionId = UUID.randomUUID().toString();
        try {
            WebpayPlusTransactionCreateResponse respuesta = transaccion.create(
                    ordenCompra, sessionId, total.doubleValue(), backendUrl + "/api/pagos/retorno");
            Compra compra = new Compra(
                    ordenCompra, respuesta.getToken(), total, EstadoPago.PENDIENTE, detalles);
            compraRepository.save(compra);
            return new InicioPago(respuesta.getUrl(), respuesta.getToken());
        } catch (IOException | TransactionCreateException exception) {
            logger.error("No se pudo iniciar pago Transbank para la orden {}", ordenCompra, exception);
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY, "Transbank no pudo iniciar el pago", exception);
        }
    }

    @Transactional
    public EstadoPago confirmar(String tokenTransbank) {
        Compra compra = compraRepository.findByTokenTransbankForUpdate(tokenTransbank)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "No existe la compra asociada al pago"));
        if (compra.getEstado() != EstadoPago.PENDIENTE) {
            return compra.getEstado();
        }

        try {
            WebpayPlusTransactionCommitResponse respuesta = transaccion.commit(tokenTransbank);
            boolean aprobado = respuesta.getResponseCode() == 0
                    && "AUTHORIZED".equalsIgnoreCase(respuesta.getStatus())
                    && compra.getOrdenCompra().equals(respuesta.getBuyOrder())
                    && compra.getTotal().compareTo(BigDecimal.valueOf(respuesta.getAmount())) == 0;
            if (!aprobado) {
                compra.setEstado(EstadoPago.RECHAZADO);
                compraRepository.save(compra);
                return compra.getEstado();
            }

            for (DetalleCompra detalle : compra.getDetalles()) {
                var productoEncontrado = productoRepository.findById(detalle.getProductoId());
                if (productoEncontrado.isEmpty()) {
                    logger.error(
                            "Pago aprobado para orden {}, pero el producto {} ya no existe",
                            compra.getOrdenCompra(),
                            detalle.getProductoId());
                    continue;
                }
                Producto producto = productoEncontrado.get();
                if (producto.getStock() < detalle.getCantidad()) {
                    logger.error(
                            "Pago aprobado para orden {}, pero el stock de {} es insuficiente",
                            compra.getOrdenCompra(),
                            detalle.getProductoId());
                    continue;
                }
                producto.setStock(producto.getStock() - detalle.getCantidad());
                productoRepository.save(producto);
            }
            compra.setEstado(EstadoPago.ACEPTADO);
            compraRepository.save(compra);
            return compra.getEstado();
        } catch (IOException | TransactionCommitException exception) {
            logger.error("No se pudo confirmar pago Transbank para la orden {}", compra.getOrdenCompra(), exception);
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY, "No se pudo confirmar el pago con Transbank", exception);
        }
    }

    @Transactional
    public void anular(String tokenTransbank) {
        compraRepository.findByTokenTransbank(tokenTransbank).ifPresent(compra -> {
            if (compra.getEstado() == EstadoPago.PENDIENTE) {
                compra.setEstado(EstadoPago.ANULADO);
                compraRepository.save(compra);
            }
        });
    }

    public void anularPorOrden(String ordenCompra) {
        compraRepository.findByOrdenCompra(ordenCompra).ifPresent(compra -> {
            if (compra.getEstado() == EstadoPago.PENDIENTE) {
                compra.setEstado(EstadoPago.ANULADO);
                compraRepository.save(compra);
            }
        });
    }

    public record ItemPago(Long productoId, int cantidad) {
    }

    public record InicioPago(String url, String token) {
    }
}
