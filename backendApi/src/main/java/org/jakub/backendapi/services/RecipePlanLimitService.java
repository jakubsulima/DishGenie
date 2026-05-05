package org.jakub.backendapi.services;

import org.jakub.backendapi.entities.Enums.Role;
import org.jakub.backendapi.entities.Enums.SubscriptionPlan;
import org.jakub.backendapi.entities.User;
import org.jakub.backendapi.exceptions.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class RecipePlanLimitService {

    private static final int UNLIMITED_LIMIT = -1;

    private final int freePlanDailyRequestLimit;
    private final int paidPlanDailyRequestLimit;

    public RecipePlanLimitService(
            @Value("${app.limits.recipe-requests-per-day.free:${FREE_PLAN_RECIPE_REQUESTS_PER_DAY:${FREE_PLAN_RECIPE_LIMIT:1000}}}") int freePlanDailyRequestLimit,
            @Value("${app.limits.recipe-requests-per-day.paid:${PAID_PLAN_RECIPE_REQUESTS_PER_DAY:${PAID_PLAN_RECIPE_LIMIT:-1}}}") int paidPlanDailyRequestLimit
    ) {
        validateConfig(freePlanDailyRequestLimit, paidPlanDailyRequestLimit);
        this.freePlanDailyRequestLimit = freePlanDailyRequestLimit;
        this.paidPlanDailyRequestLimit = paidPlanDailyRequestLimit;
    }

    public int resolveRecipeLimit(User user) {
        if (user.getRole() == Role.ADMIN) {
            return UNLIMITED_LIMIT;
        }

        SubscriptionPlan plan = user.getSubscriptionPlan() == null
                ? SubscriptionPlan.FREE
                : user.getSubscriptionPlan();

        return plan == SubscriptionPlan.PAID ? paidPlanDailyRequestLimit : freePlanDailyRequestLimit;
    }

    public void assertCanCreateRecipe(User user) {
        int limit = resolveRecipeLimit(user);
        if (isUnlimited(limit)) {
            return;
        }

        long currentCount = getRecipeRequestsToday(user);
        if (currentCount >= limit) {
             throw new AppException("You reached your daily recipe request limit for the "
                        + getEffectivePlan(user).name().toLowerCase()
                        + " plan. Try again tomorrow or upgrade your plan.", HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    public SubscriptionPlan getEffectivePlan(User user) {
        SubscriptionPlan userPlan = user.getSubscriptionPlan() == null
                ? SubscriptionPlan.FREE
                : user.getSubscriptionPlan();

        if (user.getRole() == Role.ADMIN) {
            return SubscriptionPlan.PAID;
        }

        return userPlan;
    }

    public long getRecipeRequestsToday(User user) {
        LocalDate today = LocalDate.now();
        if (user.getLastRecipeResetDate() == null || !user.getLastRecipeResetDate().equals(today)) {
            return 0;
        }
        return user.getDailyRecipeCount();
    }

    public Integer getRemainingRecipes(User user, long recipeRequestsToday) {
        int limit = resolveRecipeLimit(user);
        if (isUnlimited(limit)) {
            return null;
        }

        long remaining = (long) limit - recipeRequestsToday;
        if (remaining <= 0) {
            return 0;
        }
        return (int) Math.min(Integer.MAX_VALUE, remaining);
    }

    public boolean isLimitReached(User user, long recipeRequestsToday) {
        int limit = resolveRecipeLimit(user);
        return !isUnlimited(limit) && recipeRequestsToday >= limit;
    }

    private boolean isUnlimited(int limit) {
        return limit == UNLIMITED_LIMIT;
    }

    private void validateConfig(int freeLimit, int paidLimit) {
        if (freeLimit < 0) {
            throw new IllegalStateException("app.limits.recipe-requests-per-day.free must be >= 0");
        }

        if (paidLimit < 0 && paidLimit != UNLIMITED_LIMIT) {
            throw new IllegalStateException("app.limits.recipe-requests-per-day.paid must be >= 0 or exactly -1 for unlimited");
        }
    }
}