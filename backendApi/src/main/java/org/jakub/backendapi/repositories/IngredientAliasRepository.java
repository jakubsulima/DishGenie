package org.jakub.backendapi.repositories;

import org.jakub.backendapi.entities.IngredientAlias;
import org.jakub.backendapi.entities.Enums.ContentLocale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface IngredientAliasRepository extends JpaRepository<IngredientAlias, Long> {
    List<IngredientAlias> findByNormalizedAlias(String normalizedAlias);

    @Query("""
            SELECT alias FROM IngredientAlias alias
            WHERE alias.normalizedAlias = :normalizedAlias
              AND (alias.locale = :locale OR alias.locale IS NULL)
            """)
    List<IngredientAlias> findByNormalizedAliasForLocale(
            @Param("normalizedAlias") String normalizedAlias,
            @Param("locale") ContentLocale locale
    );
}
