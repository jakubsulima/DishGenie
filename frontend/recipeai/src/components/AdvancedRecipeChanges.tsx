import {useCallback,useEffect} from 'react';
import type {MealPlan,PlanSlot} from '../lib/mealPlans';
import MealPlanRevision from './MealPlanRevision';
export default function AdvancedRecipeChanges({plan,slot,onSaved,onDraftChange,onBusyChange}:{plan:MealPlan;slot:PlanSlot;onSaved:(plan:MealPlan)=>void;onDraftChange:(slotId:string,dirty:boolean)=>void;onBusyChange:(busy:boolean)=>void}) {
  useEffect(()=>()=>onBusyChange(false),[onBusyChange]);
  const draftChanged=useCallback((dirty:boolean)=>onDraftChange(slot.id,dirty),[onDraftChange,slot.id]);
  return <MealPlanRevision autoStart plan={plan} slot={slot} disabled={false} onApplied={onSaved} onDraftChange={draftChanged} onBusyChange={onBusyChange}/>;
}
