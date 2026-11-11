package org.jakub.backendapi.repositories;
import org.jakub.backendapi.entities.ShoppingTrip;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface ShoppingTripRepository extends JpaRepository<ShoppingTrip, UUID> {
    Optional<ShoppingTrip> findByIdAndUserEmail(UUID id, String email);
    List<ShoppingTrip> findByUserEmailOrderByCreatedAtDesc(String email);
    Optional<ShoppingTrip> findFirstByPlanIdAndUserEmailAndStatusNotOrderByCreatedAtDesc(UUID planId, String email, String status);
}
