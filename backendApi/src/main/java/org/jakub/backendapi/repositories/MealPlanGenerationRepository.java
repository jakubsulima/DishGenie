package org.jakub.backendapi.repositories;
import org.jakub.backendapi.entities.MealPlanGeneration;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;
public interface MealPlanGenerationRepository extends JpaRepository<MealPlanGeneration, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from MealPlanGeneration g where g.id = :id")
    Optional<MealPlanGeneration> lock(@Param("id") UUID id);
    @Query("select g.id from MealPlanGeneration g where g.status = 'QUEUED' or (g.status = 'RUNNING' and g.leaseUntil < :now) order by g.createdAt")
    List<UUID> ready(@Param("now") Instant now, Pageable page);
    Optional<MealPlanGeneration> findFirstByPlanIdOrderByCreatedAtDesc(UUID id);
    boolean existsByPlanIdAndStatusIn(UUID id, Collection<String> states);
}
