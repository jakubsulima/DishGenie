package org.jakub.backendapi.repositories;

import org.jakub.backendapi.entities.Enums.Unit;
import org.jakub.backendapi.entities.FridgeIngredient;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;


public interface FridgeIngredientRepository extends JpaRepository<FridgeIngredient, Long> {
    List<FridgeIngredient> findByUser_Id(Long userId);

    default List<FridgeIngredient> findMergeCandidates(Long userId, String name, LocalDate expirationDate, Unit unit) {
        if (expirationDate == null && unit == null) {
            return findByUser_IdAndNameIgnoreCaseAndExpirationDateIsNullAndUnitIsNullOrderByIdAsc(userId, name);
        }

        if (expirationDate == null) {
            return findByUser_IdAndNameIgnoreCaseAndExpirationDateIsNullAndUnitOrderByIdAsc(userId, name, unit);
        }

        if (unit == null) {
            return findByUser_IdAndNameIgnoreCaseAndExpirationDateAndUnitIsNullOrderByIdAsc(userId, name, expirationDate);
        }

        return findByUser_IdAndNameIgnoreCaseAndExpirationDateAndUnitOrderByIdAsc(userId, name, expirationDate, unit);
    }

    List<FridgeIngredient> findByUser_IdAndNameIgnoreCaseAndExpirationDateIsNullAndUnitIsNullOrderByIdAsc(
            Long userId,
            String name
    );

    List<FridgeIngredient> findByUser_IdAndNameIgnoreCaseAndExpirationDateIsNullAndUnitOrderByIdAsc(
            Long userId,
            String name,
            Unit unit
    );

    List<FridgeIngredient> findByUser_IdAndNameIgnoreCaseAndExpirationDateAndUnitIsNullOrderByIdAsc(
            Long userId,
            String name,
            LocalDate expirationDate
    );

    List<FridgeIngredient> findByUser_IdAndNameIgnoreCaseAndExpirationDateAndUnitOrderByIdAsc(
            Long userId,
            String name,
            LocalDate expirationDate,
            Unit unit
    );
}
