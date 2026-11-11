import { useLanguage } from '../context/languageContext';
import type { PlanRecipe } from '../lib/mealPlans';
export default function RecipeSnapshotEditor({recipe,onChange}:{recipe:PlanRecipe;onChange:(recipe:PlanRecipe)=>void}) {
  const {t}=useLanguage();const field='mt-1 min-h-11 w-full min-w-0 rounded-lg border border-primary/20 p-3';
  return <div className="space-y-3">
    <label className="block">{t('Recipe name')}<input className={field} maxLength={160} value={recipe.name} onChange={e=>onChange({...recipe,name:e.target.value})}/></label>
    <label className="block">{t('Preparation time in minutes')}<input className={field} value={recipe.timeToPrepare} onChange={e=>onChange({...recipe,timeToPrepare:e.target.value})}/></label>
    <label className="block">{t('Servings')}<input className={field} type="number" min={1} max={100} value={recipe.servings} onChange={e=>onChange({...recipe,servings:Number(e.target.value)})}/></label>
    <fieldset><legend>{t('Ingredients')}</legend>{recipe.ingredients.map((ingredient,index)=><div className="mt-3 grid min-w-0 grid-cols-2 gap-2" key={index}>
      <label className="col-span-2">{t('Ingredient')} {index+1}<input className={field} maxLength={100} value={ingredient.name} onChange={e=>onChange({...recipe,ingredients:recipe.ingredients.map((i,n)=>n===index?{...i,name:e.target.value}:i)})}/></label>
      <label>{t('Quantity')} {index+1}<input className={field} type="number" min="0.001" step="any" value={ingredient.amount} onChange={e=>onChange({...recipe,ingredients:recipe.ingredients.map((i,n)=>n===index?{...i,amount:Number(e.target.value)}:i)})}/></label>
      <label>{t('Unit')} {index+1}<input className={field} value={ingredient.unit} onChange={e=>onChange({...recipe,ingredients:recipe.ingredients.map((i,n)=>n===index?{...i,unit:e.target.value}:i)})}/></label>
      <button type="button" className="min-h-11 underline" onClick={()=>onChange({...recipe,ingredients:recipe.ingredients.filter((_,n)=>n!==index)})}>{t('Remove ingredient')} {index+1}</button>
    </div>)}<button type="button" className="min-h-11 underline" onClick={()=>onChange({...recipe,ingredients:[...recipe.ingredients,{name:'',amount:1,unit:'g'}]})}>{t('Add ingredient')}</button></fieldset>
    <label className="block">{t('Instructions (one step per line)')}<textarea aria-label={t("Instructions (one step per line)")} className={`${field} min-h-36`} value={recipe.instructions.join('\n')} onChange={e=>onChange({...recipe,instructions:e.target.value.split('\n')})}/></label>
  </div>;
}
