import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import type { AudioFormat } from "@shared/types";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Segmented } from "./Controls";
import { CloseIcon } from "./Icons";

const EASE = [0.22, 1, 0.36, 1] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-6 first:border-t-0 first:pt-2">
      <h3 className="mb-4 text-sm font-medium text-muted">{title}</h3>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[0.95rem] font-medium">{label}</p>
      {children}
      {hint && <p className="mt-2 text-sm text-muted">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-line bg-transparent px-3 py-2 text-ink outline-none transition-colors placeholder:text-faint focus:border-accent";
const ghostBtn = "rounded-full border border-line px-4 py-1.5 text-sm font-medium transition-colors hover:border-faint disabled:opacity-50";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { settings, saveSettings, info, refreshInfo, update } = useStore();
  const [engine, setEngine] = useState<{ busy: boolean; msg?: string }>({ busy: false });
  const [appMsg, setAppMsg] = useState<string | null>(null);
  const [id, setId] = useState(settings.spotifyClientId ?? "");
  const [secret, setSecret] = useState(settings.spotifyClientSecret ?? "");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const customKeys = Boolean(settings.spotifyClientId && settings.spotifyClientSecret);

  const saveKeys = async () => {
    const a = id.trim();
    const b = secret.trim();
    await saveSettings({ spotifyClientId: a && b ? a : undefined, spotifyClientSecret: a && b ? b : undefined });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px]"
          />
          <motion.aside
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t("set.title")}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 34 }}
            className="scroll-soft fixed inset-y-0 right-0 z-40 flex w-[min(30rem,100vw)] flex-col overflow-y-auto border-l border-line bg-bg shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between bg-bg/90 px-7 pt-[4.2rem] pb-4 backdrop-blur">
              <h2 className="text-2xl font-semibold tracking-tight">{t("set.title")}</h2>
              <button type="button" onClick={onClose} aria-label={t("set.close")} className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-line/60 hover:text-ink">
                <CloseIcon className="size-5" />
              </button>
            </div>

            <div className="px-7 pb-10">
              <Section title={t("set.saveTo")}>
                <div>
                  <p className="selectable break-all rounded-lg border border-line px-3 py-2 text-[0.95rem]">{settings.outputDir}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className={ghostBtn}
                      onClick={async () => {
                        const dir = await window.atrapo.chooseFolder();
                        if (dir) await saveSettings({ outputDir: dir });
                      }}
                    >
                      {t("set.change")}
                    </button>
                    <button type="button" className={ghostBtn} onClick={() => void window.atrapo.openFolder()}>
                      {t("set.open")}
                    </button>
                  </div>
                </div>
                <Field label={t("set.collections")} hint={t("set.collectionsHint")}>
                  <Segmented<"zip" | "folder">
                    label={t("set.collections")}
                    value={settings.collectionsAs}
                    onChange={(v) => void saveSettings({ collectionsAs: v })}
                    items={[
                      { value: "zip", label: t("set.asZip") },
                      { value: "folder", label: t("set.asFolder") },
                    ]}
                  />
                </Field>
              </Section>

              <Section title={t("set.spotify")}>
                <Field label={t("set.spotifyFormat")}>
                  <Segmented<AudioFormat>
                    label={t("set.spotifyFormat")}
                    value={settings.spotifyFormat}
                    onChange={(v) => void saveSettings({ spotifyFormat: v })}
                    items={[
                      { value: "mp3", label: "MP3 320" },
                      { value: "m4a", label: "M4A" },
                      { value: "opus", label: "Opus" },
                      { value: "flac", label: "FLAC" },
                      { value: "original", label: t("opt.original") },
                    ]}
                  />
                </Field>
                <Field label={t("set.spotifyKeys")} hint={t("set.spotifyKeysHint")}>
                  <div className="space-y-2">
                    <input className={inputCls} placeholder={t("set.clientId")} value={id} onChange={(e) => setId(e.target.value)} onBlur={saveKeys} spellCheck={false} autoComplete="off" />
                    <input className={inputCls} placeholder={t("set.clientSecret")} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} onBlur={saveKeys} spellCheck={false} autoComplete="off" />
                  </div>
                  <p className="mt-2 text-sm text-muted">{customKeys ? t("set.keysCustom") : info?.spotifyApi ? t("set.keysBundled") : ""}</p>
                </Field>
              </Section>

              <Section title={t("set.look")}>
                <Field label={t("set.language")}>
                  <Segmented<"auto" | "es" | "en">
                    label={t("set.language")}
                    value={settings.language}
                    onChange={(v) => void saveSettings({ language: v })}
                    items={[
                      { value: "auto", label: t("set.auto") },
                      { value: "es", label: "Español" },
                      { value: "en", label: "English" },
                    ]}
                  />
                </Field>
                <Field label={t("set.theme")}>
                  <Segmented<"system" | "light" | "dark">
                    label={t("set.theme")}
                    value={settings.theme}
                    onChange={(v) => void saveSettings({ theme: v })}
                    items={[
                      { value: "system", label: t("set.themeSystem") },
                      { value: "light", label: t("set.themeLight") },
                      { value: "dark", label: t("set.themeDark") },
                    ]}
                  />
                </Field>
              </Section>

              <Section title={t("set.maintenance")}>
                <Field label={t("set.ytdlp", { v: info?.ytdlpVersion ?? "" })} hint={engine.msg ?? t("set.ytdlpHint")}>
                  <button
                    type="button"
                    className={ghostBtn}
                    disabled={engine.busy}
                    onClick={async () => {
                      setEngine({ busy: true });
                      const msg = await window.atrapo.updateYtdlp().catch((e: Error) => e.message);
                      await refreshInfo();
                      setEngine({ busy: false, msg });
                    }}
                  >
                    {engine.busy ? t("set.ytdlpWorking") : t("set.ytdlpUpdate")}
                  </button>
                </Field>
              </Section>

              <Section title={t("set.about")}>
                <div>
                  <p className="font-medium">{t("set.version", { v: info?.version ?? "" })}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className={ghostBtn}
                      onClick={async () => {
                        const u = await window.atrapo.checkAppUpdate();
                        if (u.available && u.url) void window.atrapo.openExternal(u.url);
                        else setAppMsg(t("set.upToDate"));
                      }}
                    >
                      {t("set.checkUpdate")}
                    </button>
                    {appMsg && !update?.available && <span className="text-sm text-muted">{appMsg}</span>}
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted">{t("set.disclaimer")}</p>
              </Section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
