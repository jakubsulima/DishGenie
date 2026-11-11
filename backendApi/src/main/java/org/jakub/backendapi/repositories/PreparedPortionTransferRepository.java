package org.jakub.backendapi.repositories;
import org.jakub.backendapi.entities.PreparedPortionTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface PreparedPortionTransferRepository extends JpaRepository<PreparedPortionTransfer,UUID> {
    List<PreparedPortionTransfer> findBySourcePlanIdAndBatchIdAndReleasedFalse(UUID sourcePlanId,UUID batchId);
    List<PreparedPortionTransfer> findByTargetPlanIdAndReleasedFalse(UUID targetPlanId);
}
