package org.jakub.backendapi.services;

import jakarta.transaction.Transactional;
import org.jakub.backendapi.dto.FridgeIngredientDto;
import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.entities.Enums.Unit;
import org.jakub.backendapi.entities.FridgeIngredient;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.exceptions.AppException;
import org.jakub.backendapi.mappers.FridgeIngredientMapper;
import org.jakub.backendapi.repositories.FridgeIngredientRepository;
import org.jakub.backendapi.repositories.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class FridgeService {

    private final FridgeIngredientRepository fridgeIngredientRepository;
    private final UserRepository userRepository;
    private final FridgeIngredientMapper fridgeIngredientMapper;
    private final UserService userService;

    public FridgeService(FridgeIngredientRepository fridgeIngredientRepository, UserRepository userRepository, FridgeIngredientMapper fridgeIngredientMapper, UserService userService) {
        this.fridgeIngredientRepository = fridgeIngredientRepository;
        this.userRepository = userRepository;
        this.fridgeIngredientMapper = fridgeIngredientMapper;
        this.userService = userService;
    }

    public List<FridgeIngredientDto> getFridgeIngredients(String email) {
        UserDto userDto = userService.findByEmail(email);
        return fridgeIngredientRepository.findByUser_Id(userDto.getId()).stream().map(fridgeIngredientMapper::toFridgeIngredientDto).collect(Collectors.toList());
    }

    @Transactional
    public FridgeIngredient addFridgeIngredient(FridgeIngredientDto fridgeIngredientDto, String email) {
        String ingredientName = requireIngredientName(fridgeIngredientDto.getName());
        fridgeIngredientDto.setName(ingredientName);

        Unit unit = parseUnit(fridgeIngredientDto.getUnit());

        if (fridgeIngredientDto.getAmount() != null && fridgeIngredientDto.getAmount() <= 0) {
            throw new AppException("Amount must be positive", HttpStatus.BAD_REQUEST);
        }
        User user = userRepository.findByEmail(email).orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));

        List<FridgeIngredient> mergeCandidates = fridgeIngredientRepository.findMergeCandidates(
                user.getId(),
                ingredientName,
                fridgeIngredientDto.getExpirationDate(),
                unit
        );
        if (!mergeCandidates.isEmpty()) {
            FridgeIngredient existingIngredient = mergeCandidates.get(0);
            existingIngredient.setAmount(mergeAmounts(existingIngredient.getAmount(), fridgeIngredientDto.getAmount()));
            return fridgeIngredientRepository.save(existingIngredient);
        }

        FridgeIngredient fridgeIngredient = fridgeIngredientMapper.toFridgeIngredientWithUser(fridgeIngredientDto, user);
        return fridgeIngredientRepository.save(fridgeIngredient);
    }

    public void deleteFridgeIngredient(Long id, String email) {
        UserDto userDto = userService.findByEmail(email);
        FridgeIngredient fridgeIngredient = fridgeIngredientRepository.findById(id).orElseThrow(() -> new AppException("Fridge ingredient not found", HttpStatus.NOT_FOUND));

        if (!fridgeIngredient.getUser().getId().equals(userDto.getId())) {
            throw new AppException("You do not have permission to delete this fridge ingredient", HttpStatus.FORBIDDEN);
        }
        fridgeIngredientRepository.deleteById(id);

        fridgeIngredientMapper.toFridgeIngredientDto(fridgeIngredient);
    }

    public void changeFridgeIngredientAmount(Long id, double amount, String email) {
        if (amount < 0) {
            throw new AppException("Amount must be positive", HttpStatus.BAD_REQUEST);
        }
        UserDto userDto = userService.findByEmail(email);
        FridgeIngredient fridgeIngredient = fridgeIngredientRepository.findById(id).orElseThrow(() -> new AppException("Fridge ingredient not found", HttpStatus.NOT_FOUND));

        if (!fridgeIngredient.getUser().getId().equals(userDto.getId())) {
            throw new AppException("You do not have permission to change this fridge ingredient", HttpStatus.FORBIDDEN);
        }

        if (amount == 0) {
            fridgeIngredientRepository.deleteById(id);
            return;
        }

        fridgeIngredient.setAmount(amount);
        fridgeIngredientRepository.save(fridgeIngredient);
    }

    @Transactional
    public FridgeIngredient updateFridgeIngredient(Long id, FridgeIngredientDto fridgeIngredientDto, String email) {
        String ingredientName = requireIngredientName(fridgeIngredientDto.getName());
        fridgeIngredientDto.setName(ingredientName);

        Unit unit = parseUnit(fridgeIngredientDto.getUnit());

        Double amount = fridgeIngredientDto.getAmount();
        if (amount != null && amount < 0) {
            throw new AppException("Amount must be positive", HttpStatus.BAD_REQUEST);
        }

        UserDto userDto = userService.findByEmail(email);
        FridgeIngredient fridgeIngredient = fridgeIngredientRepository.findById(id).orElseThrow(() -> new AppException("Fridge ingredient not found", HttpStatus.NOT_FOUND));

        if (!fridgeIngredient.getUser().getId().equals(userDto.getId())) {
            throw new AppException("You do not have permission to change this fridge ingredient", HttpStatus.FORBIDDEN);
        }

        if (amount != null && amount == 0) {
            fridgeIngredientRepository.deleteById(id);
            return null;
        }

        List<FridgeIngredient> mergeCandidates = fridgeIngredientRepository.findMergeCandidates(
                userDto.getId(),
                ingredientName,
                fridgeIngredientDto.getExpirationDate(),
                unit
        );

        FridgeIngredient mergeTarget = mergeCandidates.stream()
                .filter(candidate -> !candidate.getId().equals(id))
                .findFirst()
                .orElse(null);

        if (mergeTarget != null) {
            mergeTarget.setAmount(mergeAmounts(mergeTarget.getAmount(), amount));
            fridgeIngredientRepository.deleteById(id);
            return fridgeIngredientRepository.save(mergeTarget);
        }

        fridgeIngredient.setName(ingredientName);
        fridgeIngredient.setExpirationDate(fridgeIngredientDto.getExpirationDate());
        fridgeIngredient.setAmount(amount);
        fridgeIngredient.setUnit(unit);

        return fridgeIngredientRepository.save(fridgeIngredient);
    }

    private Unit parseUnit(String unit) {
        if (unit == null) {
            return null;
        }

        String normalizedUnit = unit.trim();
        if (normalizedUnit.isEmpty()) {
            return null;
        }

        for (Unit value : Unit.values()) {
            if (value.name().equalsIgnoreCase(normalizedUnit)
                    || value.getAbbreviation().equalsIgnoreCase(normalizedUnit)) {
                return value;
            }
        }

        throw new AppException("Invalid unit value provided: " + unit, HttpStatus.BAD_REQUEST);
    }

    private String requireIngredientName(String ingredientName) {
        if (!StringUtils.hasText(ingredientName)) {
            throw new AppException("Ingredient name cannot be empty", HttpStatus.BAD_REQUEST);
        }
        return ingredientName.trim();
    }

    private Double mergeAmounts(Double existingAmount, Double incomingAmount) {
        if (existingAmount == null) {
            return incomingAmount;
        }

        if (incomingAmount == null) {
            return existingAmount;
        }

        return existingAmount + incomingAmount;
    }

}
