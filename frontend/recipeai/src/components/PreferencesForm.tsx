interface PreferencesFormProps {
  dietOptions: string[];
  onSavePreferences: (preferences: {
    diet: string;
    dislikedIngredients: string[];
  }) => void;
}

const PreferencesForm = ({
  dietOptions,
  onSavePreferences,
}: PreferencesFormProps) => {
  return (
    <>
      <h2>User Preferences</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const diet = form.diet.value;
          const dislikedIngredients = form.dislikedIngredients.value
            .split(",")
            .map((ingredient: string) => ingredient.trim());
          onSavePreferences({ diet, dislikedIngredients });
        }}
      >
        <label>
          Diet:
          <select>
            {dietOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Disliked Ingredients:
          <input type="text" placeholder="Enter disliked ingredients" />
        </label>
        <button type="submit">Save Preferences</button>
      </form>
    </>
  );
};

export default PreferencesForm;
