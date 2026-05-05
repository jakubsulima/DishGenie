package org.jakub.backendapi.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import org.jakub.backendapi.entities.Enums.AuthMethod;
import org.jakub.backendapi.entities.Enums.Role;
import org.jakub.backendapi.entities.Enums.SubscriptionPlan;

import java.util.List;


@Entity
@Table(name = "app_user")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true) // Added unique = true
    @Email(message = "Email should be valid")
    private String email;

    private String password;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private Role role;

    @Column(name = "auth_method", nullable = false)
    @Enumerated(EnumType.STRING)
    private AuthMethod authMethod = AuthMethod.CREDENTIALS;

    @Column(name = "subscription_plan", nullable = false)
    @Enumerated(EnumType.STRING)
    private SubscriptionPlan subscriptionPlan = SubscriptionPlan.FREE;

    @Column(name = "daily_recipe_count", nullable = false)
    private int dailyRecipeCount = 0;

    @Column(name = "last_recipe_reset_date")
    private java.time.LocalDate lastRecipeResetDate;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Recipe> recipes;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private UserPreferences userPreferences;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FridgeIngredient> fridgeIngredients;

    public User() {
    }

    public User(Long id, String email, String password, Role role, List<Recipe> recipes, UserPreferences userPreferences, List<FridgeIngredient> fridgeIngredients) {
        this.id = id;
        this.email = email;
        this.password = password;
        this.role = role;
        this.recipes = recipes;
        this.userPreferences = userPreferences;
        this.fridgeIngredients = fridgeIngredients;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public List<Recipe> getRecipes() {
        return recipes;
    }

    public void setRecipes(List<Recipe> recipes) {
        this.recipes = recipes;
    }

    public UserPreferences getUserPreferences() {
        return userPreferences;
    }

    public void setUserPreferences(UserPreferences userPreferences) {
        this.userPreferences = userPreferences;
    }

    public AuthMethod getAuthMethod() {
        return authMethod;
    }

    public void setAuthMethod(AuthMethod authMethod) {
        this.authMethod = authMethod;
    }

    public List<FridgeIngredient> getFridgeIngredients() {
        return fridgeIngredients;
    }

    public void setFridgeIngredients(List<FridgeIngredient> fridgeIngredients) {
        this.fridgeIngredients = fridgeIngredients;
    }

    public SubscriptionPlan getSubscriptionPlan() {
        return subscriptionPlan;
    }

    public void setSubscriptionPlan(SubscriptionPlan subscriptionPlan) {
        this.subscriptionPlan = subscriptionPlan;
    }

    public int getDailyRecipeCount() {
        return dailyRecipeCount;
    }

    public void setDailyRecipeCount(int dailyRecipeCount) {
        this.dailyRecipeCount = dailyRecipeCount;
    }

    public java.time.LocalDate getLastRecipeResetDate() {
        return lastRecipeResetDate;
    }

    public void setLastRecipeResetDate(java.time.LocalDate lastRecipeResetDate) {
        this.lastRecipeResetDate = lastRecipeResetDate;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        User user = (User) o;
        return id != null && id.equals(user.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "User{" +
                "id=" + id +
                ", email='" + email + '\'' +
                ", role=" + role +
                ", authMethod=" + authMethod +
            ", subscriptionPlan=" + subscriptionPlan +
                '}';
    }
}
