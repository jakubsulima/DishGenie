package org.jakub.backendapi.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.dto.FridgeInventoryChangeRequestDto;
import org.jakub.backendapi.dto.FridgeInventoryChangeResultDto;
import org.jakub.backendapi.dto.FridgeInventoryOperationRequestDto;
import org.jakub.backendapi.dto.FridgeInventoryOperationResponseDto;
import org.jakub.backendapi.entities.Enums.FridgeOperationChangeType;
import org.jakub.backendapi.entities.Enums.FridgeOperationStatus;
import org.jakub.backendapi.entities.Enums.FridgeOperationSource;
import org.jakub.backendapi.entities.Enums.FridgeStockState;
import org.jakub.backendapi.entities.Enums.QuantityAccuracy;
import org.jakub.backendapi.entities.FridgeIngredient;
import org.jakub.backendapi.entities.FridgeInventoryOperation;
import org.jakub.backendapi.entities.FridgeInventoryOperationChange;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.mappers.FridgeIngredientMapper;
import org.jakub.backendapi.repositories.FridgeIngredientRepository;
import org.jakub.backendapi.repositories.FridgeInventoryOperationChangeRepository;
import org.jakub.backendapi.repositories.FridgeInventoryOperationRepository;
import org.jakub.backendapi.repositories.IngredientRepository;
import org.jakub.backendapi.repositories.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Objects;

@Service
public class FridgeInventoryOperationService {
    private static final int MAX_CHANGES = 50;
    private static final int MAX_SOURCE_REFERENCE_LENGTH = 100;

    private final FridgeService fridgeService;
    private final FridgeIngredientRepository fridgeIngredientRepository;
    private final UserRepository userRepository;
    private final FridgeInventoryOperationRepository operationRepository;
    private final FridgeInventoryOperationChangeRepository changeRepository;
    private final FridgeIngredientMapper fridgeIngredientMapper;
    private final ObjectMapper objectMapper;
    private final IngredientRepository ingredientRepository;

    public FridgeInventoryOperationService(
            FridgeService fridgeService,
            FridgeIngredientRepository fridgeIngredientRepository,
            UserRepository userRepository,
            FridgeInventoryOperationRepository operationRepository,
            FridgeIngredientMapper fridgeIngredientMapper,
            ObjectMapper objectMapper
    ) {
        this(fridgeService, fridgeIngredientRepository, userRepository, operationRepository, null,
                fridgeIngredientMapper, objectMapper, null);
    }

    public FridgeInventoryOperationService(
            FridgeService fridgeService,
            FridgeIngredientRepository fridgeIngredientRepository,
            UserRepository userRepository,
            FridgeInventoryOperationRepository operationRepository,
            FridgeInventoryOperationChangeRepository changeRepository,
            FridgeIngredientMapper fridgeIngredientMapper,
            ObjectMapper objectMapper
    ) {
        this(fridgeService, fridgeIngredientRepository, userRepository, operationRepository, changeRepository,
                fridgeIngredientMapper, objectMapper, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public FridgeInventoryOperationService(
            FridgeService fridgeService,
            FridgeIngredientRepository fridgeIngredientRepository,
            UserRepository userRepository,
            FridgeInventoryOperationRepository operationRepository,
            FridgeInventoryOperationChangeRepository changeRepository,
            FridgeIngredientMapper fridgeIngredientMapper,
            ObjectMapper objectMapper,
            IngredientRepository ingredientRepository
    ) {
        this.fridgeService = fridgeService;
        this.fridgeIngredientRepository = fridgeIngredientRepository;
        this.userRepository = userRepository;
        this.operationRepository = operationRepository;
        this.changeRepository = changeRepository;
        this.fridgeIngredientMapper = fridgeIngredientMapper;
        this.objectMapper = objectMapper;
        this.ingredientRepository = ingredientRepository;
    }

    @Transactional
    public FridgeInventoryOperationResponseDto apply(
            FridgeInventoryOperationRequestDto request,
            String email
    ) {
        validateRequest(request);
        User user = userRepository.findByEmailForUpdate(email)
                .orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));

        Optional<FridgeInventoryOperation> existing = operationRepository
                .findByUser_IdAndClientOperationId(user.getId(), request.getOperationId());
        if (existing.isPresent()) {
            return readStoredResult(existing.get());
        }

        FridgeInventoryOperation operation = new FridgeInventoryOperation();
        operation.setUser(user);
        operation.setClientOperationId(request.getOperationId());
        operation.setSource(request.getSource());
        operation.setSourceReference(trimToNull(request.getSourceReference()));

        List<FridgeInventoryChangeResultDto> applied = new ArrayList<>();
        List<FridgeInventoryChangeResultDto> skipped = new ArrayList<>();
        List<FridgeInventoryOperationChange> history = new ArrayList<>();

        for (FridgeInventoryChangeRequestDto change : request.getChanges()) {
            IngredientSnapshot before = snapshot(resolveBefore(change, user.getId()));
            FridgeInventoryChangeResultDto result = applyChange(change, request.getSource(), user);
            if ("APPLIED".equals(result.getStatus())) {
                applied.add(result);
            } else {
                skipped.add(result);
            }
            if ("APPLIED".equals(result.getStatus())) {
                history.add(toHistory(operation, change, before, result.getFridgeItemId()));
            }
        }

        FridgeOperationStatus status = skipped.isEmpty() ? FridgeOperationStatus.APPLIED : FridgeOperationStatus.PARTIAL;
        FridgeInventoryOperationResponseDto response = new FridgeInventoryOperationResponseDto(
                request.getOperationId(),
                status,
                applied,
                skipped,
                currentItems(user.getId(), applied)
        );
        operation.setStatus(status);
        operation.setResultJson(writeResult(response));
        operationRepository.save(operation);
        if (changeRepository != null) {
            history.forEach(changeRepository::save);
        }
        return response;
    }

    @Transactional
    public FridgeInventoryOperationResponseDto undo(
            String operationId,
            String undoOperationId,
            String email
    ) {
        validateOperationId(undoOperationId, "Undo operation ID");
        User user = userRepository.findByEmailForUpdate(email)
                .orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));
        FridgeInventoryOperation original = operationRepository
                .findByUser_IdAndClientOperationId(user.getId(), operationId)
                .orElseThrow(() -> new AppException("Fridge operation not found", HttpStatus.NOT_FOUND));

        if (original.getUndoOperationId() != null) {
            FridgeInventoryOperation previousUndo = operationRepository
                    .findByUser_IdAndClientOperationId(user.getId(), original.getUndoOperationId())
                    .orElseThrow(() -> new AppException("Stored undo result is missing", HttpStatus.INTERNAL_SERVER_ERROR));
            return readStoredResult(previousUndo);
        }
        if (changeRepository == null) {
            throw new AppException("Undo history is unavailable", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        List<FridgeInventoryChangeResultDto> applied = new ArrayList<>();
        List<FridgeInventoryChangeResultDto> skipped = new ArrayList<>();
        for (FridgeInventoryOperationChange change : changeRepository
                .findByOperation_IdOrderByIdDesc(getOperationId(original))) {
            FridgeIngredient current = change.getFridgeItemId() == null
                    ? null
                    : fridgeIngredientRepository.findById(change.getFridgeItemId()).orElse(null);
            if (!matchesAfter(change, current)) {
                throw new AppException("This fridge item changed after the operation and cannot be undone safely", HttpStatus.CONFLICT);
            }
            restoreBefore(change, current, user);
            applied.add(new FridgeInventoryChangeResultDto(
                    change.getChangeType(), change.getFridgeItemId(), "APPLIED", null));
        }

        FridgeInventoryOperation undoOperation = new FridgeInventoryOperation();
        undoOperation.setUser(user);
        undoOperation.setClientOperationId(undoOperationId);
        undoOperation.setSource(original.getSource());
        undoOperation.setSourceReference(original.getClientOperationId());
        FridgeInventoryOperationResponseDto response = new FridgeInventoryOperationResponseDto(
                undoOperationId,
                FridgeOperationStatus.APPLIED,
                applied,
                skipped,
                currentItems(user.getId(), applied)
        );
        undoOperation.setStatus(FridgeOperationStatus.APPLIED);
        undoOperation.setResultJson(writeResult(response));
        operationRepository.save(undoOperation);
        original.setUndoOperationId(undoOperationId);
        operationRepository.save(original);
        return response;
    }

    private Long getOperationId(FridgeInventoryOperation operation) {
        if (operation.getId() == null) {
            throw new AppException("Stored fridge operation ID is unavailable", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return operation.getId();
    }

    private boolean matchesAfter(FridgeInventoryOperationChange change, FridgeIngredient current) {
        if (!change.isAfterExists()) {
            return current == null;
        }
        return current != null
                && Objects.equals(change.getAfterName(), current.getName())
                && Objects.equals(change.getAfterAmount(), current.getAmount())
                && Objects.equals(change.getAfterUnit(), current.getUnit())
                && Objects.equals(change.getAfterExpirationDate(), current.getExpirationDate())
                && Objects.equals(normalizedStockState(change.getAfterStockState()), normalizedStockState(current.getStockState()))
                && Objects.equals(normalizedSource(change.getAfterSource()), normalizedSource(current.getSource()))
                && Objects.equals(normalizedAccuracy(change.getAfterQuantityAccuracy()), normalizedAccuracy(current.getQuantityAccuracy()))
                && Objects.equals(change.getAfterBarcode(), current.getBarcode())
                && Objects.equals(change.getAfterLastConfirmedAt(), current.getLastConfirmedAt())
                && Objects.equals(change.getAfterIngredientId(), current.getIngredient() == null ? null : current.getIngredient().getId());
    }

    private void restoreBefore(
            FridgeInventoryOperationChange change,
            FridgeIngredient current,
            User user
    ) {
        if (!change.isBeforeExists()) {
            if (current != null) {
                fridgeIngredientRepository.deleteById(current.getId());
            }
            return;
        }

        FridgeIngredient target = current;
        if (target == null) {
            target = new FridgeIngredient();
            target.setId(change.getFridgeItemId());
            target.setUser(user);
        }
        target.setName(change.getBeforeName());
        target.setAmount(change.getBeforeAmount());
        target.setUnit(change.getBeforeUnit());
        target.setExpirationDate(change.getBeforeExpirationDate());
        target.setStockState(Optional.ofNullable(change.getBeforeStockState()).orElse(FridgeStockState.IN_STOCK));
        target.setSource(Optional.ofNullable(change.getBeforeSource()).orElse(FridgeOperationSource.MANUAL));
        target.setQuantityAccuracy(Optional.ofNullable(change.getBeforeQuantityAccuracy()).orElse(QuantityAccuracy.UNKNOWN));
        target.setBarcode(change.getBeforeBarcode());
        target.setLastConfirmedAt(change.getBeforeLastConfirmedAt());
        target.setIngredient(change.getBeforeIngredientId() == null || ingredientRepository == null
                ? null
                : ingredientRepository.findById(change.getBeforeIngredientId()).orElse(null));
        fridgeIngredientRepository.save(target);
    }

    private FridgeInventoryChangeResultDto applyChange(
            FridgeInventoryChangeRequestDto change,
            FridgeOperationSource source,
            User user
    ) {
        if (change.getType() == null) {
            throw badRequest("Change type is required");
        }

        return switch (change.getType()) {
            case ADD -> applyAdd(change, source, user);
            case DECREMENT -> applyDecrement(change, user);
            case FINISH -> applyFinish(change, user);
            case MARK_LOW -> applyMarkLow(change, user);
        };
    }

    private FridgeInventoryChangeResultDto applyAdd(
            FridgeInventoryChangeRequestDto change,
            FridgeOperationSource source,
            User user
    ) {
        String name = requireName(change.getName());
        QuantityAccuracy accuracy = Optional.ofNullable(change.getQuantityAccuracy()).orElse(QuantityAccuracy.UNKNOWN);
        Double amount = accuracy == QuantityAccuracy.UNKNOWN ? null : requirePositive(change.getAmount());
        Instant confirmedAt = Instant.now();
        FridgeIngredientDto dto = new FridgeIngredientDto(null, name, change.getExpirationDate(), amount, change.getUnit());
        dto.setSource(source);
        dto.setQuantityAccuracy(accuracy);
        dto.setBarcode(trimToNull(change.getBarcode()));
        dto.setStockState(FridgeStockState.IN_STOCK);
        dto.setLastConfirmedAt(confirmedAt);
        FridgeIngredient result = fridgeService.addFridgeIngredientForUser(dto, user);
        result.setSource(source);
        result.setQuantityAccuracy(accuracy);
        result.setBarcode(trimToNull(change.getBarcode()));
        result.setLastConfirmedAt(confirmedAt);
        if (result.getStockState() == null) {
            result.setStockState(FridgeStockState.IN_STOCK);
        }
        fridgeIngredientRepository.save(result);
        return applied(FridgeOperationChangeType.ADD, result.getId(), change.getClientChangeId());
    }

    private FridgeInventoryChangeResultDto applyDecrement(
            FridgeInventoryChangeRequestDto change,
            User user
    ) {
        FridgeIngredient item = resolveRequiredItem(change, user.getId(), "decrement");
        if (item.getAmount() == null) {
            return skipped(FridgeOperationChangeType.DECREMENT, item.getId(), "UNKNOWN_AMOUNT", change.getClientChangeId());
        }
        double decrement = requirePositive(change.getAmount());
        double remaining = item.getAmount() - decrement;
        if (remaining <= 0) {
            fridgeIngredientRepository.deleteById(item.getId());
        } else {
            item.setAmount(remaining);
            item.setLastConfirmedAt(Instant.now());
            fridgeIngredientRepository.save(item);
        }
        return applied(FridgeOperationChangeType.DECREMENT, item.getId(), change.getClientChangeId());
    }

    private FridgeInventoryChangeResultDto applyFinish(
            FridgeInventoryChangeRequestDto change,
            User user
    ) {
        FridgeIngredient item = resolveRequiredItem(change, user.getId(), "finish");
        fridgeIngredientRepository.deleteById(item.getId());
        return applied(FridgeOperationChangeType.FINISH, item.getId(), change.getClientChangeId());
    }

    private FridgeInventoryChangeResultDto applyMarkLow(
            FridgeInventoryChangeRequestDto change,
            User user
    ) {
        FridgeIngredient item = resolveRequiredItem(change, user.getId(), "mark low");
        item.setStockState(Optional.ofNullable(change.getStockState()).orElse(FridgeStockState.LOW));
        item.setLastConfirmedAt(Instant.now());
        fridgeIngredientRepository.save(item);
        return applied(FridgeOperationChangeType.MARK_LOW, item.getId(), change.getClientChangeId());
    }

    private FridgeIngredient resolveRequiredItem(FridgeInventoryChangeRequestDto change, Long userId, String action) {
        FridgeIngredient item = resolveBefore(change, userId);
        if (item == null) {
            throw new AppException("Fridge ingredient not found for " + action, HttpStatus.NOT_FOUND);
        }
        if (!item.getUser().getId().equals(userId)) {
            throw new AppException("You do not have permission to change this fridge ingredient", HttpStatus.FORBIDDEN);
        }
        return item;
    }

    private FridgeIngredient resolveBefore(FridgeInventoryChangeRequestDto change, Long userId) {
        if (change.getFridgeItemId() != null) {
            FridgeIngredient item = fridgeIngredientRepository.findById(change.getFridgeItemId()).orElse(null);
            if (item != null && !item.getUser().getId().equals(userId)) {
                throw new AppException("You do not have permission to change this fridge ingredient", HttpStatus.FORBIDDEN);
            }
            return item;
        }
        if (!StringUtils.hasText(change.getName())) {
            return null;
        }
        String normalizedName = fridgeService.requireIngredientName(change.getName());
        return fridgeIngredientRepository.findByUser_Id(userId).stream()
                .filter(item -> item.getName().equalsIgnoreCase(normalizedName))
                .sorted(Comparator.comparing(FridgeIngredient::getExpirationDate,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(FridgeIngredient::getId))
                .findFirst()
                .orElse(null);
    }

    private List<FridgeIngredientDto> currentItems(Long userId, List<FridgeInventoryChangeResultDto> applied) {
        List<Long> ids = applied.stream().map(FridgeInventoryChangeResultDto::getFridgeItemId).toList();
        return fridgeIngredientRepository.findByUser_Id(userId).stream()
                .filter(item -> ids.contains(item.getId()))
                .map(fridgeIngredientMapper::toFridgeIngredientDto)
                .toList();
    }

    private FridgeInventoryOperationChange toHistory(
            FridgeInventoryOperation operation,
            FridgeInventoryChangeRequestDto request,
            IngredientSnapshot before,
            Long afterId
    ) {
        FridgeInventoryOperationChange history = new FridgeInventoryOperationChange();
        history.setOperation(operation);
        history.setChangeType(request.getType());
        history.setFridgeItemId(afterId != null ? afterId : request.getFridgeItemId());
        history.setBeforeExists(before.exists());
        history.setBeforeName(before.name());
        history.setBeforeAmount(before.amount());
        history.setBeforeUnit(before.unit());
        history.setBeforeExpirationDate(before.expirationDate());
        history.setBeforeStockState(before.stockState());
        history.setBeforeSource(before.source());
        history.setBeforeQuantityAccuracy(before.quantityAccuracy());
        history.setBeforeBarcode(before.barcode());
        history.setBeforeLastConfirmedAt(before.lastConfirmedAt());
        history.setBeforeIngredientId(before.ingredientId());
        if (afterId != null) {
            FridgeIngredient after = fridgeIngredientRepository.findById(afterId).orElse(null);
            if (after != null) {
                IngredientSnapshot snapshot = snapshot(after);
                history.setAfterExists(snapshot.exists());
                history.setAfterName(snapshot.name());
                history.setAfterAmount(snapshot.amount());
                history.setAfterUnit(snapshot.unit());
                history.setAfterExpirationDate(snapshot.expirationDate());
                history.setAfterStockState(snapshot.stockState());
                history.setAfterSource(snapshot.source());
                history.setAfterQuantityAccuracy(snapshot.quantityAccuracy());
                history.setAfterBarcode(snapshot.barcode());
                history.setAfterLastConfirmedAt(snapshot.lastConfirmedAt());
                history.setAfterIngredientId(snapshot.ingredientId());
            }
        }
        return history;
    }

    private IngredientSnapshot snapshot(FridgeIngredient item) {
        if (item == null) {
            return new IngredientSnapshot(false, null, null, null, null, null, null, null, null, null, null);
        }
        return new IngredientSnapshot(
                true,
                item.getName(),
                item.getAmount(),
                item.getUnit(),
                item.getExpirationDate(),
                normalizedSource(item.getSource()),
                normalizedAccuracy(item.getQuantityAccuracy()),
                item.getBarcode(),
                item.getLastConfirmedAt(),
                item.getIngredient() == null ? null : item.getIngredient().getId(),
                normalizedStockState(item.getStockState())
        );
    }

    private FridgeOperationSource normalizedSource(FridgeOperationSource source) {
        return Optional.ofNullable(source).orElse(FridgeOperationSource.MANUAL);
    }

    private QuantityAccuracy normalizedAccuracy(QuantityAccuracy accuracy) {
        return Optional.ofNullable(accuracy).orElse(QuantityAccuracy.UNKNOWN);
    }

    private FridgeStockState normalizedStockState(FridgeStockState stockState) {
        return Optional.ofNullable(stockState).orElse(FridgeStockState.IN_STOCK);
    }

    private record IngredientSnapshot(
            boolean exists,
            String name,
            Double amount,
            org.jakub.backendapi.entities.Enums.Unit unit,
            java.time.LocalDate expirationDate,
            FridgeOperationSource source,
            QuantityAccuracy quantityAccuracy,
            String barcode,
            Instant lastConfirmedAt,
            Long ingredientId,
            FridgeStockState stockState
    ) {}

    private FridgeInventoryOperationResponseDto readStoredResult(FridgeInventoryOperation operation) {
        try {
            return objectMapper.readValue(operation.getResultJson(), FridgeInventoryOperationResponseDto.class);
        } catch (JsonProcessingException exception) {
            throw new AppException("Stored fridge operation result is invalid", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private String writeResult(FridgeInventoryOperationResponseDto response) {
        try {
            return objectMapper.writeValueAsString(response);
        } catch (JsonProcessingException exception) {
            throw new AppException("Could not store fridge operation result", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private void validateRequest(FridgeInventoryOperationRequestDto request) {
        if (request == null || request.getSource() == null || !StringUtils.hasText(request.getOperationId())) {
            throw badRequest("Operation ID and source are required");
        }
        validateOperationId(request.getOperationId(), "Operation ID");
        if (request.getChanges() == null || request.getChanges().isEmpty() || request.getChanges().size() > MAX_CHANGES) {
            throw badRequest("An operation must contain between 1 and " + MAX_CHANGES + " changes");
        }
        if (request.getSourceReference() != null && request.getSourceReference().length() > MAX_SOURCE_REFERENCE_LENGTH) {
            throw badRequest("Operation source reference is too long");
        }
    }

    private void validateOperationId(String operationId, String label) {
        try {
            UUID.fromString(operationId);
        } catch (IllegalArgumentException exception) {
            throw badRequest(label + " must be a UUID");
        }
    }

    private String requireName(String name) {
        if (!StringUtils.hasText(name) || name.trim().length() > 100) {
            throw badRequest("Fridge item name is required and must not exceed 100 characters");
        }
        return name.trim();
    }

    private double requirePositive(Double amount) {
        if (amount == null || !Double.isFinite(amount) || amount <= 0) {
            throw badRequest("Change amount must be positive");
        }
        return amount;
    }

    private AppException badRequest(String message) {
        return new AppException(message, HttpStatus.BAD_REQUEST);
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private FridgeInventoryChangeResultDto applied(FridgeOperationChangeType type, Long id, String clientChangeId) {
        return new FridgeInventoryChangeResultDto(type, id, "APPLIED", null, clientChangeId);
    }

    private FridgeInventoryChangeResultDto skipped(FridgeOperationChangeType type, Long id, String reason, String clientChangeId) {
        return new FridgeInventoryChangeResultDto(type, id, "SKIPPED", reason, clientChangeId);
    }
}
