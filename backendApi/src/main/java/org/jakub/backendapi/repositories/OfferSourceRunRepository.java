package org.jakub.backendapi.repositories;
import org.jakub.backendapi.entities.OfferSourceRun;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface OfferSourceRunRepository extends JpaRepository<OfferSourceRun, UUID> {
    List<OfferSourceRun> findTop30ByOrderByCreatedAtDesc();
}
