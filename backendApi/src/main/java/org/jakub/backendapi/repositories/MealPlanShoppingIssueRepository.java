package org.jakub.backendapi.repositories;
import org.jakub.backendapi.entities.MealPlanShoppingIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface MealPlanShoppingIssueRepository extends JpaRepository<MealPlanShoppingIssue, UUID> {
    List<MealPlanShoppingIssue> findTop50ByPlanIdOrderByCreatedAtDesc(UUID id);
}
