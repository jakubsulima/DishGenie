package org.jakub.backendapi.repositories;
import org.jakub.backendapi.entities.RecipeGenerationReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface RecipeGenerationReservationRepository extends JpaRepository<RecipeGenerationReservation, UUID> {}
