import { useCallback, useState, type ReactNode } from "react";
import MealPlanRevision from "./MealPlanRevision";
import PlannerDialog from "./PlannerDialog";
import PlannerMenu from "./PlannerMenu";
import { useLanguage } from "../context/languageContext";
import { type MealPlan, type PlanSlot } from "../lib/mealPlans";

export default function MealPlanSlotCard({ slot, busy, recipePortions, onGenerate, onChange, plan, onApplied, onDraftChange, onBusyChange, extraMenuItems, recipeActions, status }: {
  extraMenuItems?: ReactNode; recipeActions?: (close: () => void) => ReactNode; status?: ReactNode;
  recipePortions?: number; plan?: MealPlan; onApplied?: (plan: MealPlan) => void;
  onDraftChange?: (slotId: string, dirty: boolean) => void;
  onBusyChange?: (slotId: string, busy: boolean) => void;
  slot: PlanSlot; busy: boolean; onGenerate: () => void;
  onChange: (action: "LOCK" | "UNLOCK" | "SKIP" | "RESTORE" | "SERVINGS", servings?: number) => void;
}) {
  const { t } = useLanguage();
  const [panel, setPanel] = useState<"recipe" | "edit" | null>(null);
  const [editorVisited, setEditorVisited] = useState(false);
  const draftChanged = useCallback((dirty: boolean) => onDraftChange?.(slot.id, dirty), [onDraftChange, slot.id]);
  const busyChanged = useCallback((busy: boolean) => onBusyChange?.(slot.id, busy), [onBusyChange, slot.id]);
  const recipe = slot.recipe;
  const button = "min-h-11 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40 hover:bg-primary/5";
  const menuButton = `${button} block w-full text-left`;
  return <article id={`meal-slot-${slot.id}`} className={`min-w-0 border-b border-primary/10 py-3 ${slot.skipped ? "text-primary/60" : "text-primary"}`}>
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
      <div className="contents">
        <h3 className="col-span-2 text-xs font-semibold uppercase tracking-wide text-primary/65">{t(slot.mealType === "BREAKFAST" ? "Breakfast" : slot.mealType === "LUNCH" ? "Lunch" : "Dinner")}</h3>
        {slot.skipped ? <p className="mt-1 text-sm">{t("Meal skipped")}</p> : recipe ? <>
          <h4 className="col-span-2 mt-1 break-words text-lg font-semibold"><button type="button" onClick={() => setPanel("recipe")} className="min-h-11 w-full text-left hover:underline">{recipe.name}</button></h4>
          <p className="mt-1 text-sm text-primary/70">{recipe.timeToPrepare} · {t("{count} servings", { count: slot.servings })}</p>
        </> : <button type="button" disabled={busy || slot.locked} onClick={onGenerate} className={`${button} -ml-3 mt-1 justify-self-start text-left`}>+ {t("Add meal")}</button>}
      </div>
      <div className="flex shrink-0 items-center gap-1 self-end">
        {recipe && !slot.skipped && <button type="button" disabled={busy || slot.locked} onClick={onGenerate} className={button}>{t("Swap")}</button>}
        <PlannerMenu label={t("Meal options")}>
          {recipe && !slot.skipped && <button type="button" disabled={busy} onClick={() => onChange(slot.locked ? "UNLOCK" : "LOCK")} aria-pressed={slot.locked} className={menuButton}>{t(slot.locked ? "Allow replanning" : "Keep when replanning")}</button>}
          {!slot.skipped && <div className="flex items-center justify-between gap-2 px-2 py-1">
            <span className="text-sm">{t("{count} servings", { count: slot.servings })}</span>
            <div className="flex"><button type="button" data-keep-open aria-label={t("Decrease servings")} disabled={busy || slot.locked || slot.servings <= 1} onClick={() => onChange("SERVINGS", slot.servings - 1)} className={button}>−</button>
              <button type="button" data-keep-open aria-label={t("Increase servings")} disabled={busy || slot.locked || slot.servings >= 100} onClick={() => onChange("SERVINGS", slot.servings + 1)} className={button}>+</button></div>
          </div>}
          <button type="button" disabled={busy || slot.locked} onClick={() => onChange(slot.skipped ? "RESTORE" : "SKIP")} className={menuButton}>{t(slot.skipped ? "Restore meal" : "Skip meal")}</button>
          {recipe && plan && onApplied && !slot.skipped && <button type="button" disabled={busy || slot.locked} onClick={() => { setEditorVisited(true); setPanel("edit"); }} className={menuButton}>{t("Edit recipe")}</button>}
          {extraMenuItems}
        </PlannerMenu>
      </div>
    </div>
    {slot.locked && <p className="mt-1 text-xs font-semibold">{t("Kept when replanning")}</p>}
    {status}
    {slot.generationStatus === "FAILED" && <p className="mt-2 text-sm text-red-700">{t("Generation failed. Your previous meal is kept; you can retry.")}</p>}
    {recipe && <PlannerDialog open={panel !== null} title={panel === "edit" ? t("Edit recipe") : recipe.name} onClose={() => setPanel(null)}>
      <div hidden={panel !== "recipe"} className="space-y-4">
        <p>{recipe.description}</p>
        <p className="text-sm text-primary/70">{recipe.timeToPrepare} · {t("{count} servings", { count: recipePortions ?? slot.servings })}</p>
        {recipeActions?.(() => setPanel(null))}
        <h3 className="font-semibold">{t("Ingredients")}</h3>
        <ul className="list-disc space-y-1 pl-5">{recipe.ingredients.map((item, index) => <li key={index}>
          {Number((item.amount * (recipePortions ?? slot.servings) / recipe.servings).toFixed(2))} {item.unit} {item.name}
        </li>)}</ul>
        <h3 className="font-semibold">{t("Preparation")}</h3>
        <ol className="list-decimal space-y-2 pl-5">{recipe.instructions.map((step, index) => <li key={index}>{step}</li>)}</ol>
        {plan && onApplied && <button type="button" disabled={busy || slot.locked || slot.skipped} className={button} onClick={() => { setEditorVisited(true); setPanel("edit"); }}>{t("Edit recipe")}</button>}
      </div>
      <div hidden={panel !== "edit"}>{editorVisited && plan && onApplied && <MealPlanRevision autoStart plan={plan} slot={slot} disabled={busy} onApplied={onApplied} onDraftChange={draftChanged} onBusyChange={busyChanged} />}</div>
    </PlannerDialog>}
  </article>;
}
