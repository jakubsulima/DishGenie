package org.jakub.backendapi.repositories;
import org.jakub.backendapi.entities.MealPlanItemPrice;
import org.jakub.backendapi.dto.MealPlanDto.Store;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.*;
public interface MealPlanItemPriceRepository extends JpaRepository<MealPlanItemPrice, UUID> {
    List<MealPlanItemPrice> findByPlanIdAndShoppingDateAndStoreIn(UUID planId, LocalDate date, Set<Store> stores);
    Optional<MealPlanItemPrice> findByIdAndPlanId(UUID id, UUID planId);
}
