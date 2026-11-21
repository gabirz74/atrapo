import { motion } from "motion/react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Composer } from "./Composer";
import { Downloads } from "./Downloads";
import { FolderIcon, GearIcon, MarkIcon } from "./Icons";
import { SettingsSheet } from "./SettingsSheet";

export function App() {
  const { t } = useI18n();
  const { jobs, update, ready } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Leave room for the native window buttons: the traffic lights on macOS, the caption buttons on Windows.
  const isMac = /Mac/i.test(navigator.platform);
  const isWin = /Win/i.test(navigator.platform);

  return (
    <div className="flex h-full flex-col">
      <header className={`drag relative z-20 flex h-14 shrink-0 items-center justify-between ${isMac ? "pl-[5.5rem]" : "pl-6"} ${isWin ? "pr-[9.5rem]" : "pr-5"}`}>
        <div className="flex items-center gap-2.5">
          <MarkIcon className="size-[1.35rem]" />
          <span className="text-[1.05rem] font-semibold tracking-[-0.03em]">Atrapo</span>
        </div>
        <div className="no-drag flex items-center gap-1.5">
          {update?.available && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => update.url && void window.atrapo.openExternal(update.url)}
              className="mr-2 rounded-full bg-accent px-3.5 py-1 text-sm font-semibold text-accent-ink transition-transform active:scale-95"
            >
              {t("app.update", { v: update.version ?? "" })} · {t("app.updateAction")}
            </motion.button>
          )}
          <button
            type="button"
            onClick={() => void window.atrapo.openFolder()}
            aria-label={t("app.folder")}
            title={t("app.folder")}
            className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-line/60 hover:text-ink"
          >
            <FolderIcon className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={t("app.settings")}
            title={t("app.settings")}
            className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-line/60 hover:text-ink"
          >
            <GearIcon className="size-5" />
          </button>
        </div>
      </header>

      <main className="scroll-soft min-h-0 flex-1 overflow-y-auto">
        {ready && (
          <>
            <Composer hasJobs={jobs.length > 0} />
            <Downloads />
          </>
        )}
      </main>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
