package org.jakub.backendapi.repositories;

import org.jakub.backendapi.entities.FridgeInventoryOperationChange;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FridgeInventoryOperationChangeRepository extends JpaRepository<FridgeInventoryOperationChange, Long> {
    List<FridgeInventoryOperationChange> findByOperation_IdOrderByIdAsc(Long operationId);

    List<FridgeInventoryOperationChange> findByOperation_IdOrderByIdDesc(Long operationId);
}
