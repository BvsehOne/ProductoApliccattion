package cl.duoc.productos.model;

import jakarta.persistence.Embeddable;
import java.math.BigDecimal;

@Embeddable
public class DetalleCompra {

    private Long productoId;
    private String nombre;
    private int cantidad;
    private BigDecimal precioUnitario;

    protected DetalleCompra() {
    }

    public DetalleCompra(Long productoId, String nombre, int cantidad, BigDecimal precioUnitario) {
        this.productoId = productoId;
        this.nombre = nombre;
        this.cantidad = cantidad;
        this.precioUnitario = precioUnitario;
    }

    public Long getProductoId() {
        return productoId;
    }

    public String getNombre() {
        return nombre;
    }

    public int getCantidad() {
        return cantidad;
    }

    public BigDecimal getPrecioUnitario() {
        return precioUnitario;
    }
}
