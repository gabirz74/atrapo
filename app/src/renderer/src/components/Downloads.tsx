import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { JobState } from "@shared/types";
import { useI18n, type Key } from "@/lib/i18n";
import { formatSize, labelOf } from "@/lib/sources";
import { useStore } from "@/lib/store";
import { ChevronIcon, CloseIcon } from "./Icons";

const EASE = [0.22, 1, 0.36, 1] as const;
const ACTIVE = ["queued", "preparing", "running", "zipping"];

export function Downloads() {
  const { t } = useI18n();
  const { jobs, refreshJobs } = useStore();
  if (!jobs.length) return null;
  const hasFinished = jobs.some((j) => !ACTIVE.includes(j.status));

  return (
    <section className="mx-auto mt-10 w-full max-w-5xl px-6 pb-20 sm:px-10" aria-label={t("dl.title")}>
      <div className="mb-2 flex items-center justify-between text-sm text-muted">
        <h2 className="font-medium text-ink">{t("dl.title")}</h2>
        {hasFinished && (
          <button
            type="button"
            onClick={async () => {
              await window.atrapo.clearHistory();
              await refreshJobs();
            }}
            className="transition-colors hover:text-ink"
          >
            {t("dl.clear")}
          </button>
        )}
      </div>
      <ul className="divide-y divide-line border-y border-line">
        <AnimatePresence initial={false}>
          {jobs.map((j) => (
            <JobRow key={j.id} job={j} />
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

function Ring({ value, running }: { value: number; running: boolean }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 28 28" className="size-7 -rotate-90" aria-hidden="true">
      <circle cx="14" cy="14" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
      <motion.circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        animate={{ strokeDashoffset: c * (1 - Math.max(0.04, value / 100)) }}
        transition={{ type: "spring", stiffness: 70, damping: 20 }}
        className={running ? "" : "opacity-60"}
      />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 28 28" className="size-7 text-ok" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.circle cx="14" cy="14" r="11" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.55, ease: EASE }} />
      <motion.path d="m9 14.5 3.6 3.6L19 11" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.4, ease: "easeOut" }} />
    </svg>
  );
}

function Warn() {
  return (
    <svg viewBox="0 0 28 28" className="size-7 text-danger" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="14" cy="14" r="11" />
      <path d="M14 8.5v6.5M14 19.2v.1" />
    </svg>
  );
}

function JobRow({ job }: { job: JobState }) {
  const { t } = useI18n();
  const { refreshJobs } = useStore();
  const [open, setOpen] = useState(false);
  const active = ACTIVE.includes(job.status);
  const done = job.status === "done";
  const failed = job.status === "error";
  const many = job.items.length > 1;
  const finishedItems = job.items.filter((i) => i.status === "done" || i.status === "failed").length;

  let sub: string;
  if (done && job.result) {
    const parts = [job.result.name, formatSize(job.result.size)];
    sub = parts.join(" · ");
  } else if (failed) sub = job.message;
  else if (job.status === "zipping") sub = t("job.zipping");
  else if (job.status === "queued" || job.status === "preparing") sub = job.message || t("job.preparing");
  else sub = many ? `${t("job.running")} · ${finishedItems}/${job.items.length}` : `${t("job.running")} · ${job.progress}%`;

  const remove = async () => {
    await window.atrapo.removeJob(job.id);
    await refreshJobs();
  };
  const cancel = async () => {
    await window.atrapo.cancelJob(job.id);
    await refreshJobs();
  };

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-4 py-3.5">
        <div className="grid size-7 shrink-0 place-items-center">{done ? <Check /> : failed ? <Warn /> : <Ring value={job.progress} running={active} />}</div>
        <div className="min-w-0 flex-1">
          <p className="selectable truncate text-[1.02rem] font-medium leading-snug" title={job.title}>
            {job.title}
          </p>
          <p className={`selectable truncate text-sm ${failed ? "text-danger" : "text-muted"}`} title={sub}>
            <span className="mr-2">{job.source === "mixed" ? "" : labelOf(job.source)}</span>
            {sub}
          </p>
        </div>
        {many && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t("dl.hide") : t("dl.details")}
            title={open ? t("dl.hide") : t("dl.details")}
            className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-line/60 hover:text-ink"
          >
            <ChevronIcon className={`size-4 transition-transform duration-300 ${open ? "rotate-90" : ""}`} />
          </button>
        )}
        {done && (
          <button
            type="button"
            onClick={() => void window.atrapo.reveal(job.id)}
            className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink transition-transform active:scale-95"
          >
            {t("act.show")}
          </button>
        )}
        {active ? (
          <button type="button" onClick={cancel} className="shrink-0 rounded-full border border-line px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:border-faint hover:text-ink">
            {t("act.cancel")}
          </button>
        ) : (
          <button type="button" onClick={remove} aria-label={t("act.remove")} title={t("act.remove")} className="grid size-8 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-line/60 hover:text-ink">
            <CloseIcon className="size-4" />
          </button>
        )}
      </div>

      {done && job.failed.length > 0 && <p className="-mt-1.5 pb-3 pl-11 text-sm text-danger">{t("dl.failedSome", { n: job.failed.length })}</p>}

      <AnimatePresence initial={false}>
        {open && many && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="scroll-soft selectable mb-3 ml-11 max-h-64 divide-y divide-line overflow-auto border-y border-line text-[0.92rem]"
          >
            {job.items.map((it, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-4 py-2">
                <span className={`truncate ${it.status === "failed" ? "text-danger" : ""}`} title={it.error ?? it.title}>
                  {it.title}
                </span>
                <span className={`text-sm tabular-nums ${it.status === "done" ? "text-ok" : it.status === "failed" ? "text-danger" : "text-muted"}`}>
                  {t(`status.${it.status}` as Key)}
                  {it.status === "downloading" ? ` ${it.progress}%` : ""}
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
