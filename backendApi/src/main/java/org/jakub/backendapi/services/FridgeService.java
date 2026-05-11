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
        if (fridgeIngredientDto.getUnit() != null) {
            validateUnit(fridgeIngredientDto.getUnit());
        }

        if (fridgeIngredientDto.getAmount() != null && fridgeIngredientDto.getAmount() <= 0) {
            throw new AppException("Amount must be positive", HttpStatus.BAD_REQUEST);
        }
        User user = userRepository.findByEmail(email).orElseThrow(() -> new AppException("User not found", HttpStatus.NOT_FOUND));

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

    private void validateUnit(String unit) {
        try {
            Unit.valueOf(unit.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("Invalid unit value provided: " + unit, HttpStatus.BAD_REQUEST);
        }
    }

}
