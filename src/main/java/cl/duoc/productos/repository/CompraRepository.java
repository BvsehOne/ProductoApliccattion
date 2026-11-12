package cl.duoc.productos.repository;

import cl.duoc.productos.model.Compra;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface CompraRepository extends JpaRepository<Compra, Long> {

    Optional<Compra> findByTokenTransbank(String tokenTransbank);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select compra from Compra compra where compra.tokenTransbank = :token")
    Optional<Compra> findByTokenTransbankForUpdate(@Param("token") String tokenTransbank);

    Optional<Compra> findByOrdenCompra(String ordenCompra);
}
