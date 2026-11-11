import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// Ordinary disclosure buttons support touch, Enter/Space, Tab and Escape.
export default function PlannerMenu({ label, children, disabled = false }: {
  label: string; children: ReactNode; disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  return <div ref={ref} className="relative shrink-0" onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
    }
  }} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" aria-label={label} aria-expanded={open} aria-controls={id} disabled={disabled} onClick={() => setOpen(current => !current)}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-primary/15 text-xl hover:bg-primary/5 disabled:opacity-40">⋯</button>
    <div id={id} hidden={!open} className="absolute right-0 z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-primary/15 bg-white p-2 shadow-lg"
      onClick={event => {
        if (event.target instanceof Element && event.target.closest("button:not([data-keep-open])")) {
          // A dialog restores focus to this trigger after the chosen action.
          trigger.current?.focus(); setOpen(false);
        }
      }}>{children}</div>
  </div>;
}
