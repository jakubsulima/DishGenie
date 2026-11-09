import { useEffect, useId, useRef, type ReactNode } from "react";
import { useLanguage } from "../context/languageContext";

// Keep children mounted when closed: recipe and price drafts survive view changes.
export default function PlannerDialog({ open, title, onClose, children }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => { dialog.close(); if (trigger?.isConnected) trigger.focus(); };
  }, [open]);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl bg-white p-5 text-primary shadow-xl backdrop:bg-black/35 sm:p-7">
    <div className="mb-5 flex items-start justify-between gap-4">
      <h2 id={titleId} className="min-w-0 break-words text-xl font-bold">{title}</h2>
      <button type="button" autoFocus onClick={onClose} aria-label={t("Close")} className="min-h-11 min-w-11 shrink-0 rounded-lg border border-primary/20">×</button>
    </div>
    {children}
  </dialog>;
}
