package org.jakub.backendapi.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.dto.FridgeInventoryChangeRequestDto;
import org.jakub.backendapi.dto.FridgeInventoryOperationRequestDto;
import org.jakub.backendapi.dto.FridgeInventoryOperationResponseDto;
import org.jakub.backendapi.entities.Enums.FridgeOperationChangeType;
import org.jakub.backendapi.entities.Enums.FridgeOperationSource;
import org.jakub.backendapi.entities.Enums.FridgeOperationStatus;
import org.jakub.backendapi.entities.FridgeIngredient;
import org.jakub.backendapi.entities.FridgeInventoryOperation;
import org.jakub.backendapi.entities.FridgeInventoryOperationChange;
import org.jakub.backendapi.entities.Enums.FridgeStockState;
import org.jakub.backendapi.entities.Enums.QuantityAccuracy;
import org.jakub.backendapi.entities.Enums.Unit;
import org.jakub.backendapi.entities.Ingredient;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.mappers.FridgeIngredientMapper;
import org.jakub.backendapi.repositories.FridgeIngredientRepository;
import org.jakub.backendapi.repositories.FridgeInventoryOperationChangeRepository;
import org.jakub.backendapi.repositories.FridgeInventoryOperationRepository;
import org.jakub.backendapi.repositories.UserRepository;
import org.jakub.backendapi.repositories.IngredientRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.jakub.backendapi.exceptions.AppException;

import java.time.LocalDate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FridgeInventoryOperationServiceTest {
    @Mock private FridgeService fridgeService;
    @Mock private FridgeIngredientRepository fridgeIngredientRepository;
    @Mock private UserRepository userRepository;
    @Mock private FridgeInventoryOperationRepository operationRepository;
    @Mock private FridgeInventoryOperationChangeRepository changeRepository;
    @Mock private FridgeIngredientMapper mapper;
    @Mock private IngredientRepository ingredientRepository;

    private FridgeInventoryOperationService service;
    private User owner;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setId(7L);
        owner.setEmail("owner@example.com");
        service = new FridgeInventoryOperationService(
                fridgeService,
                fridgeIngredientRepository,
                userRepository,
                operationRepository,
                changeRepository,
                mapper,
                new ObjectMapper(),
                ingredientRepository
        );
    }

    @Test
    void applyingTheSameOperationIdTwiceChangesTheFridgeOnlyOnce() {
        FridgeInventoryOperationRequestDto request = request("d2719c62-f9d2-4ad7-8d4e-5b77e9f9de29");
        FridgeIngredient added = new FridgeIngredient();
        added.setId(42L);
        added.setName("Milk");
        FridgeIngredientDto addedDto = new FridgeIngredientDto(42L, "Milk", null, null, null);

        when(userRepository.findByEmailForUpdate("owner@example.com")).thenReturn(Optional.of(owner));
        when(operationRepository.findByUser_IdAndClientOperationId(7L, request.getOperationId()))
                .thenReturn(Optional.empty(), Optional.of(savedOperation(request, addedDto)));
        when(fridgeService.addFridgeIngredientForUser(any(), eq(owner))).thenReturn(added);
        when(mapper.toFridgeIngredientDto(added)).thenReturn(addedDto);
        when(fridgeIngredientRepository.findByUser_Id(7L)).thenReturn(List.of(added));
        when(operationRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        FridgeInventoryOperationResponseDto first = service.apply(request, owner.getEmail());
        FridgeInventoryOperationResponseDto second = service.apply(request, owner.getEmail());

        assertEquals(first.getOperationId(), second.getOperationId());
        assertEquals(first.getAppliedChanges().size(), second.getAppliedChanges().size());
        verify(fridgeService, times(1)).addFridgeIngredientForUser(any(), eq(owner));
    }

    @Test
    void decrementRemovesAnItemWhenTheRemainingAmountReachesZero() {
        FridgeIngredient item = item(3L, "Milk", 1D, owner);
        FridgeInventoryOperationRequestDto request = request("b0d5c9b2-6040-44aa-8c10-5d46fb0f76f4");
        FridgeInventoryChangeRequestDto change = change(FridgeOperationChangeType.DECREMENT);
        change.setFridgeItemId(3L);
        change.setAmount(2D);
        request.setChanges(List.of(change));
        prepareNewOperation(request);
        when(fridgeIngredientRepository.findById(3L)).thenReturn(Optional.of(item));

        FridgeInventoryOperationResponseDto response = service.apply(request, owner.getEmail());

        assertEquals(FridgeOperationStatus.APPLIED, response.getStatus());
        verify(fridgeIngredientRepository).deleteById(3L);
        verify(fridgeIngredientRepository, never()).save(item);
    }

    @Test
    void operationCannotChangeAnotherUsersItem() {
        User other = new User();
        other.setId(99L);
        FridgeIngredient item = item(4L, "Milk", 1D, other);
        FridgeInventoryOperationRequestDto request = request("7f884e48-95ca-49c5-9bdb-10e0b5f36b7f");
        FridgeInventoryChangeRequestDto change = change(FridgeOperationChangeType.FINISH);
        change.setFridgeItemId(4L);
        request.setChanges(List.of(change));
        prepareNewOperation(request);
        when(fridgeIngredientRepository.findById(4L)).thenReturn(Optional.of(item));

        AppException exception = assertThrows(AppException.class, () -> service.apply(request, owner.getEmail()));

        assertEquals(HttpStatus.FORBIDDEN, exception.getCode());
        verify(fridgeIngredientRepository, never()).deleteById(4L);
        verify(operationRepository, never()).save(any());
    }

    @Test
    void decrementWithoutAnExplicitIdUsesFefoOrder() {
        FridgeIngredient later = item(10L, "Milk", 2D, owner);
        later.setExpirationDate(LocalDate.of(2026, 9, 20));
        FridgeIngredient sooner = item(11L, "Milk", 1D, owner);
        sooner.setExpirationDate(LocalDate.of(2026, 9, 5));
        FridgeIngredient undated = item(12L, "Milk", 1D, owner);
        FridgeInventoryOperationRequestDto request = request("94d34c95-93f8-4f3c-8436-22fb9c1597b8");
        FridgeInventoryChangeRequestDto change = change(FridgeOperationChangeType.DECREMENT);
        change.setName("Milk");
        change.setAmount(1D);
        request.setChanges(List.of(change));
        prepareNewOperation(request);
        doReturn(List.of(later, undated, sooner)).when(fridgeIngredientRepository).findByUser_Id(7L);
        when(fridgeService.requireIngredientName("Milk")).thenReturn("Milk");

        service.apply(request, owner.getEmail());

        verify(fridgeIngredientRepository).deleteById(11L);
        verify(fridgeIngredientRepository, never()).deleteById(10L);
        verify(fridgeIngredientRepository, never()).deleteById(12L);
    }

    @Test
    void failedChangeDoesNotPersistTheOperation() {
        FridgeInventoryOperationRequestDto request = request("5be5a982-74a5-4d9e-88b1-cd776e4e28d1");
        FridgeInventoryChangeRequestDto add = change(FridgeOperationChangeType.ADD);
        add.setName("Milk");
        FridgeInventoryChangeRequestDto invalid = new FridgeInventoryChangeRequestDto();
        request.setChanges(List.of(add, invalid));
        prepareNewOperation(request);
        FridgeIngredient added = item(42L, "Milk", null, owner);
        when(fridgeService.addFridgeIngredientForUser(any(), eq(owner))).thenReturn(added);

        assertThrows(AppException.class, () -> service.apply(request, owner.getEmail()));

        verify(operationRepository, never()).save(any());
    }

    @Test
    void undoRestoresTheExactPreviousAmount() {
        FridgeInventoryOperation original = new FridgeInventoryOperation();
        original.setId(100L);
        original.setUser(owner);
        original.setClientOperationId("2ed4c8a1-cc2c-4e73-8610-ec5f251935a5");
        original.setSource(FridgeOperationSource.QUICK_ADJUSTMENT);
        original.setStatus(FridgeOperationStatus.APPLIED);

        FridgeInventoryOperationChange history = new FridgeInventoryOperationChange();
        history.setFridgeItemId(3L);
        history.setChangeType(FridgeOperationChangeType.DECREMENT);
        history.setBeforeExists(true);
        history.setBeforeName("Milk");
        history.setBeforeAmount(2D);
        history.setBeforeStockState(FridgeStockState.IN_STOCK);
        history.setAfterExists(true);
        history.setAfterName("Milk");
        history.setAfterAmount(1D);
        history.setAfterStockState(FridgeStockState.IN_STOCK);

        FridgeIngredient current = item(3L, "Milk", 1D, owner);
        current.setStockState(FridgeStockState.IN_STOCK);
        prepareNewUndo(original);
        when(changeRepository.findByOperation_IdOrderByIdDesc(100L)).thenReturn(List.of(history));
        when(fridgeIngredientRepository.findById(3L)).thenReturn(Optional.of(current));
        when(fridgeIngredientRepository.findByUser_Id(7L)).thenReturn(List.of(current));
        when(operationRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.undo(
                original.getClientOperationId(),
                "a3cf0f4e-1a99-4bb7-b8e8-2a88ef9e0a20",
                owner.getEmail()
        );

        assertEquals(2D, current.getAmount());
        verify(fridgeIngredientRepository).save(current);
        assertEquals("a3cf0f4e-1a99-4bb7-b8e8-2a88ef9e0a20", original.getUndoOperationId());
    }

    @Test
    void undoRefusesWhenTheItemChangedAfterTheOriginalOperation() {
        FridgeInventoryOperation original = new FridgeInventoryOperation();
        original.setId(101L);
        original.setUser(owner);
        original.setClientOperationId("3ed4c8a1-cc2c-4e73-8610-ec5f251935a5");
        original.setSource(FridgeOperationSource.QUICK_ADJUSTMENT);
        original.setStatus(FridgeOperationStatus.APPLIED);

        FridgeInventoryOperationChange history = new FridgeInventoryOperationChange();
        history.setFridgeItemId(3L);
        history.setChangeType(FridgeOperationChangeType.DECREMENT);
        history.setAfterExists(true);
        history.setAfterName("Milk");
        history.setAfterAmount(1D);
        history.setAfterStockState(FridgeStockState.IN_STOCK);
        prepareNewUndo(original);
        when(changeRepository.findByOperation_IdOrderByIdDesc(101L)).thenReturn(List.of(history));
        when(fridgeIngredientRepository.findById(3L)).thenReturn(Optional.of(item(3L, "Milk", 4D, owner)));

        AppException exception = assertThrows(AppException.class, () -> service.undo(
                original.getClientOperationId(),
                "b3cf0f4e-1a99-4bb7-b8e8-2a88ef9e0a20",
                owner.getEmail()
        ));

        assertEquals(HttpStatus.CONFLICT, exception.getCode());
        verify(fridgeIngredientRepository, never()).save(any());
        verify(operationRepository, never()).save(any());
    }

    @Test
    void historyKeepsBeforeSnapshotWhenAddingToAnExistingItemMutatesTheEntity() {
        FridgeIngredient item = item(42L, "Milk", 2D, owner);
        item.setSource(FridgeOperationSource.MANUAL);
        item.setQuantityAccuracy(QuantityAccuracy.EXACT);
        FridgeInventoryOperationRequestDto request = request("e5d83f8f-69de-4c06-bf3a-3bd1b06a19a0");
        request.getChanges().get(0).setAmount(1D);
        request.getChanges().get(0).setQuantityAccuracy(QuantityAccuracy.EXACT);
        prepareNewOperation(request);
        when(fridgeIngredientRepository.findByUser_Id(7L)).thenReturn(List.of(item));
        when(fridgeService.requireIngredientName("Milk")).thenReturn("Milk");
        when(fridgeService.addFridgeIngredientForUser(any(), eq(owner))).thenAnswer(invocation -> {
            item.setAmount(3D);
            return item;
        });
        when(fridgeIngredientRepository.findById(42L)).thenReturn(Optional.of(item));
        when(mapper.toFridgeIngredientDto(item)).thenReturn(new FridgeIngredientDto(42L, "Milk", null, 3D, null));

        service.apply(request, owner.getEmail());

        var history = capturedHistory();
        assertEquals(2D, history.getBeforeAmount());
        assertEquals(3D, history.getAfterAmount());
        assertEquals(FridgeOperationSource.MANUAL, history.getBeforeSource());
        assertEquals(FridgeOperationSource.SHOPPING_LIST, history.getAfterSource());
    }

    @Test
    void undoReversesTwoSequentialChangesToTheSameItem() {
        FridgeIngredient item = item(43L, "Milk", 3D, owner);
        FridgeInventoryOperationRequestDto request = request("2d2f989d-ec23-4932-a11a-b765f6c6482d");
        FridgeInventoryChangeRequestDto first = change(FridgeOperationChangeType.DECREMENT);
        first.setFridgeItemId(43L);
        first.setAmount(1D);
        FridgeInventoryChangeRequestDto second = change(FridgeOperationChangeType.DECREMENT);
        second.setFridgeItemId(43L);
        second.setAmount(1D);
        request.setChanges(List.of(first, second));
        prepareNewOperation(request);
        when(fridgeIngredientRepository.findById(43L)).thenReturn(Optional.of(item));
        when(fridgeIngredientRepository.findByUser_Id(7L)).thenReturn(List.of(item));
        when(mapper.toFridgeIngredientDto(item)).thenReturn(new FridgeIngredientDto(43L, "Milk", null, 1D, null));
        List<FridgeInventoryOperationChange> savedHistory = new ArrayList<>();
        when(changeRepository.save(any())).thenAnswer(invocation -> {
            FridgeInventoryOperationChange history = invocation.getArgument(0);
            history.setId((long) savedHistory.size() + 1);
            savedHistory.add(history);
            return history;
        });
        FridgeInventoryOperation original = new FridgeInventoryOperation();
        original.setId(301L);
        original.setUser(owner);
        original.setClientOperationId(request.getOperationId());
        original.setSource(request.getSource());
        when(operationRepository.findByUser_IdAndClientOperationId(7L, request.getOperationId()))
                .thenReturn(Optional.empty(), Optional.of(original));
        when(operationRepository.save(any())).thenAnswer(invocation -> {
            FridgeInventoryOperation operation = invocation.getArgument(0);
            if (operation.getId() == null) operation.setId(301L);
            return operation;
        });

        service.apply(request, owner.getEmail());
        when(changeRepository.findByOperation_IdOrderByIdDesc(301L)).thenReturn(
                savedHistory.stream().sorted(Comparator.comparing(FridgeInventoryOperationChange::getId).reversed()).toList());

        service.undo(request.getOperationId(), "b9e1b38d-45d5-4d03-bbaf-f44d162c0fca", owner.getEmail());

        assertEquals(3D, item.getAmount());
        verify(fridgeIngredientRepository, times(4)).save(item);
    }

    @Test
    void undoRestoresAllMetadataAndCanonicalIngredientAfterFinish() {
        Instant confirmedAt = Instant.parse("2026-09-01T12:00:00Z");
        Ingredient canonical = new Ingredient();
        canonical.setId(700L);
        canonical.setName("Milk");
        FridgeIngredient item = item(44L, "Milk", 2D, owner);
        item.setExpirationDate(LocalDate.of(2026, 9, 10));
        item.setUnit(Unit.PIECES);
        item.setSource(FridgeOperationSource.BARCODE_SCAN);
        item.setQuantityAccuracy(QuantityAccuracy.ESTIMATED);
        item.setBarcode("5901234123457");
        item.setLastConfirmedAt(confirmedAt);
        item.setIngredient(canonical);
        item.setStockState(FridgeStockState.LOW);
        FridgeInventoryOperationRequestDto request = request("0a2af6d4-8ed4-4481-a0cc-37b5c0e675e0");
        FridgeInventoryChangeRequestDto finish = change(FridgeOperationChangeType.FINISH);
        finish.setFridgeItemId(44L);
        request.setChanges(List.of(finish));
        prepareNewOperation(request);
        when(fridgeIngredientRepository.findById(44L)).thenReturn(Optional.of(item), Optional.of(item), Optional.empty(), Optional.empty());
        when(fridgeIngredientRepository.findByUser_Id(7L)).thenReturn(List.of(), List.of());
        when(operationRepository.save(any())).thenAnswer(invocation -> {
            FridgeInventoryOperation operation = invocation.getArgument(0);
            if (operation.getId() == null) operation.setId(302L);
            return operation;
        });
        when(ingredientRepository.findById(700L)).thenReturn(Optional.of(canonical));
        FridgeInventoryOperation original = new FridgeInventoryOperation();
        original.setId(302L);
        original.setUser(owner);
        original.setClientOperationId(request.getOperationId());
        original.setSource(request.getSource());
        when(operationRepository.findByUser_IdAndClientOperationId(7L, request.getOperationId()))
                .thenReturn(Optional.empty(), Optional.of(original));

        service.apply(request, owner.getEmail());
        FridgeInventoryOperationChange history = capturedHistory();
        when(fridgeIngredientRepository.findByUser_Id(7L)).thenReturn(List.of(), List.of());
        when(fridgeIngredientRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(changeRepository.findByOperation_IdOrderByIdDesc(302L)).thenReturn(List.of(history));

        service.undo(request.getOperationId(), "d20a459a-870a-4b2a-851a-5dd31c52d31f", owner.getEmail());

        var restored = org.mockito.ArgumentCaptor.forClass(FridgeIngredient.class);
        verify(fridgeIngredientRepository).save(restored.capture());
        assertEquals("Milk", restored.getValue().getName());
        assertEquals(2D, restored.getValue().getAmount());
        assertEquals(Unit.PIECES, restored.getValue().getUnit());
        assertEquals(FridgeOperationSource.BARCODE_SCAN, restored.getValue().getSource());
        assertEquals(QuantityAccuracy.ESTIMATED, restored.getValue().getQuantityAccuracy());
        assertEquals("5901234123457", restored.getValue().getBarcode());
        assertEquals(confirmedAt, restored.getValue().getLastConfirmedAt());
        assertEquals(FridgeStockState.LOW, restored.getValue().getStockState());
        assertEquals(canonical, restored.getValue().getIngredient());
    }

    private FridgeInventoryOperationChange capturedHistory() {
        var captor = org.mockito.ArgumentCaptor.forClass(FridgeInventoryOperationChange.class);
        verify(changeRepository, atLeastOnce()).save(captor.capture());
        return captor.getAllValues().get(captor.getAllValues().size() - 1);
    }

    private FridgeInventoryOperationRequestDto request(String operationId) {
        FridgeInventoryChangeRequestDto change = new FridgeInventoryChangeRequestDto();
        change.setType(FridgeOperationChangeType.ADD);
        change.setName("Milk");

        FridgeInventoryOperationRequestDto request = new FridgeInventoryOperationRequestDto();
        request.setOperationId(operationId);
        request.setSource(FridgeOperationSource.SHOPPING_LIST);
        request.setChanges(List.of(change));
        return request;
    }

    private FridgeInventoryChangeRequestDto change(FridgeOperationChangeType type) {
        FridgeInventoryChangeRequestDto change = new FridgeInventoryChangeRequestDto();
        change.setType(type);
        return change;
    }

    private void prepareNewOperation(FridgeInventoryOperationRequestDto request) {
        when(userRepository.findByEmailForUpdate(owner.getEmail())).thenReturn(Optional.of(owner));
        when(operationRepository.findByUser_IdAndClientOperationId(7L, request.getOperationId()))
                .thenReturn(Optional.empty());
        lenient().when(operationRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(fridgeIngredientRepository.findByUser_Id(7L)).thenReturn(List.of());
    }

    private void prepareNewUndo(FridgeInventoryOperation original) {
        when(userRepository.findByEmailForUpdate(owner.getEmail())).thenReturn(Optional.of(owner));
        when(operationRepository.findByUser_IdAndClientOperationId(7L, original.getClientOperationId()))
                .thenReturn(Optional.of(original));
    }

    private FridgeIngredient item(Long id, String name, Double amount, User user) {
        FridgeIngredient item = new FridgeIngredient();
        item.setId(id);
        item.setName(name);
        item.setAmount(amount);
        item.setUser(user);
        return item;
    }

    private FridgeInventoryOperation savedOperation(
            FridgeInventoryOperationRequestDto request,
            FridgeIngredientDto currentItem
    ) {
        FridgeInventoryOperation operation = new FridgeInventoryOperation();
        operation.setClientOperationId(request.getOperationId());
        operation.setResultJson("{\"operationId\":\"" + request.getOperationId()
                + "\",\"status\":\"APPLIED\",\"appliedChanges\":[{\"type\":\"ADD\",\"fridgeItemId\":42,\"status\":\"APPLIED\",\"reason\":null}],\"skippedChanges\":[],\"currentItems\":[{\"id\":42,\"name\":\"Milk\",\"expirationDate\":null,\"amount\":null,\"unit\":null}]}");
        return operation;
    }
}
