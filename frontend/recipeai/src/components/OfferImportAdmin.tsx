import { useState } from "react";
import { apiClient } from "../lib/hooks";
import { useLanguage } from "../context/languageContext";
import type { CatalogOffer } from "../lib/planPricing";
interface ImportView { version: number; batch: { id: string; importedAt: string; status: string;
  input: { adapter: string; store: string; fetchedAt: string; sourceUpdatedAt: string | null; expectedCount: number };
  rows: { source: { sourceProductId: string; sourceUrl: string; evidence: string }; status: string; reason: string; published: CatalogOffer | null }[] } }
function ReviewRow({ view, index, busy, previous, onReview }: { previous?: ImportView["batch"]["rows"][number]; view: ImportView; index: number; busy: boolean; onReview: (body: unknown) => void }) {
  const { t } = useLanguage(); const row = view.batch.rows[index];
  const [offer, setOffer] = useState(""); const [reason, setReason] = useState(""); const [invalid, setInvalid] = useState(false);
  const source = /^https:\/\/(www\.)?(lidl|biedronka)\.pl\//.test(row.source.sourceUrl) ? row.source.sourceUrl : null;
  return <details className="rounded-xl border border-primary/15 p-3">
    <summary>{row.source.sourceProductId} · {row.status}</summary>
    {source ? <a href={source} target="_blank" rel="noopener noreferrer" className="underline">{t("Offer source")}</a> : <p>{row.source.sourceUrl}</p>}
    <pre className="my-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{row.source.evidence}</pre>
    <p className="text-sm">{row.reason}</p>
    {previous ? <details className="my-3"><summary className="cursor-pointer font-semibold">{t("Compare with previous import")}</summary><div className="mt-2 grid gap-3 sm:grid-cols-2">
      <div><p>{t("Previous source evidence")}</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{previous.source.evidence}</pre></div>
      <div><p>{t("Current source evidence")}</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{row.source.evidence}</pre></div>
      {previous.published && <div className="sm:col-span-2"><p>{t("Previously published fields")}</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(previous.published.details, null, 2)}</pre></div>}
    </div></details> : <p className="my-2 text-sm">{t("No earlier matching record in the last 30 batches.")}</p>}
    {row.published && <pre className="my-3 overflow-auto text-xs">{JSON.stringify(row.published.details, null, 2)}</pre>}
    {row.status === "NEEDS_REVIEW" && view.batch.status !== "INCOMPLETE" && <form className="mt-3 space-y-2" onSubmit={e => {
      e.preventDefault(); try { const parsed: unknown = JSON.parse(offer); setInvalid(false); onReview({ version: view.version, index, reject: false, reason, offer: parsed }); } catch { setInvalid(true); }
    }}>
      <label className="block">{t("Verified offer JSON")}<textarea className="mt-1 min-h-40 w-full rounded border p-2 font-mono text-xs" value={offer} maxLength={20000} onChange={e => setOffer(e.target.value)} /></label>
      <label className="block">{t("Review note")}<input className="ml-2 rounded border p-2" value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /></label>
      {invalid && <p role="alert">{t("Invalid JSON")}</p>}
      <div className="flex gap-2"><button className="rounded border px-3 py-2" disabled={busy || !offer}>{t("Publish verified offer")}</button>
        <button type="button" className="rounded border px-3 py-2" disabled={busy} onClick={() => onReview({ version: view.version, index, reject: true, reason })}>{t("Reject candidate")}</button></div>
    </form>}
  </details>;
}
export default function OfferImportAdmin() {
  const { t } = useLanguage(); const [opened, setOpened] = useState(false);
  const [imports, setImports] = useState<ImportView[]>([]); const [offers, setOffers] = useState<(CatalogOffer & { active: boolean })[]>([]);
  const [runs, setRuns] = useState<{ id: string; fetchedAt: string; status: string; candidates: number }[]>([]);
  const [raw, setRaw] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const load = async () => { const [batches, prices, history] = await Promise.all([apiClient<ImportView[]>("admin/offer-imports"), apiClient<(CatalogOffer & { active: boolean })[]>("admin/store-offers"), apiClient<typeof runs>("admin/offer-imports/source-runs")]); setRuns(history); setImports(batches); setOffers(prices); };
  const run = async (operation: () => Promise<unknown>) => { if (busy) return; setBusy(true); setError(""); try { await operation(); await load(); } catch { setError(t("Import or review failed. Check the data and reload before retrying.")); } finally { setBusy(false); } };
  return <section className="mb-8 rounded-2xl border border-primary/15 p-4">
    <h2 className="text-xl font-bold">{t("Offer imports and review")}</h2>
    <p className="my-2 text-sm">{t("No automatic source is approved. Import candidates, verify source fields, and publish each record separately.")}</p>
    <button className="rounded border px-3 py-2" disabled={busy} onClick={() => { setOpened(true); void run(async () => {}); }}>{t("Load imports and offers")}</button>
    {opened && <>
      <button className="ml-3 rounded border px-3 py-2" disabled={busy} onClick={() => void run(() => apiClient("admin/offer-imports/capture-lidl-review", true, {}))}>{t("Capture Lidl sample for review")}</button>
      <ul className="my-3 text-sm">{runs.map(run => <li key={run.id}>{run.fetchedAt} · {run.status} · {run.candidates}</li>)}</ul>
      <form className="my-4" onSubmit={e => { e.preventDefault(); void run(async () => { const parsed: unknown = JSON.parse(raw); return apiClient("admin/offer-imports", true, parsed); }); }}>
        <label className="block">{t("Import batch JSON")}<textarea className="mt-2 min-h-36 w-full rounded border p-2 font-mono text-xs" value={raw} maxLength={2000000} onChange={e => setRaw(e.target.value)} /></label>
        <button className="mt-2 rounded border px-3 py-2" disabled={busy || !raw}>{t("Import for review")}</button>
      </form>
      <div className="space-y-4">{imports.map(view => <details key={view.batch.id} className="rounded border p-3">
        <summary>{view.batch.input.store} · {view.batch.importedAt} · {view.batch.status} · {view.batch.rows.length}/{view.batch.input.expectedCount}</summary>
        <p className="my-2 text-sm">{view.batch.input.adapter} · {t("Fetched")}: {view.batch.input.fetchedAt} · {t("Source updated")}: {view.batch.input.sourceUpdatedAt ?? "?"}</p>
        <div className="space-y-2">{view.batch.rows.map((_, i) => <ReviewRow key={`${view.version}:${i}`} view={view} index={i} busy={busy} previous={imports.filter(previous => previous.batch.id !== view.batch.id && previous.batch.input.store === view.batch.input.store && Date.parse(previous.batch.importedAt) < Date.parse(view.batch.importedAt)).flatMap(previous => previous.batch.rows).find(previous => previous.source.sourceProductId === view.batch.rows[i].source.sourceProductId)} onReview={body => void run(() => apiClient(`admin/offer-imports/${view.batch.id}/review`, true, body))} />)}</div>
      </details>)}</div>
      <ul className="mt-5 space-y-2">{offers.map(offer => <li key={offer.id} className="flex flex-wrap items-center gap-3"><span>{offer.details.store} · {offer.details.productName} · {offer.details.verifiedAt}</span><button className="rounded border px-3 py-2" disabled={busy || !offer.active} onClick={() => void run(() => apiClient(`admin/store-offers/${offer.id}/withdraw`, true, { version: offer.version }))}>{t("Withdraw offer")}</button></li>)}</ul>
    </>}
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
  </section>;
}
