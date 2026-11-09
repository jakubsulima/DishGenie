import { useId, useState, type ReactNode } from "react";

/** A disclosure keeps its contents mounted, including unfinished price forms. */
export default function PlannerDisclosure({ title, children, defaultOpen = false, onOpen, className = "" }: {
  title: string; children: ReactNode; defaultOpen?: boolean; onOpen?: () => void; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  return <div className={className}>
    <button type="button" aria-expanded={open} aria-controls={contentId}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left text-sm font-semibold hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2"
      onClick={() => { if (!open) onOpen?.(); setOpen(current => !current); }}>
      <span className="min-w-0">{title}</span>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={`h-5 w-5 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}>
        <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
    <div id={contentId} hidden={!open}>{children}</div>
  </div>;
}
