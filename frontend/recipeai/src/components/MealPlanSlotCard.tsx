import { useLanguage } from "../context/languageContext";
import { isSlotGenerating, type PlanSlot } from "../lib/mealPlans";

export default function MealPlanSlotCard({ slot, busy, onGenerate, onChange }: {
  slot: PlanSlot; busy: boolean; onGenerate: () => void;
  onChange: (action: "LOCK" | "UNLOCK" | "SKIP" | "RESTORE" | "SERVINGS", servings?: number) => void;
}) {
  const { t } = useLanguage();
  const recipe = slot.recipe;
  const button = "rounded-full border border-primary/20 px-3 py-2 text-sm disabled:opacity-40 hover:bg-primary/5";
  return <article className={`rounded-2xl border p-4 ${slot.skipped ? "border-primary/10 bg-primary/5" : "border-primary/15 bg-white"}`}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">{t(slot.mealType === "LUNCH" ? "Lunch" : "Dinner")}</h3>
      <span className="text-sm text-primary/70">{t("{count} servings", { count: slot.servings })}</span>
    </div>
    {slot.skipped ? <p>{t("Meal skipped")}</p> : recipe ? <>
      <h4 className="text-lg font-semibold">{recipe.name}</h4>
      <p className="mt-1 text-sm text-primary/70">{recipe.timeToPrepare}</p>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold">{t("Ingredients and instructions")}</summary>
        <p className="mt-2">{recipe.description}</p>
        <ul className="my-3 list-disc space-y-1 pl-5">{recipe.ingredients.map((item, index) => <li key={index}>
          {Number((item.amount * slot.servings / recipe.servings).toFixed(2))} {item.unit} {item.name}
        </li>)}</ul>
        <ol className="list-decimal space-y-2 pl-5">{recipe.instructions.map((step, index) => <li key={index}>{step}</li>)}</ol>
      </details>
    </> : <p className="text-sm text-primary/60">{t("No meal planned yet")}</p>}
    {isSlotGenerating(slot) ? <p role="status" className="mt-2 text-sm">{t("Generating this meal. Refresh to check progress.")}</p> : slot.generationStatus === "FAILED" ? <p className="mt-2 text-sm text-red-700">{t("Generation failed. Your previous meal is kept; you can retry.")}</p> : null}
    <div className="mt-4 flex flex-wrap gap-2">
      {!slot.skipped && <button disabled={busy || slot.locked} onClick={onGenerate} className={button}>{recipe ? t("Swap meal") : t("Generate meal")}</button>}
      {recipe && !slot.skipped && <button disabled={busy} onClick={() => onChange(slot.locked ? "UNLOCK" : "LOCK")} aria-pressed={slot.locked} className={button}>{slot.locked ? t("Unlock meal") : t("Lock meal")}</button>}
      <button disabled={busy || slot.locked} onClick={() => onChange(slot.skipped ? "RESTORE" : "SKIP")} className={button}>{slot.skipped ? t("Restore meal") : t("Skip meal")}</button>
      {!slot.skipped && <div className="flex items-center gap-2">
        <button aria-label={t("Decrease servings")} disabled={busy || slot.locked || slot.servings <= 1} onClick={() => onChange("SERVINGS", slot.servings - 1)} className={button}>−</button>
        <button aria-label={t("Increase servings")} disabled={busy || slot.locked || slot.servings >= 100} onClick={() => onChange("SERVINGS", slot.servings + 1)} className={button}>+</button>
      </div>}
    </div>
  </article>;
}
