import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Options, Preview } from "@shared/types";
import { useI18n } from "@/lib/i18n";
import { SOURCES, detectSource, extractUrls, formatDuration } from "@/lib/sources";
import { useStore } from "@/lib/store";
import { OptionsPanel } from "./OptionsPanel";

type Phase = "idle" | "reading" | "ready" | "error";
type Mode = "video" | "audio";

const DEFAULTS: Options = { mode: "auto", container: "mp4", audioFormat: "original", subtitles: false, thumbnail: false, chapters: false };
const EASE = [0.22, 1, 0.36, 1] as const;
const TIME = /^\d{1,2}(:\d{2}){0,2}(\.\d+)?$/;

const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "");

export function Composer({ hasJobs }: { hasJobs: boolean }) {
  const { t } = useI18n();
  const { settings, refreshJobs } = useStore();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("video");
  const [opts, setOpts] = useState<Options>(DEFAULTS);
  const [clip, setClip] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const busy = useRef(false);
  const lastClip = useRef("");
  const tRef = useRef(t);
  const spotifyFormat = useRef(settings.spotifyFormat);
  useEffect(() => {
    tRef.current = t;
    spotifyFormat.current = settings.spotifyFormat;
  }, [t, settings.spotifyFormat]);

  const urls = useMemo(() => extractUrls(text), [text]);
  const urlsKey = urls.join("\n");
  const source = detectSource(urls[0]);
  const compact = phase !== "idle" || text.length > 0 || hasJobs;
  const batch = urls.length > 1;

  // Grow the textarea with its content (the font size animates, so re-measure for a moment).
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    };
    fit();
    const timers = [60, 160, 320, 560, 800].map((ms) => setTimeout(fit, ms));
    window.addEventListener("resize", fit);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", fit);
    };
  }, [text, compact]);

  // Look the link up as soon as it stops changing.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setPreview(null);
    setError(null);
    if (!urls.length) return setPhase("idle");
    if (urls.some((u) => !detectSource(u))) {
      setPhase("error");
      setError(tRef.current("state.unsupported"));
      return;
    }
    if (urls.length > 1) {
      setMode("video");
      setOpts({ ...DEFAULTS, audioFormat: "original" });
      return setPhase("ready");
    }
    let cancelled = false;
    setPhase("reading");
    const id = setTimeout(async () => {
      try {
        const p = await window.atrapo.inspect(urls[0]!);
        if (cancelled) return;
        setPreview(p);
        setMode(p.modes.includes("video") ? "video" : "audio");
        setOpts({ ...DEFAULTS, audioFormat: p.source === "spotify" ? spotifyFormat.current : "original" });
        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setError(e instanceof Error && e.message ? e.message : tRef.current("err.generic"));
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
      void window.atrapo.cancelInspect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const reset = useCallback(() => {
    busy.current = false;
    setText("");
    setPreview(null);
    setError(null);
    setPhase("idle");
    area.current?.focus();
  }, []);

  // Offer the link that's on the clipboard when the window comes back to the front.
  useEffect(() => {
    const check = async () => {
      try {
        const c = (await window.atrapo.readClipboard()).trim();
        if (c && c !== lastClip.current && c.length < 2048 && !/\s/.test(c) && detectSource(c)) setClip(c);
        else if (!c || c === lastClip.current) setClip(null);
      } catch {
        /* clipboard unavailable */
      }
    };
    void check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, []);

  const fill = useCallback((value: string) => {
    lastClip.current = value.trim();
    setClip(null);
    setText(value.trim());
    area.current?.focus();
  }, []);

  // Paste anywhere and drop a link on the window.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      const v = e.clipboardData?.getData("text");
      if (v?.trim()) fill(v);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const v = e.dataTransfer?.getData("text/uri-list") || e.dataTransfer?.getData("text/plain");
      if (v?.trim()) fill(v.split("\n")[0]!);
    };
    const onOver = (e: DragEvent) => e.preventDefault();
    document.addEventListener("paste", onPaste);
    document.addEventListener("drop", onDrop);
    document.addEventListener("dragover", onOver);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("drop", onDrop);
      document.removeEventListener("dragover", onOver);
    };
  }, [fill]);

  const buildOptions = (): Options => {
    const o: Options = { ...opts, mode };
    if (mode !== "video") o.height = undefined;
    if (o.trimStart && !TIME.test(o.trimStart)) o.trimStart = undefined;
    if (o.trimEnd && !TIME.test(o.trimEnd)) o.trimEnd = undefined;
    return o;
  };

  const start = async () => {
    if (phase !== "ready" || busy.current) return;
    busy.current = true;
    try {
      await window.atrapo.startJob(urls, buildOptions(), preview?.title ?? shortUrl(urls[0]!));
      lastClip.current = urls[0]!;
      await refreshJobs();
      reset();
    } catch (e) {
      busy.current = false;
      setPhase("error");
      setError(e instanceof Error && e.message ? e.message : t("err.generic"));
    }
  };

  const pasteFromClipboard = async () => {
    const clipText = (await window.atrapo.readClipboard()).trim();
    if (clipText) fill(clipText);
  };

  const primaryLabel = preview && preview.count > 1 && !batch ? t(preview.source === "spotify" ? "act.downloadTracks" : preview.source === "pinterest" ? "act.downloadFiles" : "act.downloadMany", { n: Math.min(preview.count, preview.limit) }) : batch ? t("act.downloadMany", { n: urls.length }) : t("act.download");
  const showForm = phase === "ready";
  const statusText = phase === "reading" ? (source === "spotify" && /playlist/.test(urls[0] ?? "") ? t("state.readingList") : t("state.reading")) : batch && phase === "ready" ? t("state.batch", { n: urls.length }) : null;

  return (
    <MotionConfig reducedMotion="user">
      <section className="mx-auto w-full max-w-5xl px-6 sm:px-10">
        <h1 className="sr-only">{t("hero.title")}</h1>

        <div className={`transition-[padding] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${compact ? "pt-2" : "pt-[clamp(2rem,9vh,5.5rem)]"}`}>
          <label htmlFor="link" className="sr-only">
            {t("field.label")}
          </label>
          <div className="relative overflow-hidden pb-[0.12em]">
            {!text && (
              <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden text-faint field ${compact ? "field-sm" : "field-lg"}`}>
                <motion.span initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.1 }} className="block">
                  {t("field.placeholder")}
                </motion.span>
              </div>
            )}
            <textarea
              id="link"
              ref={area}
              rows={1}
              autoFocus
              value={text}
              onChange={(e) => {
                busy.current = false;
                setText(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void start();
                }
              }}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              className={`field relative ${compact ? "field-sm" : "field-lg"}`}
            />
          </div>
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.1, ease: EASE, delay: 0.3 }} className="h-[2px] origin-left bg-ink" />

          <div className="mt-3 flex min-h-9 items-center justify-between gap-4 text-sm">
            <p role={error ? "alert" : "status"} className={`selectable min-w-0 ${error ? "text-danger" : "text-muted"}`}>
              {error ?? statusText}
            </p>
            {text ? (
              <button type="button" onClick={reset} className="shrink-0 rounded-full px-3 py-1.5 font-medium text-muted transition-colors hover:text-ink">
                {t("field.clear")}
              </button>
            ) : (
              <button type="button" onClick={pasteFromClipboard} className="shrink-0 rounded-full border border-line px-4 py-1.5 font-medium text-ink transition-colors hover:border-faint">
                {t("field.paste")}
              </button>
            )}
          </div>

          <AnimatePresence>
            {clip && !text && (
              <motion.button
                key="clip"
                type="button"
                onClick={() => fill(clip)}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="mt-1 flex max-w-full items-center gap-2 rounded-full bg-accent/10 py-1.5 pr-4 pl-1.5 text-sm text-ink transition-colors hover:bg-accent/15"
              >
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-ink">{t("field.copied")}</span>
                <span className="truncate text-muted">{shortUrl(clip)}</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {phase === "idle" && !hasJobs && (
            <motion.div key="idle" exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
              <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.8 }} className="mt-5 max-w-xl text-lg text-muted">
                {t("hero.tagline")}
              </motion.p>
              <motion.div initial="hide" animate="show" variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 1 } } }} className="mt-10">
                <p className="mb-3 text-sm text-muted">{t("field.works")}</p>
                <ul className="flex flex-wrap gap-x-6 gap-y-1.5 text-lg font-medium">
                  {SOURCES.slice(0, 9).map((s) => (
                    <motion.li key={s.id} variants={{ hide: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="text-ink">
                      {s.label}
                    </motion.li>
                  ))}
                  <motion.li variants={{ hide: { opacity: 0 }, show: { opacity: 1 } }} className="text-muted">
                    {t("field.more")}
                  </motion.li>
                </ul>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === "reading" && !batch && <PreviewSkeleton />}

        <AnimatePresence>{preview && phase !== "reading" && <PreviewBlock key={preview.url} preview={preview} />}</AnimatePresence>

        <AnimatePresence>
          {showForm && (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}>
              {batch && (
                <ul className="mt-8 divide-y divide-line border-y border-line text-[0.95rem]">
                  {urls.map((u) => (
                    <li key={u} className="flex justify-between gap-4 py-2.5">
                      <span className="truncate">{shortUrl(u)}</span>
                      <span className="shrink-0 text-muted">{SOURCES.find((s) => s.id === detectSource(u))?.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              <OptionsPanel preview={preview} source={source ?? ""} mode={mode} setMode={setMode} opts={opts} setOpts={setOpts} />
              <div className="sticky bottom-0 z-10 -mx-6 mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 bg-gradient-to-t from-bg from-70% to-transparent px-6 pt-6 pb-5 sm:-mx-10 sm:px-10">
                <motion.button
                  type="button"
                  onClick={start}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="rounded-full bg-accent px-8 py-4 text-lg font-semibold text-accent-ink"
                >
                  {primaryLabel}
                </motion.button>
                <p className="text-sm text-muted">{t("legal.note")}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </MotionConfig>
  );
}

function PreviewSkeleton() {
  return (
    <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,20rem)_1fr]" aria-hidden="true">
      <div className="skeleton aspect-video w-full rounded-2xl" />
      <div className="space-y-4 pt-1">
        <div className="skeleton h-9 w-3/4 rounded-lg" />
        <div className="skeleton h-5 w-1/3 rounded-lg" />
        <div className="skeleton h-5 w-1/2 rounded-lg" />
      </div>
    </div>
  );
}

function PreviewBlock({ preview }: { preview: Preview }) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState(false);
  const square = preview.source === "spotify" || preview.source === "pinterest";
  const isPins = preview.source === "pinterest";
  const meta: string[] = [];
  if (preview.uploader) meta.push(preview.uploader);
  if (preview.count > 1) meta.push(isPins ? t("meta.files", { n: preview.count }) : preview.source === "spotify" ? t("meta.tracks", { n: preview.count }) : t("meta.items", { n: preview.count }));
  else if (preview.duration) meta.push(formatDuration(preview.duration));
  const shown = preview.entries.slice(0, 6);
  const rest = preview.count - shown.length;

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
      transition={{ type: "spring", stiffness: 130, damping: 20 }}
      className="mt-8 grid gap-8 md:grid-cols-[minmax(0,20rem)_1fr]"
    >
      <div className={`relative w-full overflow-hidden rounded-2xl bg-line ${square ? "aspect-square max-w-[20rem]" : "aspect-video"}`}>
        {preview.thumbnail && (
          <motion.img
            src={preview.thumbnail}
            alt=""
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            initial={false}
            animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 1.04 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="absolute inset-0 size-full object-cover"
          />
        )}
      </div>
      <div className="selectable min-w-0">
        <h2 className="text-3xl font-semibold leading-[1.1] tracking-[-0.03em] sm:text-4xl">{preview.title}</h2>
        {meta.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-x-5 text-muted">
            {meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </p>
        )}
        {preview.count > preview.limit && <p className="mt-2 text-sm text-muted">{t("meta.cap", { n: preview.limit })}</p>}
        {preview.count > 1 && !isPins && (
          <>
            <ol className="mt-6 divide-y divide-line border-y border-line text-[0.95rem]">
              {shown.map((e, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 py-2.5">
                  <span className="min-w-0 truncate">
                    {e.title}
                    {e.uploader && <span className="ml-3 text-muted">{e.uploader}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">{formatDuration(e.duration)}</span>
                </li>
              ))}
            </ol>
            {rest > 0 && <p className="mt-2 text-sm text-muted">{t("meta.moreTracks", { n: rest })}</p>}
          </>
        )}
        {isPins && (
          <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {shown.map((e, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-line">
                {e.thumbnail && /\.(jpe?g|png|webp)(\?|$)/i.test(e.thumbnail) && <img src={e.thumbnail} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-full object-cover" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}
