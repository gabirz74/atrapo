import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { Options, Preview } from "@shared/types";
import { useI18n } from "@/lib/i18n";
import { Check, Row, Segmented } from "./Controls";

type Mode = "video" | "audio";

const FALLBACK_HEIGHTS = [2160, 1440, 1080, 720, 480, 360];

export function OptionsPanel({
  preview,
  source,
  mode,
  setMode,
  opts,
  setOpts,
}: {
  preview: Preview | null;
  source: string;
  mode: Mode;
  setMode: (m: Mode) => void;
  opts: Options;
  setOpts: (o: Options) => void;
}) {
  const { t } = useI18n();
  const [more, setMore] = useState(false);
  const modes = preview?.modes ?? ["video", "audio"];
  const set = (patch: Partial<Options>) => setOpts({ ...opts, ...patch });

  if (source === "pinterest") {
    return <p className="mt-8 max-w-xl text-muted">{t("opt.pinterestHint")}</p>;
  }

  const heights = (preview?.video?.heights ?? FALLBACK_HEIGHTS).filter((h, i, a) => a.indexOf(h) === i).slice(0, 7);
  const audioInfo = preview?.audio?.abr
    ? `${preview.audio.ext.toUpperCase()}, ${preview.audio.abr} kbps`
    : preview?.audio?.ext
      ? preview.audio.ext.toUpperCase()
      : "";
  const showExtras = source !== "spotify";

  return (
    <div className="mt-8 divide-y divide-line border-y border-line">
      {modes.length > 1 && (
        <Row label="">
          <Segmented<Mode>
            label="Modo"
            value={mode}
            onChange={setMode}
            items={[
              { value: "video", label: t("opt.video") },
              { value: "audio", label: t("opt.audio") },
            ]}
          />
        </Row>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {mode === "video" && source !== "spotify" ? (
          <motion.div key="video" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <Row label={t("opt.quality")}>
              <Segmented<string>
                label={t("opt.quality")}
                value={opts.height ? String(opts.height) : "best"}
                onChange={(v) => set({ height: v === "best" ? undefined : Number(v) })}
                items={[
                  { value: "best", label: t("opt.best") },
                  ...heights.map((h) => ({ value: String(h), label: h >= 2160 ? "4K" : `${h}p` })),
                ]}
              />
            </Row>
            <Row label={t("opt.container")} hint={opts.container === "mp4" ? t("opt.mp4Hint") : undefined}>
              <Segmented<Options["container"]>
                label={t("opt.container")}
                value={opts.container}
                onChange={(v) => set({ container: v })}
                items={[
                  { value: "mp4", label: "MP4" },
                  { value: "mkv", label: "MKV" },
                  { value: "webm", label: "WebM" },
                ]}
              />
            </Row>
          </motion.div>
        ) : (
          <motion.div key="audio" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <Row
              label={t("opt.format")}
              hint={
                source === "spotify"
                  ? t("opt.spotifyHint")
                  : opts.audioFormat === "original" && audioInfo
                    ? t("opt.originalHint", { fmt: audioInfo })
                    : opts.audioFormat === "flac" || opts.audioFormat === "wav"
                      ? t("opt.losslessHint")
                      : opts.audioFormat === "mp3"
                        ? t("opt.mp3Hint")
                        : undefined
              }
            >
              <Segmented<Options["audioFormat"]>
                label={t("opt.format")}
                value={opts.audioFormat}
                onChange={(v) => set({ audioFormat: v })}
                items={[
                  { value: "original", label: t("opt.original") },
                  { value: "mp3", label: "MP3 320" },
                  { value: "m4a", label: "M4A" },
                  { value: "opus", label: "Opus" },
                  { value: "flac", label: "FLAC" },
                  { value: "wav", label: "WAV" },
                ]}
              />
            </Row>
          </motion.div>
        )}
      </AnimatePresence>

      {showExtras && (
        <div className="py-4">
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            aria-expanded={more}
            className="flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <motion.svg animate={{ rotate: more ? 90 : 0 }} viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 3 5 5-5 5" />
            </motion.svg>
            {more ? t("opt.less") : t("opt.more")}
          </button>
          <AnimatePresence initial={false}>
            {more && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="grid gap-x-10 gap-y-1 pt-4 sm:grid-cols-2">
                  <div>
                    {mode === "video" && <Check checked={opts.subtitles} onChange={(v) => set({ subtitles: v })}>{t("opt.subtitles")}</Check>}
                    <Check checked={opts.thumbnail} onChange={(v) => set({ thumbnail: v })}>{t("opt.thumbnail")}</Check>
                    <Check checked={opts.chapters} onChange={(v) => set({ chapters: v })}>{t("opt.chapters")}</Check>
                  </div>
                  <div>
                    <p className="mb-2 text-sm text-muted">{t("opt.trimHint")}</p>
                    <div className="flex gap-3">
                      {(["trimStart", "trimEnd"] as const).map((k) => (
                        <label key={k} className="flex flex-1 flex-col gap-1 text-sm text-muted">
                          {k === "trimStart" ? t("opt.trimFrom") : t("opt.trimTo")}
                          <input
                            inputMode="numeric"
                            placeholder={k === "trimStart" ? "0:00" : "3:20"}
                            value={opts[k] ?? ""}
                            onChange={(e) => set({ [k]: e.target.value || undefined })}
                            className="w-full rounded-lg border border-line bg-transparent px-3 py-2 text-ink outline-none transition-colors focus:border-accent"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
