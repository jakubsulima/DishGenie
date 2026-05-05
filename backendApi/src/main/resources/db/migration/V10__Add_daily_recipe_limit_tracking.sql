ALTER TABLE app_user
ADD COLUMN daily_recipe_count INT NOT NULL DEFAULT 0,
ADD COLUMN last_recipe_reset_date DATE;
