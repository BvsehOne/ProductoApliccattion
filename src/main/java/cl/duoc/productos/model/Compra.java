package cl.duoc.productos.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "compras", uniqueConstraints = @UniqueConstraint(columnNames = "orden_compra"))
public class Compra {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "orden_compra", nullable = false, unique = true, length = 26)
    private String ordenCompra;

    @Column(name = "token_transbank", nullable = false, unique = true, length = 64)
    private String tokenTransbank;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private EstadoPago estado;

    @ElementCollection
    @CollectionTable(name = "compra_detalles", joinColumns = @JoinColumn(name = "compra_id"))
    @OrderColumn(name = "posicion")
    private List<DetalleCompra> detalles = new ArrayList<>();

    protected Compra() {
    }

    public Compra(
            String ordenCompra,
            String tokenTransbank,
            BigDecimal total,
            EstadoPago estado,
            List<DetalleCompra> detalles) {
        this.ordenCompra = ordenCompra;
        this.tokenTransbank = tokenTransbank;
        this.total = total;
        this.estado = estado;
        this.detalles = new ArrayList<>(detalles);
    }

    public String getOrdenCompra() {
        return ordenCompra;
    }

    public String getTokenTransbank() {
        return tokenTransbank;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public EstadoPago getEstado() {
        return estado;
    }

    public List<DetalleCompra> getDetalles() {
        return List.copyOf(detalles);
    }

    public void setEstado(EstadoPago estado) {
        this.estado = estado;
    }
}
