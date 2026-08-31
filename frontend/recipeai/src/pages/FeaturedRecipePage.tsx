import { Link, useParams } from "react-router-dom";
import { getFeaturedRecipe } from "../lib/featuredRecipes";
import { useLanguage } from "../context/languageContext";

const formatMacro = (value: number, suffix: string) => `${value}${suffix}`;

const FeaturedRecipePage = () => {
  const { slug } = useParams();
  const recipe = getFeaturedRecipe(slug);
  const { t } = useLanguage();

  if (!recipe) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-16 text-center md:px-8">
        <h1 className="text-3xl font-bold text-text">{t("Recipe not found")}</h1>
        <p className="mt-3 text-sm leading-6 text-text/65">
          {t("This featured Dish Genie recipe does not exist or has moved.")}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-accent/90"
        >
          {t("Back to home")}
        </Link>
      </section>
    );
  }

  return (
    <div className="mobile-page-enter min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="mb-5 inline-flex text-sm font-semibold text-text/55 hover:text-accent"
        >
          {t("Back to home")}
        </Link>

        <section className="mobile-card-enter relative overflow-hidden rounded-3xl border border-accent/35 bg-secondary p-6 sm:p-8">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />

          <div className="relative">
            <p className="mb-2 inline-flex rounded-full border border-primary/15 bg-background px-3 py-1 text-xs font-semibold uppercase tracking-wide text-text/60">
              {t("Dish Genie Recipe")}
            </p>
            <h1 className="text-3xl font-bold leading-tight text-text sm:text-4xl">
              {t(recipe.name)}
            </h1>

            <p className="mt-3 max-w-3xl text-base text-text/75 sm:text-lg">
              {t(recipe.description)}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-text">
                {recipe.timeToPrepare}
              </span>
              <span className="rounded-full border border-primary/15 bg-background px-3 py-1.5 text-sm text-text/75">
                {t("{count} ingredients", { count: recipe.ingredients.length })}
              </span>
              <span className="rounded-full border border-primary/15 bg-background px-3 py-1.5 text-sm text-text/75">
                {t("{count} steps", { count: recipe.instructions.length })}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-accent/35 bg-background/70 px-3 py-1 text-xs font-semibold text-text/65"
                >
                  {t(tag)}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="mobile-card-enter mobile-card-delay-1 mt-6 rounded-2xl border border-accent/30 bg-secondary p-5">
          <h2 className="mb-4 text-lg font-semibold text-text">
            {t("Nutrition (estimated)")}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-accent/20 bg-background px-3 py-2.5 text-sm text-text">
              <span className="block text-text/60">{t("Calories")}</span>
              <span className="font-semibold">
                {formatMacro(recipe.nutrition.calories, " kcal")}
              </span>
            </div>
            <div className="rounded-xl border border-accent/20 bg-background px-3 py-2.5 text-sm text-text">
              <span className="block text-text/60">{t("Protein")}</span>
              <span className="font-semibold">
                {formatMacro(recipe.nutrition.protein, " g")}
              </span>
            </div>
            <div className="rounded-xl border border-accent/20 bg-background px-3 py-2.5 text-sm text-text">
              <span className="block text-text/60">{t("Carbs")}</span>
              <span className="font-semibold">
                {formatMacro(recipe.nutrition.carbs, " g")}
              </span>
            </div>
            <div className="rounded-xl border border-accent/20 bg-background px-3 py-2.5 text-sm text-text">
              <span className="block text-text/60">{t("Fats")}</span>
              <span className="font-semibold">
                {formatMacro(recipe.nutrition.fats, " g")}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="mobile-card-enter mobile-card-delay-1 h-full rounded-2xl border border-primary/10 bg-secondary p-6">
            <h2 className="mb-4 text-2xl font-semibold text-text">
              {t("Ingredients")}
            </h2>
            <ul className="space-y-2.5">
              {recipe.ingredients.map((ingredient) => (
                <li
                  key={`${ingredient.name}-${ingredient.amount}-${ingredient.unit}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-primary/10 bg-background px-3 py-2 text-text"
                >
                  <span className="font-medium">{t(ingredient.name)}</span>
                  <span className="text-right text-sm text-text/75">
                  {ingredient.amount} {t(ingredient.unit)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mobile-card-enter mobile-card-delay-2 h-full rounded-2xl border border-primary/10 bg-secondary p-6">
            <h2 className="mb-4 text-2xl font-semibold text-text">
              {t("Instructions")}
            </h2>
            <ol className="space-y-4">
              {recipe.instructions.map((instruction, index) => (
                <li
                  key={instruction}
                  className="group flex items-start gap-3.5 rounded-2xl border border-primary/12 bg-background/95 px-4 py-4 text-text shadow-[0_10px_28px_-22px_rgba(17,17,17,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/55 hover:shadow-[0_16px_34px_-24px_rgba(17,17,17,0.9)] sm:px-5"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-base font-extrabold text-primary shadow-[0_3px_0_rgba(0,0,0,0.08)] ring-2 ring-accent/35 ring-offset-2 ring-offset-background">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-[1.03rem] font-medium leading-8 text-text/90">
                    {t(instruction)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <section className="mobile-card-enter mobile-card-delay-2 mt-8 rounded-2xl border border-primary/10 bg-secondary p-5">
          <h2 className="text-xl font-bold text-text">
            {t("Make this fit your kitchen")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-text/65">
            {t(
              "Dish Genie can create this kind of recipe from the ingredients, time, and effort level you actually have tonight.",
            )}
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-accent/90"
          >
            {t("Generate my own recipe")}
          </Link>
        </section>
      </div>
    </div>
  );
};

export default FeaturedRecipePage;
