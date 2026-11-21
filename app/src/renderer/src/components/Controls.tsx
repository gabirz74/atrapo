import { motion } from "motion/react";
import { useId, type ReactNode } from "react";

export interface Choice<T extends string> {
  value: T;
  label: ReactNode;
}

/** Pill group with a highlight that slides between choices. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  items: Choice<T>[];
}) {
  const group = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(it.value)}
            className={`relative rounded-full border px-4 py-2 text-[0.95rem] font-medium transition-colors ${
              active ? "border-transparent text-bg" : "border-line text-muted hover:border-faint hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId={group}
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid gap-2.5 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6">
      <div className="pt-2 text-sm text-muted">{label}</div>
      <div>
        {children}
        {hint && <p className="mt-2.5 max-w-xl text-sm text-muted">{hint}</p>}
      </div>
    </div>
  );
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5 text-[0.95rem]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="grid size-5 place-items-center rounded-md border border-faint text-transparent transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      </span>
      {children}
    </label>
  );
}
