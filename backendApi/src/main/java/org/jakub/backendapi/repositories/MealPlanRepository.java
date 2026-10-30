package org.jakub.backendapi.repositories;

import jakarta.persistence.LockModeType;
import org.jakub.backendapi.entities.MealPlan;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface MealPlanRepository extends JpaRepository<MealPlan, UUID> {
    List<MealPlan> findTop20ByUserEmailOrderByCreatedAtDesc(String email);
    Optional<MealPlan> findByIdAndUserEmail(UUID id, String email);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from MealPlan p where p.id = :id and p.user.email = :email")
    Optional<MealPlan> findOwnedForUpdate(@Param("id") UUID id, @Param("email") String email);
}
