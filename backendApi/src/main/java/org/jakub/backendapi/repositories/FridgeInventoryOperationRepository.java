package org.jakub.backendapi.repositories;

import org.jakub.backendapi.entities.FridgeInventoryOperation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FridgeInventoryOperationRepository extends JpaRepository<FridgeInventoryOperation, Long> {
    Optional<FridgeInventoryOperation> findByUser_IdAndClientOperationId(Long userId, String clientOperationId);
}
