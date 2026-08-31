interface DislikedIngredientsPanelProps {
  newIngredient: string;
  onNewIngredientChange: (value: string) => void;
  onAddIngredient: () => void;
  dislikedIngredients: string[];
  preferencesLoaded: boolean;
  onRemoveIngredient: (ingredient: string) => void;
  validationMessage?: string;
}

const DislikedIngredientsPanel = ({
  newIngredient,
  onNewIngredientChange,
  onAddIngredient,
  dislikedIngredients,
  preferencesLoaded,
  onRemoveIngredient,
  validationMessage,
}: DislikedIngredientsPanelProps) => {
  const { t } = useLanguage();
  return (
    <div className="mobile-card-enter mobile-card-delay-2 rounded-xl border border-primary/10 bg-background p-4">
      <h2 className="mb-1 text-xl font-semibold text-text">
        {t("Disliked Ingredients")}
      </h2>
      <p className="mb-3 text-sm text-text/60">
        {t("Keep this list short and specific for better recipe matches.")}
      </p>

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={newIngredient}
          onChange={(event) => onNewIngredientChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onAddIngredient()}
          aria-label={t("Disliked ingredient")}
          placeholder={t("e.g., Olives")}
          className={`flex-1 rounded-lg border bg-background px-3 py-2.5 text-text placeholder:text-text/50 focus:outline-none focus:ring-2 ${
            validationMessage
              ? "border-red-400 focus:ring-red-400/70"
              : "border-primary/20 focus:ring-accent"
          }`}
        />
        <button
          onClick={onAddIngredient}
          className="mobile-soft-press rounded-lg bg-accent px-4 py-2.5 font-semibold text-text transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {t("Add")}
        </button>
      </div>

      {validationMessage && (
        <p className="mb-3 text-sm font-medium text-red-500" role="alert">
          {t(validationMessage)}
        </p>
      )}

      <div className="space-y-2">
        {dislikedIngredients.length > 0 ? (
          dislikedIngredients.map((ingredient, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border border-primary/10 bg-secondary px-3 py-2.5"
            >
              <span className="capitalize font-medium text-text">
                {ingredient}
              </span>
              <button
                onClick={() => onRemoveIngredient(ingredient)}
                className="mobile-soft-press rounded-md px-2 py-0.5 text-lg font-bold text-text/45 transition-colors hover:bg-accent/15 hover:text-accent"
                title={t("Remove {name}", { name: ingredient })}
              >
                &times;
              </button>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-primary/20 py-4 text-center text-text/70">
            {preferencesLoaded
              ? t("No disliked ingredients added.")
              : t("Loading...")}
          </p>
        )}
      </div>
    </div>
  );
};

export default DislikedIngredientsPanel;
import { useLanguage } from "../../context/languageContext";
