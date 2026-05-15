package org.jakub.backendapi.repositories;

import org.jakub.backendapi.entities.Enums.Unit;
import org.jakub.backendapi.entities.FridgeIngredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;


public interface FridgeIngredientRepository extends JpaRepository<FridgeIngredient, Long> {
    List<FridgeIngredient> findByUser_Id(Long userId);

    @Query("""
            SELECT f FROM FridgeIngredient f
            WHERE f.user.id = :userId
              AND LOWER(f.name) = LOWER(:name)
              AND ((:expirationDate IS NULL AND f.expirationDate IS NULL) OR f.expirationDate = :expirationDate)
              AND ((:unit IS NULL AND f.unit IS NULL) OR f.unit = :unit)
            ORDER BY f.id ASC
            """)
    List<FridgeIngredient> findMergeCandidates(
            @Param("userId") Long userId,
            @Param("name") String name,
            @Param("expirationDate") LocalDate expirationDate,
            @Param("unit") Unit unit
    );
}
