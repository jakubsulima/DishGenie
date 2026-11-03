package org.jakub.backendapi.repositories;
import org.jakub.backendapi.entities.MealPlanRevision;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface MealPlanRevisionRepository extends JpaRepository<MealPlanRevision, UUID> {
    List<MealPlanRevision> findTop50ByPlanIdAndStatusOrderByCreatedAtDesc(UUID id, String status);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from MealPlanRevision r where r.id = :id")
    Optional<MealPlanRevision> lock(@Param("id") UUID id);
}
