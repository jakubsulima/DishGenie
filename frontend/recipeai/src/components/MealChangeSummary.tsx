import { useLanguage } from '../context/languageContext';
import type { MealPlan } from '../lib/mealPlans';
import type { ChangePreview } from '../lib/weekCycle';

export default function MealChangeSummary({ plan, preview }: { plan: MealPlan; preview: ChangePreview }) {
  const { t, locale } = useLanguage();
  const changedItems = preview.shoppingAfter.items.filter(item => !preview.shoppingBefore.items.some(before =>
    before.name === item.name && before.unit === item.unit && before.amount === item.amount && before.needsReview === item.needsReview));
  return <div className="space-y-4">
    {preview.affectedSlots.map(id => {
      const before = plan.plan.slots.find(slot => slot.id === id);
      const after = preview.after.slots.find(slot => slot.id === id);
      if (!after) return null;
      return <section key={id} className="rounded-lg bg-primary/5 p-3">
        <p className="text-sm">{new Date(`${after.date}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })} · {t(after.mealType === 'BREAKFAST' ? 'Breakfast' : after.mealType === 'LUNCH' ? 'Lunch' : 'Dinner')}</p>
        {before?.recipe && <p className="mt-2 text-sm text-primary/65">{t('Before')}: {before.recipe.name}</p>}
        <h3 className="mt-1 font-semibold">{after.skipped ? t('Meal skipped') : after.recipe?.name ?? t('Empty')}</h3>
        {after.recipe && !after.skipped && <>
          <p className="text-sm">{after.recipe.timeToPrepare} · {t('{count} servings', { count: after.servings })}</p>
          <p className="mt-2 text-sm">{after.recipe.description}</p>
          <details className="mt-2"><summary className="min-h-11 cursor-pointer py-2">{t('Recipe details')}</summary>
            <ul className="list-disc space-y-1 pl-5">{after.recipe.ingredients.map((item, index) => <li key={index}>{Number((item.amount * after.servings / after.recipe!.servings).toFixed(2))} {item.unit} {item.name}</li>)}</ul>
            <ol className="mt-3 list-decimal space-y-2 pl-5">{after.recipe.instructions.map((step, index) => <li key={index}>{step}</li>)}</ol>
          </details>
        </>}
      </section>;
    })}
    <section>
      <h3 className="font-semibold">{t('Shopping changes')}</h3>
      {!changedItems.length && !preview.unusedProducts.length && <p className="mt-2 text-sm">{t('Shopping requirements are unchanged.')}</p>}
      {changedItems.map(item => <p key={item.key} className="mt-2 text-sm">{item.name} · {t('Needed now')}: {item.amount ?? t('Check amount')} {item.unit}{item.needsReview ? ` · ${t('Check at home')}` : ''}</p>)}
      {preview.unusedProducts.length > 0 && <p className="mt-2 text-sm">{t('No longer needed')}: {preview.unusedProducts.join(', ')}</p>}
    </section>
  </div>;
}
