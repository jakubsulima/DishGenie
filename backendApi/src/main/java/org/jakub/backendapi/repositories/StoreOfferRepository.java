package org.jakub.backendapi.repositories;

import org.jakub.backendapi.entities.StoreOffer;
import org.jakub.backendapi.dto.MealPlanDto.Store;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.*;
import java.util.*;

public interface StoreOfferRepository extends JpaRepository<StoreOffer, UUID> {
    List<StoreOffer> findByActiveTrueAndStoreInAndValidFromLessThanEqualAndValidToGreaterThanEqualAndVerifiedAtGreaterThanEqual(
            Set<Store> stores, LocalDate from, LocalDate to, Instant verifiedAfter);
    List<StoreOffer> findTop100ByOrderByVerifiedAtDesc();
}
