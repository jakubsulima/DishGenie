package org.jakub.backendapi.services;

import org.jakub.backendapi.dto.SignUpDto;
import org.jakub.backendapi.dto.UserDto;
import org.jakub.backendapi.entities.Enums.Diet;
import org.jakub.backendapi.entities.Enums.Role;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.mappers.UserMapper;
import org.jakub.backendapi.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserMapper userMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, userMapper, passwordEncoder, null);
    }

    @Test
    void register_shouldCreateUserWithDefaultPreferences() {
        // Given
        SignUpDto signUpDto = new SignUpDto("test@example.com", "password".toCharArray());
        User user = new User();
        user.setEmail(signUpDto.getEmail());

        User savedUser = new User();
        savedUser.setId(1L);
        savedUser.setEmail(signUpDto.getEmail());
        savedUser.setRole(Role.USER);

        org.jakub.backendapi.entities.UserPreferences preferences = new org.jakub.backendapi.entities.UserPreferences();
        preferences.setDiet(Diet.NONE);
        preferences.setUser(savedUser);
        preferences.setDislikedIngredients(java.util.List.of());
        savedUser.setUserPreferences(preferences);

        UserDto userDto = new UserDto();
        userDto.setId(1L);
        userDto.setEmail(signUpDto.getEmail());


        when(userRepository.findByEmail(signUpDto.getEmail())).thenReturn(Optional.empty());
        when(userMapper.signUpToUser(signUpDto)).thenReturn(user);
        when(passwordEncoder.encode(any())).thenReturn("encodedPassword");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(userMapper.toUserDto(any(User.class))).thenReturn(userDto);

        // When
        userService.register(signUpDto);

        // Then
        ArgumentCaptor<User> userArgumentCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userArgumentCaptor.capture());
        User capturedUser = userArgumentCaptor.getValue();

        assertNotNull(capturedUser.getUserPreferences());
        assertEquals(Diet.NONE, capturedUser.getUserPreferences().getDiet());
        assertEquals(java.util.List.of(Diet.NONE), capturedUser.getUserPreferences().getDiets());
        assertEquals(capturedUser, capturedUser.getUserPreferences().getUser());
    }
}
