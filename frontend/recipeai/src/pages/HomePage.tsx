import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFridge } from "../context/fridgeContext";
import { useUser } from "../context/context";
import ButtonsForm from "../components/ButtonsForm";

const HomePage = () => {
  const [search, setSearch] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);
  const navigate = useNavigate();
  const { fridgeItems } = useFridge();
  const { user } = useUser();
  const controlsCuisine = ["Italian", "Mexican", "Indian", "Chinese"];
  const controlsMeal = ["Dinner", "Lunch", "Breakfast", "Snack"];
  const controlsTime = ["Quick", "Moderate", "Slow"];
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);

  const handleSearch = () => {
    if (!user) {
      navigate("/login", { state: { from: { pathname: "/Recipe" } } });
      return;
    }

    let finalSearch = search;
    if (!search.trim()) {
      finalSearch = "random recipe";
    } else if (hasIngredients && search.trim()) {
      const ingredientsText = fridgeItems.map((item) => item.name).join(", ");
      finalSearch += " and try to use those ingredients: " + ingredientsText;
    }
    if (selectedMeal) {
      finalSearch += ` for ${selectedMeal}`;
    }
    if (selectedCuisine) {
      finalSearch += ` in ${selectedCuisine} cuisine`;
    }
    if (selectedTime) {
      finalSearch += ` in ${selectedTime} time`;
    }
    setIsNavigating(true);
    navigate("Recipe", { state: { search: finalSearch } });
  };

  const handleClear = () => {
    setSearch("");
  };

  const handleBrowseLatest = () => {
    navigate("/Recipes");
  };

  const hasIngredients = fridgeItems.length > 0;

  return (
    <>
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-28 left-[-8%] h-72 w-72 rounded-full bg-[radial-gradient(circle,_color-mix(in_srgb,var(--color-accent)_45%,transparent)_0%,transparent_72%)] blur-2xl" />
          <div className="absolute right-[-10%] top-1/3 h-80 w-80 rounded-full bg-[radial-gradient(circle,_color-mix(in_srgb,var(--color-primary)_16%,transparent)_0%,transparent_72%)] blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-64 w-[32rem] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,_color-mix(in_srgb,var(--color-accent)_20%,transparent)_0%,transparent_70%)] blur-2xl" />
        </div>

        <article className="relative z-10 mx-auto w-full max-w-4xl px-5 pb-6 pt-8 md:px-8 md:pt-12">
          <div
            className="animate-fadeIn rounded-3xl border border-primary/10 bg-background/80 p-5 text-center shadow-[0_25px_65px_rgba(0,0,0,0.06)] backdrop-blur-sm md:p-8"
            style={{ animationDelay: "80ms" }}
          >
            <h1 className="flex-col p-3 text-text">
              Dish Genie turns ingredients into recipes &#127869; &#129302;
            </h1>
            <p className="mb-5 text-sm text-text/70 md:text-base">
              Generate meal ideas from what you already have, browse public
              recipes, and keep your cooking plan organized in one place.
            </p>
            <article className="relative w-full">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Create recipe"
                className="w-full rounded-full border border-primary/20 bg-secondary/90 p-2 pr-10 text-text shadow-[0_8px_20px_rgba(0,0,0,0.04)] placeholder:text-text/50 focus:outline-none focus:ring-2 focus:ring-accent"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
              />
              {search && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text/70 transition-colors hover:text-accent focus:outline-none"
                  aria-label="Clear search"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </article>
            <section className="space-y-4 pb-3 pt-5">
              <ButtonsForm
                options={controlsMeal}
                onButtonClick={setSelectedMeal}
                selectedButton={selectedMeal}
                title="Select Meal Type:"
              ></ButtonsForm>
              <ButtonsForm
                options={controlsCuisine}
                onButtonClick={setSelectedCuisine}
                selectedButton={selectedCuisine}
                title="Select Cuisine:"
              ></ButtonsForm>
              <ButtonsForm
                options={controlsTime}
                onButtonClick={setSelectedTime}
                selectedButton={selectedTime}
                title="Select Time to Prepare:"
              ></ButtonsForm>
              <button
                onClick={handleSearch}
                disabled={isNavigating}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 font-bold text-text shadow-[0_12px_28px_color-mix(in_srgb,var(--color-accent)_45%,transparent)] transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-wait disabled:opacity-60"
              >
                {isNavigating ? (
                  <>
                    <span className="food-loader-inline" aria-hidden="true">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5 text-primary"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="6" />
                        <path d="M3 12h3m12 0h3M12 3v3m0 12v3" />
                      </svg>
                    </span>
                    <span>Generating...</span>
                  </>
                ) : user ? (
                  "Generate Recipe"
                ) : (
                  "Log in to Generate Recipes"
                )}
              </button>

              {!user && (
                <div className="mt-6 rounded-2xl border border-primary/15 bg-secondary/40 p-4 text-left text-sm text-text/80 backdrop-blur-sm">
                  <p className="font-semibold text-text">
                    Guest mode: what you can do now
                  </p>
                  <ul className="mt-2 space-y-1.5 text-text/75">
                    <li>Browse the 10 latest public recipes.</li>
                    <li>
                      Open full recipe details with ingredients and steps.
                    </li>
                    <li>Try the app UI before creating an account.</li>
                  </ul>
                  <p className="mt-3 text-text/70">
                    After sign up you unlock AI recipe generation, saving
                    recipes, the Virtual Fridge, and personal diet preferences.
                  </p>
                  <button
                    onClick={handleBrowseLatest}
                    className="mobile-soft-press mt-4 rounded-full bg-background px-4 py-2 font-semibold text-text shadow-sm transition-colors hover:text-accent"
                  >
                    Browse 10 Latest Recipes
                  </button>
                </div>
              )}
            </section>
          </div>
        </article>

        <section
          className="animate-fadeIn relative z-10 mx-5 mb-6 flex flex-col gap-4 rounded-3xl border border-primary/10 bg-[linear-gradient(160deg,_color-mix(in_srgb,var(--color-secondary)_88%,white)_0%,_color-mix(in_srgb,var(--color-accent)_18%,white)_100%)] p-5 text-center shadow-[0_18px_45px_rgba(0,0,0,0.06)] md:mx-8 md:mb-10 md:flex-row md:p-7"
          style={{ animationDelay: "200ms" }}
        >
          <p className="pt-2 md:pt-0 text-text">
            🧑‍🍳 No idea what to cook? Let our AI suggest recipes based on your
            mood, time, and dietary preferences!
          </p>
          <p className="pt-2 md:pt-0 text-text">
            🥗 Virtual Fridge 🍱 Add whatever ingredients you have at home, and
            we'll generate the perfect meal ideas for you.
          </p>
          <p className="pt-2 md:pt-0 text-text">
            🍽️ Save & Organize Keep your favorite recipes in one place and
            revisit them anytime!
          </p>
        </section>
      </section>
    </>
  );
};

export default HomePage;
