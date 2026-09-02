package org.jakub.backendapi.repositories;

import org.jakub.backendapi.entities.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface IngredientRepository extends JpaRepository<Ingredient, Long> {
    Optional<Ingredient> findByName(String name);

    Optional<Ingredient> findByNameIgnoreCase(String name);

    @Query("SELECT i FROM Ingredient i WHERE LOWER(i.name) IN :normalizedNames")
    List<Ingredient> findAllByLowerNameIn(@Param("normalizedNames") Collection<String> normalizedNames);

    List<Ingredient> findByCanonicalName(String canonicalName);
}
