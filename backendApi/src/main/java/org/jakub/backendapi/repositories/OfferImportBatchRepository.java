package org.jakub.backendapi.repositories;
import org.jakub.backendapi.entities.OfferImportBatch;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface OfferImportBatchRepository extends JpaRepository<OfferImportBatch, UUID> {
    List<OfferImportBatch> findTop30ByOrderByCreatedAtDesc();
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from OfferImportBatch b where b.id = :id")
    Optional<OfferImportBatch> lock(@Param("id") UUID id);
}
