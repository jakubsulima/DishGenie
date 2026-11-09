import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/languageContext';
import { useFridge, UNIT_OPTIONS, type unitType } from '../context/fridgeContext';
import PlannerDialog from './PlannerDialog';
import PlannerMenu from './PlannerMenu';
import { type FridgeOperationReviewChange } from './FridgeOperationReview';
import { addTripLine, changeTripLine, confirmTrip, retryTripImport, getTrip, undoTripImport, replayPendingTrip, type ShoppingTrip } from '../lib/weekCycle';
import { cycleError } from '../lib/cycleErrors';
import { captureEvent } from '../lib/posthog';

export default function ShoppingTripPanel({ trip: initial, onSaved, embedded = false }: {trip: ShoppingTrip; onSaved: (trip: ShoppingTrip)=>void; embedded?: boolean}) {
  const { t } = useLanguage(); const { refreshFridgeItems } = useFridge();
  useEffect(()=>{captureEvent('shopping_trip_opened',{itemCount:initial.trip.lines.length,completed:initial.status==='COMPLETED'});},[initial.id,initial.status,initial.trip.lines.length]);
  const [trip,setTrip] = useState(initial); const [busy,setBusy] = useState(false);const [error,setError] = useState('');
  const [review,setReview] = useState(false);const [retryMode,setRetryMode]=useState(false);const [pendingState,setPendingState]=useState<Record<string,string>>({});const [changes,setChanges] = useState<FridgeOperationReviewChange[]>([]);
  const [prices,setPrices] = useState<Record<string,string>>({});const [name,setName] = useState('');const [amount,setAmount] = useState('');const [unit,setUnit] = useState<unitType>('');
  const working = useRef(false); const mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{setTrip(current=>initial.version>current.version?initial:current);},[initial]);
  const save = (saved: ShoppingTrip) => {setTrip(saved);onSaved(saved);};
  const run = async (work: ()=>Promise<ShoppingTrip>) => {
    if(working.current)return;working.current=true;setBusy(true);setError('');
    try {const saved=await work();if(mounted.current)save(saved);}
    catch(error) {if(mounted.current){setError(`${cycleError(error,t)} ${t('Could not save. Your pending action is kept. Retry after reconnecting.')}`);const status=error&&typeof error==='object'&&'status'in error?Number(error.status):0;
      if([400,403,404,409,422].includes(status)){setPendingState({});try{const latest=await getTrip(initial.id);if(mounted.current)save(latest);}catch{/* Retain the last confirmed snapshot. */}}}}
    finally {working.current=false;if(mounted.current)setBusy(false);}
  };
  const finish = (retry=false) => {
    setRetryMode(retry);setPrices({});
    setChanges(trip.trip.lines.filter(l=>l.state==='IN_BASKET'&&(!retry||l.importStatus!=='IMPORTED')).map(l=>({key:l.id,name:l.name,amount:l.purchasedAmount == null ? String(l.suggestedAmount ?? '') : String(l.purchasedAmount),unit:UNIT_OPTIONS.includes(l.unit as unitType)?l.unit as unitType:'',selected:l.source==='PLAN',quantityAccuracy:l.suggestedAmount==null?'UNKNOWN':'EXACT'})));
    setReview(true);
  };
  const complete = () => void run(async()=>{
    const saved=await (retryMode?retryTripImport:confirmTrip)(trip,changes.map(c=>({lineId:c.key,amount:c.quantityAccuracy==='UNKNOWN'||!c.amount?null:Number(c.amount),unit:c.unit||null,importToFridge:c.selected,actualPrice:prices[c.key]?Number(prices[c.key]):null})));
    if(mounted.current)setReview(false);await refreshFridgeItems();captureEvent('shopping_trip_completed',{itemCount:changes.length,importedCount:saved.trip.lines.filter(l=>l.importStatus==='IMPORTED').length});return saved;
  });
  useEffect(()=>{
    let ignore=false;
    const replay=async()=>{
      if(working.current)return;
      try { const saved=await replayPendingTrip(initial.id); if(saved&&!ignore){setTrip(saved);onSaved(saved);} }
      catch { if(!ignore)setError(t('Could not save. Your pending action is kept. Retry after reconnecting.')); }
    };
    void replay();window.addEventListener('online',replay);
    return()=>{ignore=true;window.removeEventListener('online',replay);};
  },[initial.id,onSaved,t]);
  const completeStatus=trip.status==='COMPLETED';
  const defaultStore=trip.trip.lines.find(l=>l.store)?.store ?? '';
  const grouped=trip.trip.lines.filter(l=>l.toBuy!==0||l.needsReview||l.source!=='PLAN'||completeStatus).sort((a,b)=>`${a.store??defaultStore}|${a.department}`.localeCompare(`${b.store??defaultStore}|${b.department}`));
  const groupLabel=(line: typeof grouped[number])=>`${({LIDL:'Lidl',BIEDRONKA:'Biedronka'} as Record<string,string>)[line.store??defaultStore]??t('Shopping')} · ${t(({VEGETABLES:'Vegetables',FRUIT:'Fruit',MEAT_FISH:'Meat and fish',DAIRY:'Dairy',DRY:'Dry goods',OTHER:'Other items'} as Record<string,string>)[line.department]??'Other items')}`;
  const button='min-h-11 rounded-lg border border-primary/20 px-3 py-2 text-sm font-semibold disabled:opacity-40';
  const menuButton='block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-primary/5 disabled:opacity-40';
  const primary='min-h-11 rounded-lg bg-primary px-5 py-3 font-semibold text-white disabled:opacity-40';
  const invalidPurchase=changes.some(c=>c.quantityAccuracy!=='UNKNOWN'&&c.amount!==''&&(!Number.isFinite(Number(c.amount))||Number(c.amount)<=0))
    ||Object.values(prices).some(price=>price!==''&&(!Number.isFinite(Number(price))||Number(price)<0));
  return <section className="min-w-0 space-y-4" aria-label={t('Shopping list')}>
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-lg font-bold">{t(completeStatus?'Shopping completed':'Shopping list')}</h2>
      <PlannerMenu label={t('Shopping options')} disabled={busy}>
        <button className={menuButton} onClick={()=>void run(()=>getTrip(trip.id))}>{t('Refresh')}</button>
        {!embedded&&trip.planId&&<Link className={menuButton} to={`/MealPlanner?plan=${trip.planId}&view=meals`}>{t('Week')}</Link>}
        {completeStatus&&trip.trip.lines.some(l=>l.state==='IN_BASKET'&&l.importStatus!=='IMPORTED')&&<button className={menuButton} onClick={()=>finish(true)}>{t('Complete skipped fridge imports')}</button>}
        {completeStatus&&trip.trip.inventoryOperationId&&<button className={menuButton} onClick={()=>void run(async()=>{const saved=await undoTripImport(trip);await refreshFridgeItems();return saved;})}>{t('Undo fridge import')}</button>}
      </PlannerMenu>
    </div>
    {error&&<p role="alert" className="rounded-lg bg-amber-50 p-3">{error}</p>}
    {busy&&<p role="status">{t('Saving...')}</p>}
    {completeStatus&&trip.trip.lines.some(line=>line.importToFridge&&line.importStatus?.startsWith('SKIPPED'))&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">{t('Some purchases were not added to your fridge. Open shopping options to finish adding them.')}</p>}
    {grouped.map((line,index)=><div key={line.id}>
      {(index===0||groupLabel(line)!==groupLabel(grouped[index-1]))&&<h3 className="mt-4 font-semibold">{groupLabel(line)}</h3>}
      <article className="relative min-w-0 border-b border-primary/10 py-2">
        <label className="flex min-h-11 items-start gap-3 pr-12">
          <input className="mt-2 h-5 w-5 shrink-0" type="checkbox" disabled={busy||completeStatus} checked={(pendingState[line.id]??line.state)==='IN_BASKET'} onChange={e=>{const state=e.target.checked?'IN_BASKET':'NEEDED';setPendingState(all=>({...all,[line.id]:state}));void run(async()=>{const saved=await changeTripLine(trip,line,state);setPendingState(all=>{const next={...all};delete next[line.id];return next;});return saved;});}}/>
          <span className="min-w-0 break-words"><strong>{line.name}</strong> · {(line.suggestedAmount==null&&line.toBuy==null)||(line.needsReview&&(line.suggestedAmount??line.toBuy)===0)?t('Check amount'):`${t('Buy')} ${line.suggestedAmount??line.toBuy} ${line.unit??''}`}{line.packages!=null&&<small> · {t('Packages')}: {line.packages}</small>}{line.needsReview&&<small className="block text-amber-900">{t('Check at home')}</small>}</span>
        </label>
        {line.state==='UNAVAILABLE'&&<p className="text-sm text-amber-900">{t('Product unavailable')}{trip.planId&&line.slotIds.length>0&&<> · <Link className="underline" to={`/MealPlanner?plan=${trip.planId}&view=meals#meal-slot-${line.slotIds[0]}`}>{t('Find a replacement meal')}</Link></>}</p>}
        {completeStatus&&<p className="text-sm">{t('Actually purchased')}: {line.importStatus!==null?`${line.purchasedAmount??t('Unknown')} ${line.purchasedUnit??''}`:t('Not purchased')}</p>}
        <details className="pl-8"><summary aria-label={`${t('Product options')}: ${line.name}`} className="absolute right-0 top-2 flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg text-xl text-primary/65 [&::-webkit-details-marker]:hidden">⋯</summary>
          <p className="text-sm">{t(line.source==='PLAN'?'From meal plan':'Additional item')} · {t('Needed')}: {line.needed??t('Unknown')} {line.unit} · {t('From home')}: {line.fromHome} {line.unit}</p><p className="text-sm">{t('To buy')}: {line.toBuy??t('Unknown')} {line.unit}</p>
          {line.packages!=null&&line.toBuy!=null&&<p className="text-sm">{t('Package surplus')}: {Math.max(0,Math.round(((line.purchasedAmount??line.suggestedAmount??0)-line.toBuy)*1000)/1000)} {line.unit}</p>}
          {completeStatus?<p className="text-sm">{t(line.importStatus==='IMPORTED'?'Added to fridge':line.importStatus==='UNDONE'?'Import undone':line.importStatus?.startsWith('SKIPPED')?'Import skipped — check amount and unit':'Not imported')}</p>:<button className={`${button} mt-2`} disabled={busy} onClick={()=>void run(()=>changeTripLine(trip,line,line.state==='UNAVAILABLE'?'NEEDED':'UNAVAILABLE'))}>{t(line.state==='UNAVAILABLE'?'Still need to buy':'Product unavailable')}</button>}
        </details>
      </article>
    </div>)}
    {trip.trip.lines.some(l=>l.toBuy===0&&!l.needsReview&&l.source==='PLAN')&&<details><summary className="min-h-11 cursor-pointer py-2">{t('Covered from home')}</summary>{trip.trip.lines.filter(l=>l.toBuy===0&&!l.needsReview&&l.source==='PLAN').map(l=><p key={l.id}>{l.name} · {l.fromHome} {l.unit}</p>)}</details>}
    {!completeStatus&&<>
      <form className="space-y-2" onSubmit={e=>{e.preventDefault();void run(async()=>{const saved=await addTripLine(trip,name,amount?Number(amount):null,unit||null);setName('');setAmount('');return saved;});}}>
        <div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-sm">{t('Additional product')}<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded border p-3"/></label><button className={button} disabled={busy}>{t('Add')}</button></div>
        <details><summary className="min-h-11 cursor-pointer py-2 text-sm text-primary/65">{t('Quantity (optional)')}</summary><div className="grid grid-cols-2 gap-3">
          <label>{t('Amount')}<input type="number" min="0.001" step="any" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full min-w-0 rounded border p-3"/></label>
          <label>{t('Unit')}<select value={unit} onChange={e=>setUnit(e.target.value as unitType)} className="w-full min-w-0 rounded border p-3">{UNIT_OPTIONS.map(u=><option key={u} value={u}>{u||t('Unknown')}</option>)}</select></label>
        </div></details>
      </form>
      <button className={primary} disabled={busy} onClick={()=>finish()}>{t('Finish shopping')}</button>
    </>}
    <PlannerDialog open={review} title={t('Confirm actual purchases')} onClose={()=>{if(!busy)setReview(false);}}>
      <p className="mb-4 text-sm">{t('Check your purchases. Select the food to add to your fridge.')}</p>
      {!changes.length&&<p className="mb-3">{t('No products checked. Unbought items will remain needed.')}</p>}
      {changes.map(c=><div key={c.key} className="border-b border-primary/10 py-3">
        <p className="font-semibold">{c.name} · {c.quantityAccuracy==='UNKNOWN'||!c.amount?t('Check amount'):c.amount} {c.unit}</p>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={c.selected} onChange={e=>setChanges(all=>all.map(item=>item.key===c.key?{...item,selected:e.target.checked}:item))}/>{t('Add to fridge')}</label>
        <details><summary className="min-h-11 cursor-pointer py-2 text-sm underline">{t('Edit purchase')}</summary>
          <div className="grid grid-cols-2 gap-3">
            <label>{t('Amount')}<input type="number" min="0.001" step="any" value={c.amount} onChange={e=>setChanges(all=>all.map(item=>item.key===c.key?{...item,amount:e.target.value,quantityAccuracy:e.target.value?'EXACT':'UNKNOWN'}:item))} className="w-full min-w-0 rounded border p-2"/></label>
            <label>{t('Unit')}<select value={c.unit} onChange={e=>setChanges(all=>all.map(item=>item.key===c.key?{...item,unit:e.target.value as unitType}:item))} className="w-full rounded border p-2">{UNIT_OPTIONS.map(u=><option key={u} value={u}>{u||t('Unknown')}</option>)}</select></label>
            <label className="col-span-2">{t('Quantity accuracy')}<select className="w-full rounded border p-2" value={c.quantityAccuracy} onChange={e=>setChanges(all=>all.map(item=>item.key===c.key?{...item,quantityAccuracy:e.target.value as FridgeOperationReviewChange['quantityAccuracy']}:item))}>{(['EXACT','ESTIMATED','UNKNOWN'] as const).map(value=><option key={value} value={value}>{t({EXACT:'Exact',ESTIMATED:'Estimated',UNKNOWN:'Unknown'}[value])}</option>)}</select></label>
            <label className="col-span-2">{t('Actual price (optional)')}<input type="number" min={0} step="0.01" value={prices[c.key]??''} onChange={e=>setPrices(all=>({...all,[c.key]:e.target.value}))} className="ml-2 w-24 rounded border p-2"/></label>
          </div>
        </details>
      </div>)}
      {invalidPurchase&&<p role="alert" className="mt-3 text-red-700">{t('Check purchase quantities and prices.')}</p>}
      {error&&<p role="alert">{error}</p>}
      <button className={`${primary} mt-4`} disabled={busy||invalidPurchase} onClick={complete}>{t('Confirm purchases')}</button>
    </PlannerDialog>
  </section>;
}
