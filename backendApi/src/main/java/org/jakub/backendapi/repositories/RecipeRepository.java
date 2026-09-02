package org.jakub.backendapi.repositories;

import org.jakub.backendapi.entities.Recipe;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.entities.Enums.RecipeVisibility;
import org.jakub.backendapi.entities.Enums.ContentLocale;
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

    @Query("""
            SELECT DISTINCT r FROM Recipe r
            LEFT JOIN FETCH r.recipeIngredients ri
            LEFT JOIN FETCH ri.ingredient
            WHERE LOWER(r.name) = LOWER(:name)
            """)
    Optional<Recipe> findByNameIgnoreCaseWithIngredients(@Param("name") String name);

    Page<Recipe> findByUser(User user, Pageable pageable);

    long countByUser(User user);

    Optional<Recipe> findByNameAndUser(String name, User user);

    Optional<Recipe> findByNameAndUserAndLocale(String name, User user, ContentLocale locale);

    @Query("""
            SELECT r.id FROM Recipe r
            """)
    Page<Long> findRecipeIds(Pageable pageable);

    @Query("SELECT r.id FROM Recipe r WHERE r.locale = :locale")
    Page<Long> findRecipeIdsByLocale(@Param("locale") ContentLocale locale, Pageable pageable);

    @Query("""
            SELECT r.id FROM Recipe r
            WHERE r.visibility = :visibility
            """)
    Page<Long> findRecipeIdsByVisibility(@Param("visibility") RecipeVisibility visibility, Pageable pageable);

    @Query("SELECT r.id FROM Recipe r WHERE r.visibility = :visibility AND r.locale = :locale")
    Page<Long> findRecipeIdsByVisibilityAndLocale(
            @Param("visibility") RecipeVisibility visibility,
            @Param("locale") ContentLocale locale,
            Pageable pageable
    );

    @Query("""
            SELECT r.id FROM Recipe r
            WHERE r.user = :user
            """)
    Page<Long> findRecipeIdsByUser(@Param("user") User user, Pageable pageable);

    @Query("SELECT r.id FROM Recipe r WHERE r.user = :user AND r.locale = :locale")
    Page<Long> findRecipeIdsByUserAndLocale(
            @Param("user") User user,
            @Param("locale") ContentLocale locale,
            Pageable pageable
    );

    @Query("""
            SELECT r.id FROM Recipe r
            WHERE LOWER(r.name) LIKE LOWER(CONCAT(:searchTerm, '%'))
            """)
    Page<Long> searchRecipeIds(@Param("searchTerm") String searchTerm, Pageable pageable);

    @Query("SELECT r.id FROM Recipe r WHERE r.locale = :locale AND LOWER(r.name) LIKE LOWER(CONCAT(:searchTerm, '%'))")
    Page<Long> searchRecipeIdsByLocale(
            @Param("searchTerm") String searchTerm,
            @Param("locale") ContentLocale locale,
            Pageable pageable
    );

    @Query("""
            SELECT r.id FROM Recipe r
            WHERE r.visibility = :visibility
              AND LOWER(r.name) LIKE LOWER(CONCAT(:searchTerm, '%'))
            """)
    Page<Long> searchRecipeIdsByVisibility(
            @Param("searchTerm") String searchTerm,
            @Param("visibility") RecipeVisibility visibility,
            Pageable pageable
    );

    @Query("""
            SELECT r.id FROM Recipe r
            WHERE r.visibility = :visibility
              AND r.locale = :locale
              AND LOWER(r.name) LIKE LOWER(CONCAT(:searchTerm, '%'))
            """)
    Page<Long> searchRecipeIdsByVisibilityAndLocale(
            @Param("searchTerm") String searchTerm,
            @Param("visibility") RecipeVisibility visibility,
            @Param("locale") ContentLocale locale,
            Pageable pageable
    );

    @Query("""
            SELECT r.id FROM Recipe r
            WHERE r.user = :user
              AND LOWER(r.name) LIKE LOWER(CONCAT(:searchTerm, '%'))
            """)
    Page<Long> searchRecipeIdsByUser(
            @Param("searchTerm") String searchTerm,
            @Param("user") User user,
            Pageable pageable
    );

    @Query("""
            SELECT r.id FROM Recipe r
            WHERE r.user = :user
              AND r.locale = :locale
              AND LOWER(r.name) LIKE LOWER(CONCAT(:searchTerm, '%'))
            """)
    Page<Long> searchRecipeIdsByUserAndLocale(
            @Param("searchTerm") String searchTerm,
            @Param("user") User user,
            @Param("locale") ContentLocale locale,
            Pageable pageable
    );

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
            WHERE r.id = :id AND r.visibility = :visibility
            """)
    Optional<Recipe> findByIdWithIngredientsAndVisibility(
            @Param("id") Long id,
            @Param("visibility") RecipeVisibility visibility
    );

    @Query("""
            SELECT DISTINCT r FROM Recipe r
            LEFT JOIN FETCH r.recipeIngredients ri
            LEFT JOIN FETCH ri.ingredient
            WHERE LOWER(REPLACE(TRIM(r.name), ' ', '-')) = LOWER(:slug)
            """)
    Optional<Recipe> findBySlugWithIngredients(@Param("slug") String slug);

    @Query("""
            SELECT DISTINCT r FROM Recipe r
            LEFT JOIN FETCH r.recipeIngredients ri
            LEFT JOIN FETCH ri.ingredient
            WHERE LOWER(REPLACE(TRIM(r.name), ' ', '-')) = LOWER(:slug)
              AND r.user = :user
            """)
    Optional<Recipe> findBySlugWithIngredientsAndUser(
            @Param("slug") String slug,
            @Param("user") User user
    );

    @Query("""
            SELECT DISTINCT r FROM Recipe r
            LEFT JOIN FETCH r.recipeIngredients ri
            LEFT JOIN FETCH ri.ingredient
            WHERE LOWER(REPLACE(TRIM(r.name), ' ', '-')) = LOWER(:slug)
              AND r.visibility = :visibility
            """)
    Optional<Recipe> findBySlugWithIngredientsAndVisibility(
            @Param("slug") String slug,
            @Param("visibility") RecipeVisibility visibility
    );

    @Query("""
            SELECT DISTINCT r FROM Recipe r
            LEFT JOIN FETCH r.recipeIngredients ri
            LEFT JOIN FETCH ri.ingredient
            WHERE LOWER(r.name) = LOWER(:name)
              AND r.visibility = :visibility
            """)
    Optional<Recipe> findByNameIgnoreCaseWithIngredientsAndVisibility(
            @Param("name") String name,
            @Param("visibility") RecipeVisibility visibility
    );

    @Query("""
            SELECT DISTINCT r FROM Recipe r
            LEFT JOIN FETCH r.recipeIngredients ri
            LEFT JOIN FETCH ri.ingredient
            WHERE LOWER(r.name) = LOWER(:name)
              AND r.user = :user
            """)
    Optional<Recipe> findByNameIgnoreCaseWithIngredientsAndUser(
            @Param("name") String name,
            @Param("user") User user
    );

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

    @Query("""
            SELECT r.id AS id, r.updatedAt AS updatedAt
            FROM Recipe r
            WHERE r.visibility = :visibility
            ORDER BY r.updatedAt DESC, r.id DESC
            """)
    List<RecipeSitemapEntry> findPublicSitemapEntries(@Param("visibility") RecipeVisibility visibility);
}
