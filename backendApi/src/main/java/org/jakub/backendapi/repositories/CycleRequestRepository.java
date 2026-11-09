package org.jakub.backendapi.repositories;
import org.jakub.backendapi.entities.CycleRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface CycleRequestRepository extends JpaRepository<CycleRequest, UUID> {}
