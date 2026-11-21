import { app } from "electron";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import type { Settings } from "@shared/types";

/** The computer's own Downloads folder. */
export const defaultOutputDir = (): string => app.getPath("downloads");

function defaults(): Settings {
  return {
    language: "auto",
    theme: "system",
    outputDir: defaultOutputDir(),
    collectionsAs: "folder",
    spotifyFormat: "mp3",
    history: [],
  };
}

let current: Settings | null = null;
let timer: NodeJS.Timeout | undefined;
const file = () => path.join(app.getPath("userData"), "settings.json");

export function getSettings(): Settings {
  if (current) return current;
  let stored: Partial<Settings> = {};
  try {
    stored = JSON.parse(readFileSync(file(), "utf8")) as Partial<Settings>;
  } catch {
    /* first run or unreadable file: use defaults */
  }
  current = { ...defaults(), ...stored };
  return current;
}

function flush() {
  if (!current) return;
  try {
    mkdirSync(path.dirname(file()), { recursive: true });
    const tmp = file() + ".tmp";
    writeFileSync(tmp, JSON.stringify(current, null, 2));
    renameSync(tmp, file());
  } catch {
    /* disk full or read-only: settings just won't persist */
  }
}

export function saveSoon() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 400);
}

export function flushSettings() {
  if (timer) clearTimeout(timer);
  flush();
}

export function setSettings(patch: Partial<Settings>): Settings {
  const s = getSettings();
  const next: Settings = { ...s, ...patch };
  if (typeof next.outputDir !== "string" || !path.isAbsolute(next.outputDir)) next.outputDir = s.outputDir;
  if (!["zip", "folder"].includes(next.collectionsAs)) next.collectionsAs = s.collectionsAs;
  current = next;
  saveSoon();
  return next;
}
