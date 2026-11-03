package org.jakub.backendapi.repositories;
import org.jakub.backendapi.entities.ShoppingPreferences;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ShoppingPreferencesRepository extends JpaRepository<ShoppingPreferences, Long> {}
