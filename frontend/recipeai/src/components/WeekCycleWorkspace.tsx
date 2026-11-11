import ShoppingOffers from "./ShoppingOffers";
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/languageContext';
import { useFridge, type unitType } from '../context/fridgeContext';
import { changePlanSlot, localDateInput, type MealPlan, type PlanShopping, type PlanSlot, type PlanRecipe } from '../lib/mealPlans';
import { applyChange, assignReadyPortions, cycleResources, confirmInventoryReview, type CycleResources, cookingPreview, cookBatch, eatPortions, listTrips, pendingManual, planBatches, prepareTrip, previewChange, shoppingPreview, undoCooking, type BatchChange, type ChangePreview, type CookPreview, type ShoppingTrip } from '../lib/weekCycle';
import { cycleError } from '../lib/cycleErrors';
import { captureEvent } from '../lib/posthog';
import FridgeOperationReview from "./FridgeOperationReview";
import AdvancedRecipeChanges from "./AdvancedRecipeChanges";
import RecipeSnapshotEditor from "./RecipeSnapshotEditor";
import PlannerDialog from './PlannerDialog';
import MealPlanSlotCard from './MealPlanSlotCard';
import ShoppingTripPanel from './ShoppingTripPanel';
import MealPlanPricing from './MealPlanPricing';
import MealChangeSummary from './MealChangeSummary';

export default function WeekCycleWorkspace({plan,onSaved,onGenerate,onResume,onStop,jobRunning,progress,busy,onNextWeek,onDraftChange,onBusyChange}:{plan:MealPlan;onSaved:(p:MealPlan)=>void;onGenerate:(id:string)=>void;onResume:()=>void;onStop:()=>void;jobRunning:boolean;progress:string;busy:boolean;onNextWeek:()=>void;onDraftChange:(slotId:string,dirty:boolean)=>void;onBusyChange:(busy:boolean)=>void}) {
  const {t,locale}=useLanguage();const {refreshFridgeItems}=useFridge();const [params,setParams]=useSearchParams();
  const [resources,setResources]=useState<CycleResources|null>(null);
  const [shopping,setShopping]=useState<PlanShopping|null>(null);const [trips,setTrips]=useState<ShoppingTrip[]>([]);
  const [manual,setManual]=useState<{id:number;name:string}[]>([]);const [selectedManual,setSelectedManual]=useState<number[]>([]);
  const [error,setError]=useState('');const [saving,setSaving]=useState(false);
  const [previewChangeInput,setPreviewChangeInput]=useState<BatchChange|null>(null);
  const [preview,setPreview]=useState<ChangePreview|null>(null);const [cook,setCook]=useState<CookPreview|null>(null);const [updateStock,setUpdateStock]=useState(true);
  const [choose,setChoose]=useState<{slot:PlanSlot;action:'SHARE'|'MOVE'}|null>(null);const [target,setTarget]=useState('');const [replaceOccupied,setReplaceOccupied]=useState(false);
  const [advancedSlotId,setAdvancedSlotId]=useState<string|null>(null);const [advancedDirty,setAdvancedDirty]=useState(false);
  const [recipeEditorOpen,setRecipeEditorOpen]=useState(false);const [recipeDirty,setRecipeDirty]=useState(false);
  const [recipeDraft,setRecipeDraft]=useState<{slot:PlanSlot;recipe:PlanRecipe}|null>(null);
  const mounted=useRef(true);const working=useRef(false);const epoch=useRef(0);const currentId=useRef(plan.id);currentId.current=plan.id;
  const batches=planBatches(plan);
  // Historical view=today links now open the full week.
  const view=params.get('view')==='shopping'?'shopping':'meals';
  const openTrip=trips.find(trip=>trip.id===params.get('trip'))??trips.find(trip=>trip.status!=='COMPLETED'&&trip.status!=='CANCELLED');
  const disabled=busy||saving||jobRunning;
  const button='min-h-11 rounded-lg border border-primary/20 px-3 py-2 text-sm font-semibold disabled:opacity-40';
  const menuButton='block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-primary/5 disabled:opacity-40';
  const dateLabel=(date:string)=>new Date(`${date}T12:00:00`).toLocaleDateString(locale,{weekday:'long',day:'numeric',month:'long'});
  const primary='min-h-11 rounded-lg bg-primary px-5 py-3 font-semibold text-white disabled:opacity-40';
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    let ignore=false;
    void Promise.allSettled([shoppingPreview(plan.id),listTrips(),pendingManual(),cycleResources(plan.id)]).then(results=>{
      if(ignore)return;
      const [s,ts,m,r]=results;
      if(r.status==='fulfilled')setResources(r.value);
      if(s.status==='fulfilled')setShopping(s.value);
      if(ts.status==='fulfilled')setTrips(ts.value.filter(trip=>trip.planId===plan.id));
      if(m.status==='fulfilled')setManual(m.value);
      if(results.some(r=>r.status==='rejected'))setError(t('Could not load the latest data. Refresh before confirming.'));
    });return()=>{ignore=true;};
  },[plan,t]);
  const run=async<T,>(operation:()=>Promise<T>,apply:(result:T)=>void)=>{
    if(working.current)return;working.current=true;setSaving(true);onBusyChange(true);setError('');const e=++epoch.current;const id=plan.id;
    try{const result=await operation();if(mounted.current&&currentId.current===id&&e===epoch.current)apply(result);}
    catch(error){if(mounted.current&&currentId.current===id)setError(cycleError(error,t));}
    finally{working.current=false;if(mounted.current){setSaving(false);onBusyChange(false);}}
  };
  const switchView=(next:string)=>setParams(old=>{const p=new URLSearchParams(old);p.set('view',next);return p;});
  const showPreview=(change:BatchChange)=>void run(()=>previewChange(plan,change),result=>{setPreviewChangeInput(change);setChoose(null);setRecipeEditorOpen(false);setPreview(result);captureEvent('post_shopping_change_previewed',{operation:change.action,affectedSlotCount:result.affectedSlots.length});});
  const prepare=()=>void run(()=>prepareTrip(plan,selectedManual),trip=>{setTrips(all=>[trip,...all.filter(p=>p.id!==trip.id)]);setParams({plan:plan.id,view:'shopping',trip:trip.id});});
  const displayed=plan.plan.slots;
  const remaining=plan.plan.slots.filter(s=>!s.skipped&&!s.recipe).length;
  const planned=plan.plan.slots.filter(s=>!s.skipped&&s.recipe).length;
  const hasRequirements=shopping?.items.some(i=>i.amount===null||i.amount>0||i.needsReview)??false;
  return <div className="space-y-4">
    <nav aria-label={t('Plan views')} className="flex border-b border-primary/20">{(['meals','shopping'] as const).map(v=><button key={v} type="button" className={`${button} flex-1 border-0 ${view===v?'bg-primary/10':''}`} aria-current={view===v?'page':undefined} onClick={()=>switchView(v)}>{t(v==='meals'?'Week':'Shopping')}</button>)}</nav>
    {error&&<p className="rounded-lg bg-amber-50 p-3" role="alert">{error}</p>}
    {progress&&<p role="status">{progress}</p>}
    {jobRunning&&<button className={button} disabled={saving} onClick={onStop}>{t('Stop after this meal')}</button>}
    {plan.plan.cycle?.inventoryReview&&<p role="status" className="rounded-lg bg-amber-50 p-3">{t('Inventory needs checking after cooking without full stock confirmation.')}</p>}
    {resources?.overlappingPlanIds.length ? <p role="status" className="rounded-lg bg-amber-50 p-3">{t('Another active week uses these stocks. Recalculate before shopping.')}</p> : null}
    {plan.plan.cycle?.inventoryReview&&resources&&<button className={button} disabled={disabled} onClick={()=>void run(()=>confirmInventoryReview(plan,resources.inventoryFingerprint),onSaved)}>{t('I checked and corrected my fridge quantities')}</button>}
    {view==='shopping'?<>
      {!openTrip && <ShoppingOffers />}
      {openTrip?<ShoppingTripPanel embedded key={openTrip.id} trip={openTrip} onSaved={saved=>{setTrips(all=>[saved,...all.filter(p=>p.id!==saved.id)]);void refreshFridgeItems();if(saved.status==='COMPLETED'){void shoppingPreview(plan.id).then(setShopping).catch(()=>{});void cycleResources(plan.id).then(setResources).catch(()=>{});}}}/>:<>
        <h2 className="text-lg font-bold">{t('Shopping list')}</h2><p className="text-sm text-primary/65">{t('{count} meals included',{count:planned})}</p>
        {!shopping?.items.length&&<p>{t('No ingredients to buy yet.')}</p>}
        {shopping?.items.map(item=><p className="break-words py-2" key={item.key}>{item.name} · {item.amount??t('Check amount')} {item.unit}{item.needsReview?` · ${t('Check at home')}`:''}</p>)}
      </>}
      {!openTrip||openTrip.status==='COMPLETED'?<>
        {manual.length>0&&<details><summary className="min-h-11 cursor-pointer py-2">{t('Additional products')}</summary><fieldset><legend className="font-semibold">{t('Include pending additional products')}</legend>{manual.map(item=><label key={item.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={selectedManual.includes(item.id)} onChange={e=>setSelectedManual(all=>e.target.checked?[...all,item.id]:all.filter(id=>id!==item.id))}/><span className="break-words">{item.name}</span></label>)}</fieldset></details>}
        <button className={primary} disabled={disabled||!planned&&!selectedManual.length} onClick={prepare}>{t(openTrip?'Buy missing items':'Go to shopping')}</button>
      </>:null}
      <details><summary className="min-h-11 cursor-pointer py-2 text-sm text-primary/65">{t('Prices and history')}</summary>
        {openTrip&&openTrip.status!=='COMPLETED'&&<button className={button} disabled={disabled} onClick={prepare}>{t('Update future requirements')}</button>}
        <details><summary className="min-h-11 cursor-pointer py-2">{t('Previous shopping lists')}</summary>{trips.map(trip=><button key={trip.id} className={`${button} mr-2 mt-2`} onClick={()=>setParams({plan:plan.id,view:'shopping',trip:trip.id})}>{new Date(trip.createdAt).toLocaleDateString()} · {t(trip.status==='COMPLETED'?'Shopping completed':'Shopping list')}</button>)}</details>
        <details><summary className="min-h-11 cursor-pointer py-2">{t('Prices (optional)')}</summary><MealPlanPricing plan={plan} disabled={disabled} compact onSelected={onSaved}/></details>
      </details>
    </>:<>
      {remaining>0&&<button className={primary} disabled={disabled} onClick={onResume}>{t('Resume planning')}</button>}
      {planned>0&&hasRequirements&&<button className={remaining?button:primary} disabled={disabled} onClick={prepare}>{t('Go to shopping')}</button>}
      {!displayed.length&&<p>{t('No meals for this day. Open the week to choose another day.')}</p>}
      {displayed.map((slot,index)=>{
        const batch=batches.find(b=>b.allocations.some(a=>a.slotId===slot.id&&a.status!=='SKIPPED'));const allocation=batch?.allocations.find(a=>a.slotId===slot.id);
        const isCooked=batch?.status==='COOKED';
        const isEaten=allocation?.status==='EATEN';
        const cookingAction=(close?:()=>void)=>{
          if(!batch||slot.skipped||isEaten)return null;
          if(isCooked)return <button className={close?primary:menuButton} disabled={disabled} onClick={()=>{close?.();void run(()=>eatPortions(plan,slot),onSaved);}}>{t('Mark portions eaten')}</button>;
          if(batch.cookingDate!==slot.date)return null;
          return <button className={close?primary:menuButton} disabled={disabled} onClick={()=>{close?.();void run(()=>cookingPreview(plan,batch.id),setCook);}}>{t('Mark as cooked')}</button>;
        };
        return <section key={slot.id} className="min-w-0">
          {(index===0||displayed[index-1].date!==slot.date)&&<h2 className="mt-5 flex items-center gap-2 font-bold first-letter:uppercase">{dateLabel(slot.date)}{slot.date===localDateInput()&&<span className="rounded bg-primary/10 px-2 py-1 text-xs">{t('Today')}</span>}</h2>}
          <MealPlanSlotCard slot={slot} recipePortions={batch?.cookingDate===slot.date?batch.portions:slot.servings} busy={disabled||isCooked}
            status={batch&&(isCooked||batch.cookingDate!==slot.date||batch.portions!==slot.servings)?<p className="mt-2 text-sm text-primary/65">{isEaten?t('Eaten'):isCooked?t('Ready portions'):batch.cookingDate!==slot.date?t('Portions from {date}',{date:dateLabel(batch.cookingDate)}):t('Cook {count} portions',{count:batch.portions})}</p>:undefined}
            recipeActions={close=>cookingAction(close)}
            extraMenuItems={<>
              {(!slot.recipe||slot.skipped)&&resources?.readyPortions.filter(b=>b.unallocated>0).map(ready=><button key={`${ready.planId}:${ready.batchId}`} disabled={disabled} className={menuButton} onClick={()=>void run(()=>assignReadyPortions(plan,ready,slot.id,Math.min(slot.servings,ready.unallocated)),onSaved)}>{t('Use ready portions')}: {ready.name} · {Math.min(slot.servings,ready.unallocated)} {t('servings')}</button>)}
              {slot.recipe&&!slot.skipped&&!isCooked&&<>
                <button className={menuButton} disabled={disabled||slot.locked} onClick={()=>{setTarget('');setReplaceOccupied(false);setChoose({slot,action:'SHARE'});}}>{t('Cook for two days')}</button>
                <button className={menuButton} disabled={disabled||slot.locked} onClick={()=>{setTarget('');setChoose({slot,action:'MOVE'});}}>{t('Move meal')}</button>
                <button className={menuButton} disabled={disabled||slot.locked} onClick={()=>{if(slot.recipe){setRecipeDraft({slot,recipe:slot.recipe});setRecipeEditorOpen(true);}}}>{t('Edit recipe')}</button>
                <button className={menuButton} disabled={disabled||slot.locked} onClick={()=>setAdvancedSlotId(slot.id)}>{t('More recipe changes')}</button>
              </>}
              {cookingAction()}
              {isCooked&&!isEaten&&<>
                <button className={menuButton} disabled={disabled} onClick={()=>void run(()=>undoCooking(plan,batch.id),onSaved)}>{t('Undo cooking')}</button>
                {(['STORED','FROZEN','DISCARDED'] as const).map(storage=><button key={storage} className={menuButton} disabled={disabled} onClick={()=>showPreview({action:'STORE',slotId:slot.id,storage})}>{t({STORED:'Stored',FROZEN:'Frozen',DISCARDED:'Discarded'}[storage])}</button>)}
                <button className={menuButton} disabled={disabled} onClick={()=>showPreview({action:'RELEASE',slotId:slot.id})}>{t('Release these portions')}</button>
              </>}
            </>}
            onGenerate={()=>slot.recipe?showPreview({action:'RECIPE',slotId:slot.id}):onGenerate(slot.id)} onChange={(action,portions)=>{
              if(action==='SKIP'||action==='SERVINGS')showPreview({action,slotId:slot.id,portions});else void run(()=>changePlanSlot(plan,slot.id,action,portions),onSaved);
            }}/>
        </section>;
      })}
      <button className={`${button} mt-5`} disabled={disabled} onClick={onNextWeek}>{t('Plan next week')}</button>
    </>}
    <PlannerDialog open={advancedSlotId!==null} title={t('More recipe changes')} onClose={()=>{if(disabled)return;if(!advancedDirty||window.confirm(t('Discard unfinished changes?'))){if(advancedSlotId)onDraftChange(advancedSlotId,false);setAdvancedSlotId(null);setAdvancedDirty(false);}}}>
      {advancedSlotId&&plan.plan.slots.find(slot=>slot.id===advancedSlotId)&&<AdvancedRecipeChanges plan={plan} slot={plan.plan.slots.find(slot=>slot.id===advancedSlotId)!} onSaved={saved=>{onDraftChange(advancedSlotId,false);onSaved(saved);setAdvancedSlotId(null);setAdvancedDirty(false);}} onBusyChange={onBusyChange} onDraftChange={(id,dirty)=>{setAdvancedDirty(dirty);onDraftChange(id,dirty);}}/>}
    </PlannerDialog>
    <PlannerDialog open={choose!==null} title={t(choose?.action==='MOVE'?'Move meal':'Cook for two days')} onClose={()=>setChoose(null)}>
      <label>{t('Target meal')}<select className="mt-2 w-full rounded border p-3" value={target} onChange={e=>setTarget(e.target.value)}><option value="">{t('Choose a meal')}</option>{plan.plan.slots.filter(s=>s.id!==choose?.slot.id).map(s=><option key={s.id} value={s.id}>{s.date} · {t(s.mealType==='BREAKFAST'?'Breakfast':s.mealType==='LUNCH'?'Lunch':'Dinner')} · {s.recipe?.name??t('Empty')}</option>)}</select></label>
      {choose?.action==='SHARE'&&<label className="mt-3 flex min-h-11 items-center gap-2"><input type="checkbox" checked={replaceOccupied} onChange={e=>setReplaceOccupied(e.target.checked)}/>{t('Replace an occupied meal (shown in preview)')}</label>}
      {error&&<p role="alert">{error}</p>}<button className={`${primary} mt-3`} disabled={disabled||!target} onClick={()=>choose&&showPreview({action:choose.action,slotId:choose.slot.id,targetSlotId:target,replaceOccupied})}>{t('Preview change')}</button>
    </PlannerDialog>
    <PlannerDialog open={recipeEditorOpen} title={t('Edit recipe')} onClose={()=>{if(!recipeDirty||window.confirm(t("Discard unfinished changes?"))){if(recipeDraft)onDraftChange(recipeDraft.slot.id,false);setRecipeDraft(null);setRecipeEditorOpen(false);setRecipeDirty(false);}}}>
      {recipeDraft && <RecipeSnapshotEditor recipe={recipeDraft.recipe} onChange={recipe=>{setRecipeDirty(true);if(recipeDraft)onDraftChange(recipeDraft.slot.id,true);setRecipeDraft(old=>old?{...old,recipe}:null);}}/>}
      {error&&<p role="alert">{error}</p>}<button className={primary} disabled={disabled} onClick={()=>recipeDraft&&showPreview({action:'RECIPE',slotId:recipeDraft.slot.id,recipe:recipeDraft.recipe})}>{t('Preview change')}</button>
    </PlannerDialog>
    <PlannerDialog open={preview!==null} title={t('Change and shopping impact')} onClose={()=>{setPreview(null);if(recipeDraft)setRecipeEditorOpen(true);}}>
      {preview&&<MealChangeSummary plan={plan} preview={preview}/>}
      {previewChangeInput?.action==='SKIP'&&<details><summary className="min-h-11 cursor-pointer py-2">{t('Portion options')}</summary><label className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={disabled} checked={previewChangeInput.keepExtra??false} onChange={e=>showPreview({...previewChangeInput,keepExtra:e.target.checked})}/>{t('Keep extra portions when skipping a meal')}</label></details>}
      {error&&<p role="alert">{error}</p>}<button className={`${primary} mt-3`} disabled={disabled} onClick={()=>preview&&void run(()=>applyChange(plan,preview.id),saved=>{setPreview(null);if(recipeDraft)onDraftChange(recipeDraft.slot.id,false);setRecipeDraft(null);setRecipeDirty(false);onSaved(saved);captureEvent('post_shopping_change_applied',{affectedSlotCount:preview.affectedSlots.length});})}>{t('Apply change')}</button>
    </PlannerDialog>
    <PlannerDialog open={cook!==null} title={t('Confirm cooking')} onClose={()=>setCook(null)}>
      <label>{t('Prepared portions')}<input type="number" className="ml-2 w-24 rounded border p-2" min={1} max={1400} value={cook?.portions??1} onChange={e=>{const value=Number(e.target.value);if(cook&&value>0)void run(()=>cookingPreview(plan,cook.batchId,value),setCook);}}/></label>
      <ul className="my-3 space-y-2">{cook?.allocations.map(a=><li key={a.slotId}>{plan.plan.slots.find(slot=>slot.id===a.slotId)?.date} · {a.portions} {t('servings')}</li>)}</ul>
      <details><summary className="min-h-11 cursor-pointer py-2">{t('Ingredients used')}</summary>{cook&&<FridgeOperationReview readOnly changes={cook.changes.map(c=>({key:String(c.fridgeItemId),name:c.name,amount:String(c.amount),unit:c.unit as unitType,selected:true,quantityAccuracy:'EXACT'}))} onChange={()=>{}}/>}</details>
      {cook?.uncovered.items.some(i=>i.needsReview||i.amount===null||(i.amount??0)>0)&&<p className="rounded bg-amber-50 p-3">{t('Some ingredient quantities need checking. Only confirmed available amounts will be consumed.')}</p>}
      <label className="my-4 flex min-h-11 items-center gap-2"><input type="checkbox" checked={updateStock} onChange={e=>setUpdateStock(e.target.checked)}/>{t('Update fridge quantities')}</label>
      {error&&<p role="alert">{error}</p>}<button className={primary} disabled={disabled} onClick={()=>cook&&void run(()=>cookBatch(plan,cook,updateStock),saved=>{setCook(null);onSaved(saved);void refreshFridgeItems();captureEvent('cooking_batch_recorded',{portions:cook.portions,inventoryUpdated:updateStock});})}>{t('Confirm cooking')}</button>
    </PlannerDialog>
  </div>;
}
