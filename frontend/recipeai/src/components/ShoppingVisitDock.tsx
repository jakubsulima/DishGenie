import ShoppingOffers from "./ShoppingOffers";
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/languageContext';
import { getTrip, listTrips, pendingManual, prepareTrip, type ShoppingTrip } from '../lib/weekCycle';
import ShoppingTripPanel from './ShoppingTripPanel';
export default function ShoppingVisitDock({manual}:{manual:ReactNode}) {
  const {t}=useLanguage();const [params,setParams]=useSearchParams();const [trip,setTrip]=useState<ShoppingTrip|null>(null);const [history,setHistory]=useState<ShoppingTrip[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const working=useRef(false);
  const id=params.get('trip'); const manualOnly=params.has('manual');
  useEffect(()=>{let ignore=false;
    void listTrips().then(all=>{if(ignore)return;setHistory(all);const current=id?all.find(t=>t.id===id):manualOnly?undefined:all.find(t=>t.status==='DRAFT'||t.status==='IN_PROGRESS');if(current)setTrip(current);else if(id)void getTrip(id).then(t=>{if(!ignore)setTrip(t);}).catch(()=>{if(!ignore)setError(t('Could not load this visit.'));});else setTrip(null);}).catch(()=>{if(!ignore&&id)setError(t('Could not load this visit.'));});
    return()=>{ignore=true;};},[id,manualOnly,t]);
  const start=async()=>{if(working.current)return;working.current=true;setBusy(true);try{const items=await pendingManual();const saved=await prepareTrip(null,items.map(i=>i.id));setTrip(saved);setParams({trip:saved.id});}catch{setError(t('Could not save. Retry after reconnecting.'));}finally{working.current=false;setBusy(false);}};
  return <>
    {!trip && <ShoppingOffers />}
    <div className="mx-auto max-w-4xl space-y-3 px-4 pt-5 text-primary">
      {error&&<p role="alert">{error}</p>}
      {trip&&<ShoppingTripPanel key={trip.id} trip={trip} onSaved={setTrip}/>}
      <details><summary className="min-h-11 cursor-pointer py-2">{t('Shopping options')}</summary>
        {!trip&&<button type="button" disabled={busy} className="min-h-11 underline" onClick={()=>void start()}>{t('Use this list for shopping')}</button>}
        <p className="mt-2 text-sm font-semibold">{t('Previous shopping lists')}</p>{history.map(item=><button key={item.id} className="mr-3 min-h-11 underline" onClick={()=>setParams({trip:item.id})}>{new Date(item.createdAt).toLocaleDateString()} · {t(item.status==='COMPLETED'?'Shopping completed':'Shopping list')}</button>)}
      {trip&&<button className="min-h-11 underline" onClick={()=>{setTrip(null);setParams({manual:'1'});}}>{t('Additional products')}</button>}
      </details>
    </div>
    {!trip&&manual}
  </>;
}
