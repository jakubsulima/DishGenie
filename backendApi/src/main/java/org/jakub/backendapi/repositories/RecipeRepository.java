package org.jakub.backendapi.repositories;

import org.jakub.backendapi.entities.Recipe;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.repositories.projections.RecipeSitemapEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    Optional<Recipe> findByName(String name);

    Page<Recipe> findByUser(User user, Pageable pageable);

    long countByUser(User user);

    Optional<Recipe> findByNameAndUser(String name, User user);

    @Query("""
            SELECT r.id FROM Recipe r
            """)
    Page<Long> findRecipeIds(Pageable pageable);

    @Query("""
            SELECT r.id FROM Recipe r
            WHERE r.user = :user
            """)
    Page<Long> findRecipeIdsByUser(@Param("user") User user, Pageable pageable);

    @Query("""
            SELECT r.id FROM Recipe r
            WHERE LOWER(r.name) LIKE LOWER(CONCAT(:searchTerm, '%'))
            """)
    Page<Long> searchRecipeIds(@Param("searchTerm") String searchTerm, Pageable pageable);

    @Query("""
            SELECT DISTINCT r FROM Recipe r
            LEFT JOIN FETCH r.recipeIngredients ri
            LEFT JOIN FETCH ri.ingredient
            WHERE r.id = :id
            """)
    Optional<Recipe> findByIdWithIngredients(@Param("id") Long id);

    @Query("""
            SELECT DISTINCT r FROM Recipe r
            LEFT JOIN FETCH r.recipeIngredients ri
            LEFT JOIN FETCH ri.ingredient
            WHERE r.id IN :ids
            """)
    List<Recipe> findAllWithIngredientsByIdIn(@Param("ids") List<Long> ids);

    @Query("""
            SELECT r.id AS id, r.updatedAt AS updatedAt
            FROM Recipe r
            ORDER BY r.updatedAt DESC, r.id DESC
            """)
    List<RecipeSitemapEntry> findAllSitemapEntries();
}
